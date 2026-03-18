/**
 * utils/expenseFilters.js
 * Filtros de gastos compartidos entre HomeScreen y SaldosScreen.
 *
 * Antes: visibleFixed se calculaba por separado en cada screen con lógica
 * idéntica. Ahora se calcula una vez en App.jsx y se pasa como prop,
 * o se puede importar esta función directamente si se necesita localmente.
 */

/**
 * Retorna los gastos fijos visibles para un usuario dado.
 * Incluye los compartidos (shared) y los propios (createdBy === currentUserId).
 *
 * @param {object[]} fixedExpenses
 * @param {string}   currentUserId
 * @returns {object[]}
 */
export const getVisibleFixed = (fixedExpenses, currentUserId) =>
  (fixedExpenses || []).filter(
    f => f.shared || f.createdBy === currentUserId
  );

/**
 * Filtra gastos del mes actual que no están eliminados (soft-delete).
 *
 * @param {object[]} expenses
 * @param {string}   month - "YYYY-MM"
 * @returns {object[]}
 */
export const getMonthExpenses = (expenses, month) =>
  (expenses || []).filter(e => e.month === month && !e.deleted);

/**
 * Devuelve cuánto pagó `uid` en un gasto dado.
 * Compatible con paidBy: string (formato viejo) y Array<{uid,amount}> (nuevo).
 *
 * @param {object} expense
 * @param {string} uid
 * @returns {number}
 */
export const getAmountPaidBy = (expense, uid) => {
  if (Array.isArray(expense.paidBy)) {
    const entry = expense.paidBy.find(p => p.uid === uid);
    return entry ? entry.amount : 0;
  }
  return expense.paidBy === uid ? expense.amount : 0;
};

/**
 * Calcula el cutoff de mes para limitar lecturas de Firestore.
 * Por defecto retorna 6 meses atrás.
 *
 * @param {number} monthsBack
 * @returns {string} "YYYY-MM"
 */
export const getExpenseCutoffMonth = (monthsBack = 6) => {
  const d = new Date();
  d.setMonth(d.getMonth() - monthsBack);
  return d.toISOString().slice(0, 7);
};