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
// Redondea a 2 decimales evitando floating point drift
const r2 = (n) => Math.round(n * 100) / 100;

/**
 * Normaliza paidBy a un array [{uid, amount}] independientemente del formato.
 * - string (formato viejo): un único pagador por el monto total
 * - Array<{uid,amount}> (formato nuevo): multi-pagador
 */
function getPaidEntries(paidBy, totalAmount) {
  if (Array.isArray(paidBy)) return paidBy.filter(p => p?.uid && (p?.amount || 0) > 0);
  if (typeof paidBy === "string" && paidBy) return [{ uid: paidBy, amount: totalAmount }];
  return [];
}

// Divide un monto entre miembros con centavos exactos.
// El centavo residual se asigna al primer miembro de la lista (pagador o primero).
function splitExact(amount, memberUids, salaryMap, divisionSystem, totalSalary, firstUid) {
  const n = memberUids.length;
  if (n === 0) return {};
  const shares = {};
  let assigned = 0;
  memberUids.forEach((uid, i) => {
    let share;
    if (divisionSystem === "proportional" && totalSalary > 0) {
      share = r2(amount * ((salaryMap[uid] || 0) / totalSalary));
    } else {
      share = r2(amount / n);
    }
    shares[uid] = share;
    assigned = r2(assigned + share);
  });
  // Asignar centavo residual al primero (pagador si está, sino el primero)
  const residual = r2(amount - assigned);
  if (Math.abs(residual) >= 0.01) {
    const target = firstUid && shares[firstUid] !== undefined ? firstUid : memberUids[0];
    shares[target] = r2(shares[target] + residual);
  }
  return shares;
}

