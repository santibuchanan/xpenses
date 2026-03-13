import { useCallback, useRef } from "react";
import { collection, addDoc, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase.js";
import { formatAmount } from "../theme.jsx";
import { NOTIF_TYPES } from "../notifications.jsx";

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
  members,
  expenses,
  settlements,      // FIX #2: recibe settlements del estado, no los lee de Firestore
  currentMonth,
  setExpenses,
  setEditingExpense,
  setDeleteWarning,
  sendNotification,
}) {
  const myName      = () => members?.find(m => m.uid === authUser?.uid)?.name || "Alguien";
  const otherMembers = () => members?.filter(m => !m._isLabel && m.uid !== authUser?.uid) || [];
  const currency    = account?.currency || "ARS";
  const fmt         = (n) => formatAmount(n, currency);

  // FIX #6: ref para evitar double-submit en operaciones destructivas
  const isSubmitting = useRef(false);

  const addExpense = useCallback(async (expense) => {
    await addDoc(collection(db, "expenses"), {
      ...expense,
      createdBy: authUser.uid,
      accountId: account?.id,
    });

    const others = otherMembers();
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
  }, [authUser, account, members, sendNotification]);

  const handleEditSave = useCallback(async (updatedExpense) => {
    const others = otherMembers();
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
    setEditingExpense(null);
  }, [authUser, account, members, sendNotification, setEditingExpense]);

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

      // 2. Settlement correctivo si hay settlements activos en el mes
      if (addCorrectiveSettlement && account?.id) {
        // Incluir labels — tienen uid estable y participan en gastos (paidBy/forWhom)
        const realMembers = members.filter(m => !!m.uid);
        const totalSalary = realMembers.reduce((s, m) => s + (m.salary || 0), 0);
        const delta = {};
        realMembers.forEach(m => { delta[m.uid] = 0; });

        if (expense.type === "hogar") {
          if (delta[expense.paidBy] !== undefined) delta[expense.paidBy] += expense.amount;
          realMembers.forEach(m => {
            const share = account?.divisionSystem === "proportional" && totalSalary > 0
              ? expense.amount * ((m.salary || 0) / totalSalary)
              : expense.amount / realMembers.length;
            if (delta[m.uid] !== undefined) delta[m.uid] -= share;
          });
        } else if (expense.type === "personal") {
          if (delta[expense.paidBy] !== undefined) delta[expense.paidBy] += expense.amount;
          const targets = (Array.isArray(expense.forWhom) ? expense.forWhom : [expense.forWhom])
            .filter(uid => delta[uid] !== undefined);
          targets.forEach(uid => { delta[uid] -= expense.amount / (targets.length || 1); });
        } else if (expense.type === "mio") {
          if (delta[expense.paidBy] !== undefined) delta[expense.paidBy] += expense.amount;
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
      const others = otherMembers();
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
  }, [authUser, account, members, currentMonth, sendNotification, setExpenses, setDeleteWarning]);

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

  return { addExpense, handleEditSave, deleteExpense, doDeleteExpense, markFixedPaid };
}