import { useCallback } from "react";
import { collection, addDoc, deleteDoc, doc, query, getDocs, updateDoc } from "firebase/firestore";
import { db } from "../firebase.js";
import { formatAmount } from "../theme.jsx";
import { NOTIF_TYPES } from "../notifications.jsx";

/**
 * useExpenses
 * Encapsula toda la lógica de negocio de gastos:
 * addExpense, deleteExpense, doDeleteExpense, handleEditSave, markFixedPaid
 *
 * Esto saca ~150 líneas de lógica de AppInner y las hace testeables por separado.
 */
export function useExpenses({
  authUser,
  account,
  members,
  expenses,
  currentMonth,
  setExpenses,
  setEditingExpense,
  setDeleteWarning,
  sendNotification,
}) {
  const myName = () => members?.find(m => m.uid === authUser?.uid)?.name || "Alguien";
  const otherMembers = () => members?.filter(m => !m._isLabel && m.uid !== authUser?.uid) || [];
  const currency = account?.currency || "ARS";
  const fmt = (n) => formatAmount(n, currency);

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
    // 1. Soft-delete
    try {
      await updateDoc(doc(db, "expenses", expense.id), {
        deleted: true,
        deletedAt: new Date().toISOString(),
        deletedBy: authUser.uid,
      });
      // Actualizar estado local sin esperar el snapshot
      setExpenses(prev => prev.map(e => e.id === expense.id ? { ...e, deleted: true } : e));
    } catch (err) {
      console.error("Error soft-delete:", err);
      await deleteDoc(doc(db, "expenses", expense.id));
    }

    // 2. Settlement correctivo si hay settlements activos en el mes
    if (addCorrectiveSettlement && account?.id) {
      const realMembers = members.filter(m => !m._isLabel);
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
        if (expense.owner && delta[expense.owner] !== undefined) delta[expense.owner] -= expense.amount;
      }

      realMembers.forEach(debtor => {
        if (delta[debtor.uid] >= 0) return;
        realMembers.forEach(creditor => {
          if (delta[creditor.uid] <= 0) return;
          const correction = Math.min(Math.abs(delta[debtor.uid]), delta[creditor.uid]);
          if (correction > 0) {
            addDoc(collection(db, "accounts", account.id, "settlements"), {
              debtorUid: debtor.uid,
              creditorUid: creditor.uid,
              amount: -correction,
              date: new Date().toISOString().slice(0, 10),
              month: currentMonth,
              full: false,
              isCorrection: true,
              correctionReason: `Gasto eliminado: ${expense.concept} ($${expense.amount?.toLocaleString("es-AR")})`,
            });
          }
        });
      });
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
  }, [authUser, account, members, currentMonth, sendNotification, setExpenses, setDeleteWarning]);

  const deleteExpense = useCallback(async (expenseId) => {
    const expense = expenses.find(e => e.id === expenseId);
    if (!expense) return;

    let hasSettlements = false;
    if (account?.id) {
      const settSnap = await getDocs(query(collection(db, "accounts", account.id, "settlements")));
      hasSettlements = settSnap.docs.some(d => d.data().month === currentMonth);
    }
    await doDeleteExpense(expense, hasSettlements);
  }, [expenses, account, currentMonth, doDeleteExpense]);

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