import { useCallback, useRef } from "react";
import { collection, addDoc, deleteDoc, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebase.js";
import { formatAmount } from "../theme.jsx";
import { NOTIF_TYPES } from "../notifications.jsx";

/**
 * Sube archivos a Storage bajo expenses/{expenseId}/{timestamp}_{nombre}
 * Retorna array de URLs de descarga.
 */
async function uploadAttachments(files, expenseId) {
  const uploads = Array.from(files).map(async (file) => {
    const path = `expenses/${expenseId}/${Date.now()}_${file.name}`;
    const fileRef = storageRef(storage, path);
    await uploadBytes(fileRef, file);
    return getDownloadURL(fileRef);
  });
  return Promise.all(uploads);
}

// Stub — eliminación de Storage pendiente implementación completa
// async function deleteAttachments(urls) {
//   const { deleteObject } = await import("firebase/storage");
//   await Promise.all(urls.map(url => deleteObject(storageRef(storage, url))));
// }

/**
 * useExpenses
 * Encapsula toda la lógica de negocio de gastos:
 * addExpense, deleteExpense, doDeleteExpense, handleEditSave, markFixedPaid
 *
 * FIX #2: deleteExpense ya no hace getDocs a Firestore para verificar
 * settlements — usa el estado local `settlements` que ya está disponible
 * via listener en App.jsx. Esto elimina 1 lectura extra por cada intento
 * de borrado.
 *
 * FIX #6: handleFullSettle y doDeleteExpense usan un ref de "procesando"
 * para evitar double-submit (doble tap → duplicación de datos).
 */
export function useExpenses({
  authUser,
  account,
  allMembers,
  members,
  expenses,
  settlements,      // FIX #2: recibe settlements del estado, no los lee de Firestore
  currentMonth,
  setExpenses,
  setEditingExpense,
  setDeleteWarning,
  sendNotification,
}) {
  const myName   = () => members?.find(m => m.uid === authUser?.uid)?.name || "Alguien";
  const currency = account?.currency || "ARS";
  const fmt      = (n) => formatAmount(n, currency);

  const getNotificationRecipients = (expense) => {
    const all = allMembers || members || [];
    const real = all.filter(m => !m._isLabel);
    switch (expense?.type) {
      case "hogar":
      case "extraordinary":
        return real.filter(m => m.uid !== authUser?.uid);
      case "personal": {
        const forWhom = Array.isArray(expense.forWhom) ? expense.forWhom : [expense.forWhom];
        return real.filter(m => forWhom.includes(m.uid) && m.uid !== authUser?.uid);
      }
      case "mio":
        return [];
      default:
        return real.filter(m => m.uid !== authUser?.uid);
    }
  };

  // FIX #6: ref para evitar double-submit en operaciones destructivas
  const isSubmitting = useRef(false);

  const addExpense = useCallback(async (expense, files = []) => {
    const docRef = await addDoc(collection(db, "expenses"), {
      ...expense,
      createdBy: authUser.uid,
      accountId: account?.id,
      createdAt: new Date().toISOString(),
      attachments: [],
    });

    if (files.length > 0) {
      const urls = await uploadAttachments(files, docRef.id);
      await updateDoc(docRef, { attachments: urls });
    }

    await updateDoc(doc(db, "accounts", account.id), { updatedAt: serverTimestamp() });

    const others = getNotificationRecipients(expense);
    if (others.length > 0) {
      await sendNotification({
        type: NOTIF_TYPES.EXPENSE_ADDED,
        title: `Nuevo gasto: ${expense.concept}`,
        body: `${myName()} agregó ${fmt(expense.amount)} en ${account?.name}`,
        fromName: myName(),
        toUids: others.map(m => m.uid),
        accountId: account?.id,
      });
    }
  }, [authUser, account, allMembers, members, sendNotification]);

  const handleEditSave = useCallback(async (updatedExpense) => {
    const others = getNotificationRecipients(updatedExpense);
    if (others.length > 0) {
      await sendNotification({
        type: NOTIF_TYPES.EXPENSE_EDITED,
        title: `Gasto editado: ${updatedExpense.concept}`,
        body: `${myName()} modificó "${updatedExpense.concept}" (${fmt(updatedExpense.amount)}) en ${account?.name}`,
        fromName: myName(),
        toUids: others.map(m => m.uid),
        accountId: account?.id,
      });
    }
    await updateDoc(doc(db, "accounts", account.id), { updatedAt: serverTimestamp() });
    setEditingExpense(null);
  }, [authUser, account, allMembers, members, sendNotification, setEditingExpense]);

  const doDeleteExpense = useCallback(async (expense, addCorrectiveSettlement) => {
    // FIX #6: evitar double-submit
    if (isSubmitting.current) return;
    isSubmitting.current = true;

    try {
      // 1. Soft-delete
      try {
        await updateDoc(doc(db, "expenses", expense.id), {
          deleted: true,
          deletedAt: new Date().toISOString(),
          deletedBy: authUser.uid,
        });
        setExpenses(prev =>
          prev.map(e => e.id === expense.id ? { ...e, deleted: true } : e)
        );
      } catch (err) {
        console.error("Error soft-delete:", err);
        await deleteDoc(doc(db, "expenses", expense.id));
      }

      await updateDoc(doc(db, "accounts", account.id), { updatedAt: serverTimestamp() });

      // 2. Settlement correctivo si hay settlements activos en el mes
      if (addCorrectiveSettlement && account?.id) {
        // Incluir labels — tienen uid estable y participan en gastos (paidBy/forWhom)
        const realMembers = members.filter(m => !!m.uid);
        const totalSalary = realMembers.reduce((s, m) => s + (m.salary || 0), 0);
        const delta = {};
        realMembers.forEach(m => { delta[m.uid] = 0; });

        // Normaliza paidBy — puede ser string uid o Array<{uid,amount}>
        const applyPaidBy = (paidBy, totalAmount) => {
          if (Array.isArray(paidBy)) {
            paidBy.forEach(({ uid, amount }) => {
              if (delta[uid] !== undefined) delta[uid] += amount;
            });
          } else {
            if (delta[paidBy] !== undefined) delta[paidBy] += totalAmount;
          }
        };

        if (expense.type === "hogar") {
          applyPaidBy(expense.paidBy, expense.amount);
          realMembers.forEach(m => {
            const share = account?.divisionSystem === "proportional" && totalSalary > 0
              ? expense.amount * ((m.salary || 0) / totalSalary)
              : expense.amount / realMembers.length;
            if (delta[m.uid] !== undefined) delta[m.uid] -= share;
          });
        } else if (expense.type === "personal") {
          applyPaidBy(expense.paidBy, expense.amount);
          const targets = (Array.isArray(expense.forWhom) ? expense.forWhom : [expense.forWhom])
            .filter(uid => delta[uid] !== undefined);
          targets.forEach(uid => { delta[uid] -= expense.amount / (targets.length || 1); });
        } else if (expense.type === "mio") {
          applyPaidBy(expense.paidBy, expense.amount);
          if (expense.owner && delta[expense.owner] !== undefined)
            delta[expense.owner] -= expense.amount;
        }

        const correctionPromises = [];
        realMembers.forEach(debtor => {
          if (delta[debtor.uid] >= 0) return;
          realMembers.forEach(creditor => {
            if (delta[creditor.uid] <= 0) return;
            const correction = Math.min(Math.abs(delta[debtor.uid]), delta[creditor.uid]);
            if (correction > 0) {
              correctionPromises.push(
                addDoc(collection(db, "accounts", account.id, "settlements"), {
                  debtorUid: debtor.uid,
                  creditorUid: creditor.uid,
                  amount: -correction,
                  date: new Date().toISOString().slice(0, 10),
                  month: currentMonth,
                  full: false,
                  isCorrection: true,
                  correctionReason: `Gasto eliminado: ${expense.concept} ($${expense.amount?.toLocaleString("es-AR")})`,
                })
              );
            }
          });
        });
        // Settlements correctivos en paralelo
        await Promise.all(correctionPromises);
      }

      // 3. Notificar a otros miembros
      const others = getNotificationRecipients(expense);
      if (others.length > 0) {
        await sendNotification({
          type: NOTIF_TYPES.EXPENSE_DELETED,
          title: "Gasto eliminado 🗑️",
          body: `${myName()} eliminó "${expense.concept}" (${fmt(expense.amount)})`,
          fromName: myName(),
          toUids: others.map(m => m.uid),
          accountId: account?.id,
        });
      }

      setDeleteWarning(null);
    } finally {
      isSubmitting.current = false;
    }
  }, [authUser, account, allMembers, members, currentMonth, sendNotification, setExpenses, setDeleteWarning]);

  /**
   * deleteExpense — punto de entrada desde la UI.
   *
   * FIX #2: Usa `settlements` del estado local en lugar de hacer
   * getDocs() a Firestore. Elimina 1 lectura extra por cada intento de borrado.
   */
  const deleteExpense = useCallback(async (expenseId) => {
    const expense = expenses.find(e => e.id === expenseId);
    if (!expense) return;

    // FIX #2: usar estado local — sin lectura a Firestore
    const hasSettlements = (settlements || []).some(
      s => s.month === currentMonth && !s.isCorrection
    );

    if (hasSettlements) {
      setDeleteWarning({ expense });
      return;
    }

    await doDeleteExpense(expense, false);
  }, [expenses, settlements, currentMonth, doDeleteExpense, setDeleteWarning]);

  const markFixedPaid = useCallback(async (fixedId, paidByUid, month) => {
    const fixedRef = doc(db, "accounts", account.id, "fixedExpenses", fixedId);
    await updateDoc(fixedRef, {
      [`payments.${month}`]: {
        paid: true,
        paidBy: paidByUid,
        paidAt: new Date().toISOString().slice(0, 10),
      },
    });
  }, [account?.id]);

  return { addExpense, handleEditSave, deleteExpense, doDeleteExpense, markFixedPaid, uploadAttachments };
}
