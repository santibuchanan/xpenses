/**
 * useBalances.js
 * Hook que centraliza el cálculo de saldos entre miembros.
 *
 * Problema que resuelve: calcSaldos() vivía dentro de App.jsx y era usada por
 * HomeScreen y SaldosScreen sin poder probarse de forma aislada. Al estar en el
 * mismo archivo que 1400 líneas de JSX, cualquier cambio en la función afectaba
 * indirectamente a todo el archivo.
 *
 * Uso:
 *   import { calcSaldos } from "../hooks/useBalances";
 *
 *   const saldos = useMemo(
 *     () => calcSaldos(expenses, fixedExpenses, members, divisionSystem, currentMonth, settlements),
 *     [...]
 *   );
 *
 * Devuelve: { [uid]: { paid: number, owes: number, balance: number } }
 */

/**
 * Calcula saldos entre miembros considerando todos los tipos de gasto,
 * gastos fijos y settlements del mes.
 *
 * @param {object[]} expenses       - Gastos del mes (ya filtrados, sin deleted)
 * @param {object[]} fixedExpenses  - Gastos fijos visibles para el usuario
 * @param {object[]} members        - Miembros reales (sin labels, con .uid y .salary)
 * @param {string}   divisionSystem - "proportional" | "50_50" | "informativo"
 * @param {string}   currentMonth   - "YYYY-MM"
 * @param {object[]} settlements    - Settlements del mes actual
 * @returns {object}                - { [uid]: { paid, owes, balance } }
 */
export function calcSaldos(expenses, fixedExpenses, members, divisionSystem, currentMonth, settlements) {
  if (!members || members.length === 0) return {};

  const result = {};
  members.forEach(m => { result[m.uid] = { paid: 0, owes: 0 }; });
  const totalSalary = members.reduce((s, m) => s + (m.salary || 0), 0);

  expenses.forEach(e => {
    // HOGAR: se divide entre todos
    if (e.type === "hogar") {
      if (result[e.paidBy] !== undefined) result[e.paidBy].paid += e.amount;
      members.forEach(m => {
        const share = divisionSystem === "proportional" && totalSalary > 0
          ? e.amount * ((m.salary || 0) / totalSalary)
          : e.amount / members.length;
        if (result[m.uid] !== undefined) result[m.uid].owes += share;
      });
    }

    // PERSONAL / PARA OTRO: pagador a favor, destinatarios en contra
    if (e.type === "personal") {
      if (result[e.paidBy] !== undefined) result[e.paidBy].paid += e.amount;
      const targets = (Array.isArray(e.forWhom) ? e.forWhom : (e.forWhom ? [e.forWhom] : []))
        .filter(uid => result[uid] !== undefined);
      if (targets.length > 0) {
        targets.forEach(uid => { result[uid].owes += e.amount / targets.length; });
      } else if (result[e.paidBy] !== undefined) {
        result[e.paidBy].owes += e.amount; // fallback neto 0
      }
    }

    // MIO / PARA MÍ: pagador a favor, owner en contra
    if (e.type === "mio") {
      if (result[e.paidBy] !== undefined) result[e.paidBy].paid += e.amount;
      const ownerUid = e.owner;
      if (ownerUid && result[ownerUid] !== undefined) {
        result[ownerUid].owes += e.amount;
      } else if (result[e.paidBy] !== undefined) {
        result[e.paidBy].owes += e.amount; // fallback neto 0 si owner inválido
      }
    }

    // EXTRAORDINARIO
    if (e.type === "extraordinary") {
      members.forEach(m => {
        const paid = e[`paid_${m.uid}`] || 0;
        if (result[m.uid] !== undefined) {
          result[m.uid].paid += paid;
          result[m.uid].owes += e.amount / members.length;
        }
      });
    }
  });

  // Gastos fijos
  (fixedExpenses || []).forEach(f => {
    const payment = f.payments?.[currentMonth];
    const isPaid = payment?.paid === true;
    if (isPaid) {
      const paidByUid = payment.paidBy;
      if (f.shared) {
        if (result[paidByUid] !== undefined) result[paidByUid].paid += f.amount;
        members.forEach(m => {
          const share = divisionSystem === "proportional" && totalSalary > 0
            ? f.amount * ((m.salary || 0) / totalSalary)
            : f.amount / members.length;
          if (result[m.uid] !== undefined) result[m.uid].owes += share;
        });
      } else {
        if (result[paidByUid] !== undefined) result[paidByUid].paid += f.amount;
        if (result[f.createdBy] !== undefined) result[f.createdBy].owes += f.amount;
      }
    } else {
      if (f.shared) {
        members.forEach(m => {
          const share = divisionSystem === "proportional" && totalSalary > 0
            ? f.amount * ((m.salary || 0) / totalSalary)
            : f.amount / members.length;
          if (result[m.uid] !== undefined) result[m.uid].owes += share;
        });
      } else {
        if (result[f.createdBy] !== undefined) result[f.createdBy].owes += f.amount;
      }
    }
  });

  // Settlements: el deudor pagó → suma a su paid, el acreedor recibió → suma a su owes
  (settlements || []).forEach(s => {
    if (result[s.debtorUid] !== undefined) result[s.debtorUid].paid += s.amount;
    if (result[s.creditorUid] !== undefined) result[s.creditorUid].owes += s.amount;
  });

  Object.keys(result).forEach(uid => { result[uid].balance = result[uid].paid - result[uid].owes; });
  return result;
}