export function calcSaldos(expenses, fixedExpenses, members, divisionSystem, currentMonth, settlements) {
  if (!members || members.length === 0) return {};

  const result = {};
  members.forEach(m => { result[m.uid] = { paid: 0, owes: 0 }; });
  const totalSalary = members.reduce((s, m) => s + (m.salary || 0), 0);
  const salaryMap = Object.fromEntries(members.map(m => [m.uid, m.salary || 0]));
  const memberUids = members.map(m => m.uid);

  expenses.forEach(e => {
    // HOGAR: se divide entre los destinatarios (forWhom). Si forWhom está vacío
    // o ausente, se divide entre todos los miembros (comportamiento legacy).
    if (e.type === "hogar") {
      const paidEntries = getPaidEntries(e.paidBy, e.amount);
      paidEntries.forEach(({ uid, amount }) => {
        if (result[uid] !== undefined) result[uid].paid = r2(result[uid].paid + amount);
      });
      const primaryPayer = paidEntries[0]?.uid || null;
      const forWhomUids = (Array.isArray(e.forWhom) && e.forWhom.length > 0)
        ? e.forWhom.filter(uid => result[uid] !== undefined)
        : memberUids;
      const splitUids = forWhomUids.length > 0 ? forWhomUids : memberUids;
      const shares = splitExact(e.amount, splitUids, salaryMap, divisionSystem, totalSalary, primaryPayer);
      splitUids.forEach(uid => {
        if (result[uid] !== undefined) result[uid].owes = r2(result[uid].owes + (shares[uid] || 0));
      });
    }

    // PERSONAL / PARA OTRO: pagador a favor, destinatarios en contra
    if (e.type === "personal") {
      const paidEntries = getPaidEntries(e.paidBy, e.amount);
      paidEntries.forEach(({ uid, amount }) => {
        if (result[uid] !== undefined) result[uid].paid = r2(result[uid].paid + amount);
      });
      const targets = (Array.isArray(e.forWhom) ? e.forWhom : (e.forWhom ? [e.forWhom] : []))
        .filter(uid => result[uid] !== undefined);
      if (targets.length > 0) {
        const shares = splitExact(e.amount, targets, salaryMap, "equal", 0, targets[0]);
        targets.forEach(uid => { result[uid].owes = r2(result[uid].owes + (shares[uid] || 0)); });
      } else {
        // fallback neto 0: cada pagador se debe a sí mismo
        paidEntries.forEach(({ uid, amount }) => {
          if (result[uid] !== undefined) result[uid].owes = r2(result[uid].owes + amount);
        });
      }
    }

    // MIO / PARA MÍ: pagador a favor, owner en contra
    if (e.type === "mio") {
      const paidEntries = getPaidEntries(e.paidBy, e.amount);
      paidEntries.forEach(({ uid, amount }) => {
        if (result[uid] !== undefined) result[uid].paid = r2(result[uid].paid + amount);
      });
      const ownerUid = e.owner;
      if (ownerUid && result[ownerUid] !== undefined) {
        result[ownerUid].owes = r2(result[ownerUid].owes + e.amount);
      } else {
        // fallback neto 0 si owner inválido
        paidEntries.forEach(({ uid, amount }) => {
          if (result[uid] !== undefined) result[uid].owes = r2(result[uid].owes + amount);
        });
      }
    }

    // EXTRAORDINARIO: se divide entre los destinatarios (forWhom). Si forWhom está
    // vacío o ausente, se divide entre todos los miembros (comportamiento legacy).
    // Para el paid: usa campos paid_${uid} si existen (UI de múltiples pagadores),
    // sino cae a paidBy como pagador total (retrocompatibilidad con gastos viejos).
    if (e.type === "extraordinary") {
      const forWhomUids = (Array.isArray(e.forWhom) && e.forWhom.length > 0)
        ? e.forWhom.filter(uid => result[uid] !== undefined)
        : memberUids;
      const splitUids = forWhomUids.length > 0 ? forWhomUids : memberUids;
      const shares = splitExact(e.amount, splitUids, salaryMap, "equal", 0, splitUids[0]);
      const hasPaidFields = members.some(m => (e[`paid_${m.uid}`] || 0) > 0);
      const fallbackEntries = hasPaidFields ? [] : getPaidEntries(e.paidBy, e.amount);
      members.forEach(m => {
        const paid = hasPaidFields
          ? (e[`paid_${m.uid}`] || 0)
          : (fallbackEntries.find(p => p.uid === m.uid)?.amount || 0);
        if (result[m.uid] !== undefined) {
          result[m.uid].paid = r2(result[m.uid].paid + paid);
          result[m.uid].owes = r2(result[m.uid].owes + (shares[m.uid] || 0));
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
        if (result[paidByUid] !== undefined) result[paidByUid].paid = r2(result[paidByUid].paid + f.amount);
        const shares = splitExact(f.amount, memberUids, salaryMap, divisionSystem, totalSalary, paidByUid);
        memberUids.forEach(uid => {
          if (result[uid] !== undefined) result[uid].owes = r2(result[uid].owes + (shares[uid] || 0));
        });
      } else {
        if (result[paidByUid] !== undefined) result[paidByUid].paid = r2(result[paidByUid].paid + f.amount);
        if (result[f.createdBy] !== undefined) result[f.createdBy].owes = r2(result[f.createdBy].owes + f.amount);
      }
    } else {
      if (f.shared) {
        const shares = splitExact(f.amount, memberUids, salaryMap, divisionSystem, totalSalary, memberUids[0]);
        memberUids.forEach(uid => {
          if (result[uid] !== undefined) result[uid].owes = r2(result[uid].owes + (shares[uid] || 0));
        });
      } else {
        if (result[f.createdBy] !== undefined) result[f.createdBy].owes = r2(result[f.createdBy].owes + f.amount);
      }
    }
  });

  // Settlements: el deudor pagó → suma a su paid, el acreedor recibió → suma a su owes
  (settlements || []).forEach(s => {
    if (result[s.debtorUid] !== undefined) result[s.debtorUid].paid = r2(result[s.debtorUid].paid + s.amount);
    if (result[s.creditorUid] !== undefined) result[s.creditorUid].owes = r2(result[s.creditorUid].owes + s.amount);
  });

  Object.keys(result).forEach(uid => { result[uid].balance = r2(result[uid].paid - result[uid].owes); });
  return result;
}

/**
 * Igual que calcSaldos() pero acumula todos los meses hasta upToMonth inclusive.
 * Espera recibir expenses y settlements sin filtrar por mes.
 *
 * @param {object[]} expenses       - Todos los gastos de la cuenta (sin deleted)
 * @param {object[]} fixedExpenses  - Gastos fijos visibles para el usuario
 * @param {object[]} members        - Miembros reales (sin labels, con .uid y .salary)
 * @param {string}   divisionSystem - "proportional" | "50_50" | "informativo"
 * @param {string}   upToMonth      - "YYYY-MM" — acumula hasta este mes inclusive
 * @param {object[]} settlements    - Todos los settlements de la cuenta
 * @returns {object}                - { [uid]: { paid, owes, balance } }
 */
export function calcSaldosAcumulados(expenses, fixedExpenses, members, divisionSystem, upToMonth, settlements) {
  if (!members || members.length === 0) return {};

  const result = {};
  members.forEach(m => { result[m.uid] = { paid: 0, owes: 0 }; });
  const totalSalary = members.reduce((s, m) => s + (m.salary || 0), 0);
  const salaryMap = Object.fromEntries(members.map(m => [m.uid, m.salary || 0]));
  const memberUids = members.map(m => m.uid);

  expenses.filter(e => e.month <= upToMonth).forEach(e => {
    // HOGAR: se divide entre los destinatarios (forWhom). Si forWhom está vacío
    // o ausente, se divide entre todos los miembros (comportamiento legacy).
    if (e.type === "hogar") {
      const paidEntries = getPaidEntries(e.paidBy, e.amount);
      paidEntries.forEach(({ uid, amount }) => {
        if (result[uid] !== undefined) result[uid].paid = r2(result[uid].paid + amount);
      });
      const primaryPayer = paidEntries[0]?.uid || null;
      const forWhomUids = (Array.isArray(e.forWhom) && e.forWhom.length > 0)
        ? e.forWhom.filter(uid => result[uid] !== undefined)
        : memberUids;
      const splitUids = forWhomUids.length > 0 ? forWhomUids : memberUids;
      const shares = splitExact(e.amount, splitUids, salaryMap, divisionSystem, totalSalary, primaryPayer);
      splitUids.forEach(uid => {
        if (result[uid] !== undefined) result[uid].owes = r2(result[uid].owes + (shares[uid] || 0));
      });
    }

    // PERSONAL / PARA OTRO: pagador a favor, destinatarios en contra
    if (e.type === "personal") {
      const paidEntries = getPaidEntries(e.paidBy, e.amount);
      paidEntries.forEach(({ uid, amount }) => {
        if (result[uid] !== undefined) result[uid].paid = r2(result[uid].paid + amount);
      });
      const targets = (Array.isArray(e.forWhom) ? e.forWhom : (e.forWhom ? [e.forWhom] : []))
        .filter(uid => result[uid] !== undefined);
      if (targets.length > 0) {
        const shares = splitExact(e.amount, targets, salaryMap, "equal", 0, targets[0]);
        targets.forEach(uid => { result[uid].owes = r2(result[uid].owes + (shares[uid] || 0)); });
      } else {
        // fallback neto 0: cada pagador se debe a sí mismo
        paidEntries.forEach(({ uid, amount }) => {
          if (result[uid] !== undefined) result[uid].owes = r2(result[uid].owes + amount);
        });
      }
    }

    // MIO / PARA MÍ: pagador a favor, owner en contra
    if (e.type === "mio") {
      const paidEntries = getPaidEntries(e.paidBy, e.amount);
      paidEntries.forEach(({ uid, amount }) => {
        if (result[uid] !== undefined) result[uid].paid = r2(result[uid].paid + amount);
      });
      const ownerUid = e.owner;
      if (ownerUid && result[ownerUid] !== undefined) {
        result[ownerUid].owes = r2(result[ownerUid].owes + e.amount);
      } else {
        // fallback neto 0 si owner inválido
        paidEntries.forEach(({ uid, amount }) => {
          if (result[uid] !== undefined) result[uid].owes = r2(result[uid].owes + amount);
        });
      }
    }

    // EXTRAORDINARIO: se divide entre los destinatarios (forWhom). Si forWhom está
    // vacío o ausente, se divide entre todos los miembros (comportamiento legacy).
    // Para el paid: usa campos paid_${uid} si existen (UI de múltiples pagadores),
    // sino cae a paidBy como pagador total (retrocompatibilidad con gastos viejos).
    if (e.type === "extraordinary") {
      const forWhomUids = (Array.isArray(e.forWhom) && e.forWhom.length > 0)
        ? e.forWhom.filter(uid => result[uid] !== undefined)
        : memberUids;
      const splitUids = forWhomUids.length > 0 ? forWhomUids : memberUids;
      const shares = splitExact(e.amount, splitUids, salaryMap, "equal", 0, splitUids[0]);
      const hasPaidFields = members.some(m => (e[`paid_${m.uid}`] || 0) > 0);
      const fallbackEntries = hasPaidFields ? [] : getPaidEntries(e.paidBy, e.amount);
      members.forEach(m => {
        const paid = hasPaidFields
          ? (e[`paid_${m.uid}`] || 0)
          : (fallbackEntries.find(p => p.uid === m.uid)?.amount || 0);
        if (result[m.uid] !== undefined) {
          result[m.uid].paid = r2(result[m.uid].paid + paid);
          result[m.uid].owes = r2(result[m.uid].owes + (shares[m.uid] || 0));
        }
      });
    }
  });

  // Gastos fijos
  (fixedExpenses || []).forEach(f => {
    const payment = f.payments?.[upToMonth];
    const isPaid = payment?.paid === true;
    if (isPaid) {
      const paidByUid = payment.paidBy;
      if (f.shared) {
        if (result[paidByUid] !== undefined) result[paidByUid].paid = r2(result[paidByUid].paid + f.amount);
        const shares = splitExact(f.amount, memberUids, salaryMap, divisionSystem, totalSalary, paidByUid);
        memberUids.forEach(uid => {
          if (result[uid] !== undefined) result[uid].owes = r2(result[uid].owes + (shares[uid] || 0));
        });
      } else {
        if (result[paidByUid] !== undefined) result[paidByUid].paid = r2(result[paidByUid].paid + f.amount);
        if (result[f.createdBy] !== undefined) result[f.createdBy].owes = r2(result[f.createdBy].owes + f.amount);
      }
    } else {
      if (f.shared) {
        const shares = splitExact(f.amount, memberUids, salaryMap, divisionSystem, totalSalary, memberUids[0]);
        memberUids.forEach(uid => {
          if (result[uid] !== undefined) result[uid].owes = r2(result[uid].owes + (shares[uid] || 0));
        });
      } else {
        if (result[f.createdBy] !== undefined) result[f.createdBy].owes = r2(result[f.createdBy].owes + f.amount);
      }
    }
  });

  // Settlements: el deudor pagó → suma a su paid, el acreedor recibió → suma a su owes
  (settlements || []).filter(s => s.month <= upToMonth).forEach(s => {
    if (result[s.debtorUid] !== undefined) result[s.debtorUid].paid = r2(result[s.debtorUid].paid + s.amount);
    if (result[s.creditorUid] !== undefined) result[s.creditorUid].owes = r2(result[s.creditorUid].owes + s.amount);
  });

  Object.keys(result).forEach(uid => { result[uid].balance = r2(result[uid].paid - result[uid].owes); });
  return result;
}