import { useState, useEffect, useMemo, useRef } from "react";
import MonthNavBar from "../components/MonthNavBar.jsx";
import { collection, addDoc, doc, deleteDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useTheme, formatAmount, CURRENCIES } from "../theme.jsx";
import { useSwipeSheet, useSwipeRow } from "../hooks/useSwipeSheet.js";
import { useNotif, NOTIF_TYPES } from "../notifications";
import { calcSaldosAcumulados } from "../hooks/useBalances.js";
import { getAmountPaidBy } from "../utils/expenseFilters.js";
import DateInput from "../DateInput.jsx";
import { FONT } from "../constants/ui.js";

const fmtDate = (iso) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}-${m}-${y}`;
};

function SectionTitle({ children, style = {} }) {
  const { colors } = useTheme();
  return <p style={{ fontSize: 20, fontWeight: 700, margin: "22px 0 10px", color: colors.text, fontFamily: FONT, ...style }}>{children}</p>;
}

// ── MODAL SALDAR (soporta múltiples acreedores) ──
// debts = [{ debtorUid, creditorUid, amount }]
function SettleModal({ debtor, debts, members, fmt, currencySymbol, colors, onFullSettle, onPartialSettle, onClose }) {
  // selectedDebt: cuál par deudor/acreedor estamos saldando ahora
  const [selectedDebt, setSelectedDebt] = useState(debts.length === 1 ? debts[0] : null);
  const [mode, setMode]     = useState(null); // null | "partial"
  const [amount, setAmount] = useState("");
  const [date, setDate]     = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const submitting = useRef(false); // previene doble tap en móvil
  const { dragY, isDragging, handlers } = useSwipeSheet({ onClose });

  // Cuando un acreedor es saldado, debts prop se actualiza (sin ese acreedor).
  // selectedDebt es estado local y no se sincroniza solo: avanzar al siguiente.
  useEffect(() => {
    if (!selectedDebt) return;
    if (!debts.find(d => d.creditorUid === selectedDebt.creditorUid)) {
      setSelectedDebt(debts.length === 1 ? debts[0] : null);
      setMode(null);
      setAmount("");
    }
  }, [debts]);

  const parsed = parseFloat(amount) || 0;
  const valid  = selectedDebt && parsed > 0 && parsed <= selectedDebt.amount;
  const symbolWidth = (currencySymbol || "$").length > 1 ? 38 : 30;

  const selectDebt = (debt) => {
    setSelectedDebt(debt);
    setAmount(debt.amount.toString());
    setMode(null);
  };

  const handleFull = async () => {
    if (!selectedDebt || submitting.current) return;
    submitting.current = true;
    setLoading(true);
    await onFullSettle(selectedDebt.debtorUid, selectedDebt.creditorUid, selectedDebt.amount);
    setLoading(false);
    submitting.current = false;
  };

  const handlePartial = async () => {
    if (!valid || submitting.current) return;
    submitting.current = true;
    setLoading(true);
    await onPartialSettle({ debtorUid: selectedDebt.debtorUid, creditorUid: selectedDebt.creditorUid, amount: parsed, date });
    setLoading(false);
    submitting.current = false;
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 300, display: "flex", alignItems: "flex-end" }}>
      <div {...handlers} style={{ background: colors.card, borderRadius: "24px 24px 0 0", width: "100%", padding: "24px 20px calc(40px + env(safe-area-inset-bottom))", fontFamily: FONT, transform: `translateY(${dragY}px)`, transition: isDragging ? "none" : "transform 0.3s ease" }}>
        <div style={{ width: 36, height: 4, background: colors.divider, borderRadius: 2, margin: "0 auto 20px" }} />

        <p style={{ fontSize: 18, fontWeight: 700, color: colors.text, margin: "0 0 16px", fontFamily: FONT }}>
          Saldar deuda — {debtor?.name}
        </p>

        {/* Si hay múltiples acreedores, mostrar selector */}
        {debts.length > 1 && (
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: colors.textMuted, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 8, fontFamily: FONT }}>¿Con quién?</p>
            {debts.map(d => {
              const creditor = members.find(m => m.uid === d.creditorUid);
              const isSelected = selectedDebt?.creditorUid === d.creditorUid;
              return (
                <button key={d.creditorUid} onClick={() => selectDebt(d)}
                  style={{ width: "100%", padding: "12px 16px", borderRadius: 14, border: `2px solid ${isSelected ? "#2ecc71" : colors.inputBorder}`, background: isSelected ? "#2ecc7111" : colors.input, marginBottom: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", fontFamily: FONT }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 16, background: (creditor?.color || "#4F7FFA") + "22", border: `2px solid ${creditor?.color || "#4F7FFA"}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: creditor?.color || "#4F7FFA", fontFamily: FONT }}>
                      {creditor?.name?.[0]?.toUpperCase() || "?"}
                    </div>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: colors.text, fontFamily: FONT }}>{creditor?.name}</p>
                  </div>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: colors.danger, fontFamily: FONT }}>{fmt(d.amount)}</p>
                </button>
              );
            })}
          </div>
        )}

        {/* Una vez seleccionado el acreedor, mostrar opciones */}
        {selectedDebt && (() => {
          const creditor = members.find(m => m.uid === selectedDebt.creditorUid);
          return (
            <>
              {debts.length === 1 && (
                <p style={{ fontSize: 13, color: colors.textMuted, margin: "0 0 16px", fontFamily: FONT }}>
                  Le debe a <span style={{ fontWeight: 700, color: colors.text }}>{creditor?.name}</span> · <span style={{ fontWeight: 700, color: colors.text }}>{fmt(selectedDebt.amount)}</span>
                </p>
              )}

              {mode === null && (
                <>
                  <button onClick={handleFull} disabled={loading}
                    style={{ width: "100%", padding: 15, borderRadius: 14, background: loading ? "#aaa" : "linear-gradient(135deg,#2ecc71,#27ae60)", color: "#fff", border: "none", fontSize: 15, fontWeight: 700, cursor: loading ? "default" : "pointer", fontFamily: FONT, marginBottom: 10 }}>
                    {loading ? "Guardando..." : `✅ Saldar todo — ${fmt(selectedDebt.amount)}`}
                  </button>
                  <button onClick={() => { setMode("partial"); setAmount(""); }}
                    style={{ width: "100%", padding: 15, borderRadius: 14, background: colors.pill, color: colors.text, border: "none", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: FONT, marginBottom: 10 }}>
                    💸 Saldar parcialmente
                  </button>
                </>
              )}

              {mode === "partial" && (
                <>
                  <p style={{ fontSize: 11, fontWeight: 700, color: colors.textMuted, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 6, fontFamily: FONT }}>Monto a saldar</p>
                  <div style={{ position: "relative", marginBottom: 14 }}>
                    <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: colors.textMuted, fontWeight: 600, fontFamily: FONT, fontSize: 13 }}>{currencySymbol || "$"}</span>
                    <input type="number" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)}
                      style={{ width: "100%", padding: `13px 14px 13px ${symbolWidth}px`, borderRadius: 14, border: `2px solid ${valid || !amount ? colors.inputBorder : "#e74c3c"}`, fontSize: 15, fontFamily: FONT, outline: "none", boxSizing: "border-box", color: colors.inputText, background: colors.input }} />
                  </div>
                  {parsed > selectedDebt.amount && <p style={{ fontSize: 12, color: "#e74c3c", margin: "-10px 0 12px", fontFamily: FONT }}>No puede superar la deuda ({fmt(selectedDebt.amount)})</p>}
                  <p style={{ fontSize: 11, fontWeight: 700, color: colors.textMuted, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 6, fontFamily: FONT }}>Fecha del pago</p>
                  <DateInput value={date} onChange={setDate} />
                  <button onClick={handlePartial} disabled={!valid || loading}
                    style={{ width: "100%", padding: 15, borderRadius: 14, background: !valid || loading ? "#aaa" : "linear-gradient(135deg,#2ecc71,#27ae60)", color: "#fff", border: "none", fontSize: 15, fontWeight: 700, cursor: !valid || loading ? "default" : "pointer", fontFamily: FONT, marginBottom: 10, marginTop: 4 }}>
                    {loading ? "Guardando..." : `Registrar pago de ${fmt(parsed)}`}
                  </button>
                  <button onClick={() => setMode(null)}
                    style={{ width: "100%", padding: 13, borderRadius: 14, background: colors.pill, color: colors.textMuted, border: "none", fontSize: 14, cursor: "pointer", fontFamily: FONT, marginBottom: 8 }}>
                    ← Volver
                  </button>
                </>
              )}
            </>
          );
        })()}

        <button onClick={onClose} style={{ width: "100%", padding: 13, borderRadius: 14, background: "none", color: colors.textMuted, border: "none", fontSize: 14, cursor: "pointer", fontFamily: FONT }}>Cancelar</button>
      </div>
    </div>
  );
}

// ── MODAL PASAR SALDO AL MES SIGUIENTE ──
function PassDebtModal({ debts, members, nextMonth, fmt, colors, onConfirm, onClose }) {
  const [loading, setLoading] = useState(false);
  const monthName = new Date(nextMonth + "-02").toLocaleString("es-AR", { month: "long", year: "numeric" });
  const currentMonthName = new Date(new Date().toISOString().slice(0, 7) + "-02").toLocaleString("es-AR", { month: "long" });
  const { dragY, isDragging, handlers } = useSwipeSheet({ onClose });

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 300, display: "flex", alignItems: "flex-end" }}>
      <div {...handlers} style={{ background: colors.card, borderRadius: "24px 24px 0 0", width: "100%", padding: "24px 20px calc(40px + env(safe-area-inset-bottom))", fontFamily: FONT, transform: `translateY(${dragY}px)`, transition: isDragging ? "none" : "transform 0.3s ease" }}>
        <div style={{ width: 36, height: 4, background: colors.divider, borderRadius: 2, margin: "0 auto 20px" }} />
        <p style={{ fontSize: 18, fontWeight: 700, color: colors.text, margin: "0 0 4px", fontFamily: FONT }}>Pasar saldo al mes siguiente</p>
        <p style={{ fontSize: 13, color: colors.textMuted, margin: "0 0 20px", fontFamily: FONT }}>Se generarán gastos en {monthName} imputados al deudor</p>
        {debts.map(d => {
          const debtor   = members.find(m => m.uid === d.debtorUid);
          const creditor = members.find(m => m.uid === d.creditorUid);
          return (
            <div key={d.debtorUid} style={{ background: colors.pill, borderRadius: 14, padding: "12px 16px", marginBottom: 10 }}>
              <p style={{ margin: "0 0 2px", fontWeight: 700, fontSize: 14, color: colors.text, fontFamily: FONT }}>{debtor?.name} → {creditor?.name}</p>
              <p style={{ margin: 0, fontSize: 13, color: colors.textMuted, fontFamily: FONT }}>{fmt(d.amount)} · "Saldo pendiente de {currentMonthName}"</p>
            </div>
          );
        })}
        <button onClick={async () => { setLoading(true); await onConfirm(debts); setLoading(false); }} disabled={loading}
          style={{ width: "100%", padding: 15, borderRadius: 14, background: loading ? "#aaa" : "linear-gradient(135deg,#4F7FFA,#3a6ae8)", color: "#fff", border: "none", fontSize: 15, fontWeight: 700, cursor: loading ? "default" : "pointer", fontFamily: FONT, marginBottom: 8, marginTop: 8 }}>
          {loading ? "Generando..." : "Confirmar y generar gastos"}
        </button>
        <button onClick={onClose} style={{ width: "100%", padding: 14, borderRadius: 14, background: colors.pill, color: colors.textMuted, border: "none", fontSize: 15, cursor: "pointer", fontFamily: FONT }}>Cancelar</button>
      </div>
    </div>
  );
}

// ── SWIPEABLE SETTLEMENT ROW ──
function SwipeableSettlementRow({ s, debtor, creditor, isMeDebtor, isMeCreditor, isMe, fmt, colors, canDel, onDelete }) {
  const { offsetX, isSettling, peekProgress, handlers } = useSwipeRow({
    peekDistance: 80,
    fullDistance: 180,
    onFull: () => onDelete(s),
  });
  const PEEK = 80;

  const content = (
    <>
      <span style={{ fontSize: 18, flexShrink: 0 }}>🫱🏼‍🫲🏾</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: colors.text, fontFamily: FONT }}>
          {debtor?.name}{isMeDebtor ? <span style={{ color: "#4F7FFA", fontWeight: 700 }}> · Vos</span> : ""}
          {" → "}
          {creditor?.name}{isMeCreditor ? <span style={{ color: "#4F7FFA", fontWeight: 700 }}> · Vos</span> : ""}
        </p>
        <p style={{ margin: "2px 0 0", fontSize: 11, color: colors.textMuted, fontFamily: FONT }}>
          {s.full ? "Saldo total" : "Saldo parcial"}
        </p>
      </div>
      <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: colors.success, fontFamily: FONT, flexShrink: 0 }}>{fmt(s.amount)}</p>
    </>
  );

  if (!canDel) {
    return (
      <div style={{ padding: "11px 16px", borderTop: `1px solid ${colors.divider}`, display: "flex", alignItems: "center", gap: 10, background: isMe ? colors.pill : "transparent" }}>
        {content}
      </div>
    );
  }

  return (
    <div style={{ position: "relative", overflow: "hidden", borderTop: `1px solid ${colors.divider}` }}>
      <div style={{
        position: "absolute", right: 0, top: 0, bottom: 0, width: PEEK,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: `rgba(229,62,62,${0.15 + peekProgress * 0.85})`, transition: "background 0.1s",
      }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, opacity: Math.min(1, offsetX / (PEEK / 2)) }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14H6L5 6"/>
            <path d="M10 11v6M14 11v6"/>
            <path d="M9 6V4h6v2"/>
          </svg>
          <span style={{ fontSize: 9, color: "#fff", fontWeight: 700, fontFamily: FONT }}>Eliminar</span>
        </div>
      </div>
      <div
        {...handlers}
        style={{
          padding: "11px 16px", display: "flex", alignItems: "center", gap: 10,
          background: isMe ? colors.pill : colors.card,
          transform: `translateX(-${offsetX}px)`,
          transition: isSettling ? "transform 0.25s ease" : "none",
          position: "relative", zIndex: 1,
        }}
      >
        {content}
      </div>
    </div>
  );
}

// ── SALDOS SCREEN ──
export default function SaldosScreen({ expenses, visibleFixed, members, account, currentMonth, selectedMonth, setSelectedMonth, currentUser, onAddExpense, settlements, customCategories, categoryBudgets }) {
  const { colors } = useTheme();
  const { sendNotification } = useNotif();
  const fmt = (n) => formatAmount(n, account?.currency || "ARS");
  const isSubmitting = useRef(false);
  const touchStartX  = useRef(null);

  const monthExp = expenses.filter(e => e.month === selectedMonth && !e.deleted);
  // Memoizado: evita que saldos useMemo recalcule en cada render por referencia nueva de array.
  const realMembers = useMemo(
    () => (members || []).filter(m => !!m.uid).sort((a, b) => {
      if (a.uid === currentUser.uid) return -1;
      if (b.uid === currentUser.uid) return 1;
      return 0;
    }),
    [members, currentUser.uid]
  );
  const monthSettlements = useMemo(
    () => (settlements || []).filter(s => s.month === selectedMonth),
    [settlements, selectedMonth]
  );

  const saldos = useMemo(
    () => calcSaldosAcumulados(expenses.filter(e => !e.deleted), visibleFixed, realMembers, account?.divisionSystem, selectedMonth, monthSettlements),
    [monthExp, visibleFixed, realMembers, account?.divisionSystem, selectedMonth, monthSettlements]
  );

  const balances = realMembers.map(m => ({ ...m, balance: saldos[m.uid]?.balance || 0 }));

  // Simplificación de deudas — algoritmo greedy cascada
  // Dep sobre saldos y realMembers (fuentes estables memoizadas) en lugar de
  // balances[], que crea nueva referencia en cada render aunque los valores no cambien.
  const debtPairs = useMemo(() => {
    const r2 = (n) => Math.round(n * 100) / 100;
    const pairs = [];
    const bs = realMembers.map(m => ({ ...m, balance: saldos[m.uid]?.balance || 0 }));
    const debtors   = bs.filter(m => m.balance < -0.005).map(m => ({ ...m, remaining: r2(Math.abs(m.balance)) })).sort((a, b) => b.remaining - a.remaining);
    const creditors = bs.filter(m => m.balance > 0.005).map(m => ({ ...m, remaining: r2(m.balance) })).sort((a, b) => b.remaining - a.remaining);
    let i = 0, j = 0;
    while (i < debtors.length && j < creditors.length) {
      const amount = r2(Math.min(debtors[i].remaining, creditors[j].remaining));
      if (amount > 0.005) pairs.push({ debtorUid: debtors[i].uid, creditorUid: creditors[j].uid, amount });
      debtors[i].remaining   = r2(debtors[i].remaining - amount);
      creditors[j].remaining = r2(creditors[j].remaining - amount);
      if (debtors[i].remaining   < 0.005) i++;
      if (creditors[j].remaining < 0.005) j++;
    }
    return pairs;
  }, [saldos, realMembers]);

  const [settleModal, setSettleModal]   = useState(null); // { debtorUid, creditorUid, amount }
  const [showPassDebt, setShowPassDebt] = useState(false);
  const [settledPairs, setSettledPairs] = useState({});
  const [historyOpen, setHistoryOpen]   = useState(false);
  const [showSaldosTooltip, setShowSaldosTooltip] = useState(() => !localStorage.getItem('onboarding_seen_saldos'));
  const [confirmDelete, setConfirmDelete] = useState(null); // settlement a eliminar

  const handleFullSettle = async (debtorUid, creditorUid, amount) => {
    if (isSubmitting.current) return;
    isSubmitting.current = true;
    try {
      const debtor   = realMembers.find(m => m.uid === debtorUid);
      const creditor = realMembers.find(m => m.uid === creditorUid);
      await addDoc(collection(db, "accounts", account.id, "settlements"), {
        debtorUid, creditorUid, amount,
        date: new Date().toISOString().slice(0, 10),
        month: currentMonth, full: true,
        createdAt: new Date().toISOString(),
      });
      const newSettledPairs = { ...settledPairs, [debtorUid + "-" + creditorUid]: true };
      setSettledPairs(newSettledPairs);
      setSettleModal(prev => {
        if (!prev) return null;
        const remaining = debtPairs.filter(d =>
          d.debtorUid === prev.debtorUid &&
          !newSettledPairs[d.debtorUid + "-" + d.creditorUid]
        );
        return remaining.length === 0 ? null : { ...prev, debts: remaining };
      });
      await sendNotification({
        type: NOTIF_TYPES.ACCOUNT_SETTLED,
        title: "¡Cuentas saldadas! 🎉",
        body: `${debtor?.name} saldó ${fmt(amount)} con ${creditor?.name}`,
        fromName: debtor?.name || "Un miembro",
        toUids: realMembers.filter(m => m.uid !== debtorUid).map(m => m.uid),
        accountId: account?.id, accountName: account?.name,
      });
    } finally {
      isSubmitting.current = false;
    }
  };

  const handlePartialSettle = async ({ debtorUid, creditorUid, amount, date }) => {
    if (isSubmitting.current) return;
    isSubmitting.current = true;
    try {
      await addDoc(collection(db, "accounts", account.id, "settlements"), {
        debtorUid, creditorUid, amount, date, month: currentMonth, full: false,
        createdAt: new Date().toISOString(),
      });
      setSettleModal(prev => {
        if (!prev) return null;
        const remaining = prev.debts.filter(d => d.creditorUid !== creditorUid);
        return remaining.length === 0 ? null : { ...prev, debts: remaining };
      });
    } finally {
      isSubmitting.current = false;
    }
  };

  const nextMonth = (() => {
    const [y, m] = currentMonth.split("-").map(Number);
    return new Date(y, m, 1).toISOString().slice(0, 7);
  })();

  const handlePassDebt = async (debts) => {
    const currentMonthName = new Date(currentMonth + "-02").toLocaleString("es-AR", { month: "long" });
    await Promise.all(debts.map(d =>
      onAddExpense({
        concept: `Saldo pendiente del mes de ${currentMonthName}`,
        amount: d.amount, type: "personal", category: "otros",
        date: nextMonth + "-01", month: nextMonth,
        paidBy: d.creditorUid, forWhom: [d.debtorUid],
        createdBy: currentUser.uid, accountId: account?.id, isDebtCarryover: true,
      })
    ));
    setShowPassDebt(false);
  };

  const pendingDebts = debtPairs.filter(d => !settledPairs[d.debtorUid + "-" + d.creditorUid]);
  // Esperar a que todos los members del account hayan llegado de Firestore antes de
  // mostrar el botón Saldar. Con members incompletos, debtPairs es incorrecto (el
  // algoritmo greedy necesita todos los balances para distribuir deudas).
  // IMPORTANTE: usar Array.isArray() en lugar de !length — si account.memberIds aún
  // no llegó (undefined), el check anterior devolvía true prematuramente.
  const allMembersLoaded = Array.isArray(account?.memberIds) &&
    account.memberIds.every(uid => realMembers.some(m => m.uid === uid));
  const totalSalary  = (realMembers || []).reduce((acc, mb) => acc + (mb.salary || 0), 0);

  const isPozo     = account?.type === "pozo";
  const isPersonal = account?.type === "personal";
  const allCategories = customCategories || [];
  const catTotals = allCategories
    .map(c => ({ ...c, total: monthExp.filter(e => e.category === c.id).reduce((s, e) => s + e.amount, 0) }))
    .filter(c => c.total > 0)
    .sort((a, b) => b.total - a.total);
  const memberTotals = realMembers
    .map(m => ({ ...m, total: monthExp.reduce((s, e) => s + getAmountPaidBy(e, m.uid), 0) }))
    .sort((a, b) => b.total - a.total);

  // Mes anterior — para comparación en Pozo
  const prevMonth = (() => {
    const [y, m] = selectedMonth.split("-").map(Number);
    return new Date(y, m - 2, 1).toISOString().slice(0, 7);
  })();
  const prevMonthExp = expenses.filter(e => e.month === prevMonth && !e.deleted);
  const catTotalsWithCompare = allCategories
    .map(c => {
      const total    = monthExp.filter(e => e.category === c.id).reduce((s, e) => s + e.amount, 0);
      const prevTotal = prevMonthExp.filter(e => e.category === c.id).reduce((s, e) => s + e.amount, 0);
      const budget   = categoryBudgets?.[c.id] || 0;
      const pct      = budget > 0 ? Math.min(100, (total / budget) * 100) : 0;
      const delta    = prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : null;
      return { ...c, total, prevTotal, budget, pct, delta };
    })
    .filter(c => c.total > 0)
    .sort((a, b) => b.total - a.total);

  const totalSpent    = monthExp.reduce((s, e) => s + e.amount, 0);
  const prevTotalSpent = prevMonthExp.reduce((s, e) => s + e.amount, 0);
  const totalDelta    = prevTotalSpent > 0 ? ((totalSpent - prevTotalSpent) / prevTotalSpent) * 100 : null;
  const totalBudget   = categoryBudgets?._total || 0;
  const totalBudgetPct = totalBudget > 0 ? Math.min(100, (totalSpent / totalBudget) * 100) : 0;

  // ── HISTORIAL — mes independiente de currentMonth ──
  const shiftMonth = (base, delta) => {
    const [y, m] = base.split("-").map(Number);
    return new Date(y, m - 1 + delta, 1).toISOString().slice(0, 7);
  };
  const todayMonth        = new Date().toISOString().slice(0, 7);
  const canGoNext         = shiftMonth(selectedMonth, 1) <= todayMonth;
  const selectedMonthLabel = (() => {
    const raw = new Date(selectedMonth + "-02").toLocaleString("es-AR", { month: "long", year: "numeric" });
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  })();
  const minMonth = expenses.length > 0
    ? expenses.reduce((min, e) => (e.month && e.month < min ? e.month : min), expenses[0]?.month || todayMonth)
    : todayMonth;
  const handleTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < 50) return;
    if (delta < 0) {
      const next = shiftMonth(selectedMonth, 1);
      if (next <= todayMonth) setSelectedMonth(next);
    } else {
      const prev = shiftMonth(selectedMonth, -1);
      if (prev >= minMonth) setSelectedMonth(prev);
    }
  };

  // Vista personal — datos del mes navegable (selectedMonth)
  const personalMonthExp    = isPersonal ? expenses.filter(e => e.month === selectedMonth && !e.deleted) : [];
  const personalTotalSpent  = personalMonthExp.reduce((s, e) => s + e.amount, 0);
  const personalCatData     = isPersonal
    ? (customCategories || [])
        .map(c => {
          const total  = personalMonthExp.filter(e => e.category === c.id).reduce((s, e) => s + e.amount, 0);
          const budget = categoryBudgets?.[c.id] || 0;
          const pct    = budget > 0 ? Math.min(100, (total / budget) * 100) : 0;
          return { ...c, total, budget, pct };
        })
        .filter(c => c.total > 0)
        .sort((a, b) => b.total - a.total)
    : [];

  const historyItems = (settlements || [])
    .filter(s => s.month === selectedMonth && !s.isCorrection && s.amount > 0)
    .sort((a, b) => {
      const dc = (b.date || "").localeCompare(a.date || "");
      return dc !== 0 ? dc : (b.createdAt || "").localeCompare(a.createdAt || "");
    });

  // Agrupar por fecha preservando el orden de historyItems
  const historyDates  = [];
  const historyByDate = {};
  historyItems.forEach(s => {
    const d = fmtDate(s.date || "");
    if (!historyByDate[d]) { historyByDate[d] = []; historyDates.push(d); }
    historyByDate[d].push(s);
  });

  const hasAnySettlements   = (settlements || []).some(s => !s.isCorrection && s.amount > 0);
  const canDeleteSettlement = (s) =>
    s.debtorUid  === currentUser.uid ||
    s.createdBy  === currentUser.uid ||
    account?.ownerId === currentUser.uid;

  const handleDeleteSettlement = async (s) => {
    await deleteDoc(doc(db, "accounts", account.id, "settlements", s.id));
    setConfirmDelete(null);
  };

  return (
    <div style={{ padding: "0 20px", paddingTop: "calc(env(safe-area-inset-top) + 76px)", fontFamily: FONT }} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <MonthNavBar selectedMonth={selectedMonth} minMonth={minMonth} todayMonth={todayMonth} setSelectedMonth={setSelectedMonth} />
      <SectionTitle style={{ marginTop: 4 }}>{isPersonal ? "Gastos del mes" : isPozo ? "Resumen del Pozo" : `Saldos de ${selectedMonthLabel}`}</SectionTitle>

      {/* Vista personal — reemplaza todo el contenido de saldos compartidos */}
      {isPersonal && (
        <>
          {/* Navegador de mes */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, background: colors.card, borderRadius: 16, padding: "10px 16px", boxShadow: colors.shadow, border: `1px solid ${colors.cardBorder}` }}>
            <button type="button" onClick={() => setSelectedMonth(shiftMonth(selectedMonth, -1))}
              style={{ background: colors.pill, border: "none", borderRadius: 10, padding: "6px 14px", fontSize: 16, cursor: "pointer", color: colors.text, lineHeight: 1 }}>←</button>
            <span style={{ fontSize: 14, fontWeight: 700, color: colors.text, fontFamily: FONT }}>{selectedMonthLabel}</span>
            <button type="button" onClick={() => canGoNext && setSelectedMonth(shiftMonth(selectedMonth, 1))} disabled={!canGoNext}
              style={{ background: canGoNext ? colors.pill : "transparent", border: "none", borderRadius: 10, padding: "6px 14px", fontSize: 16, cursor: canGoNext ? "pointer" : "default", color: canGoNext ? colors.text : colors.textMuted, lineHeight: 1, opacity: canGoNext ? 1 : 0.3 }}>→</button>
          </div>

          {/* Total del mes */}
          <div style={{ background: colors.card, borderRadius: 20, padding: "14px 16px", boxShadow: colors.shadow, border: `1px solid ${colors.cardBorder}`, marginBottom: 16 }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.8, fontFamily: FONT }}>Total del mes</p>
            <p style={{ margin: "4px 0 0", fontSize: 28, fontWeight: 800, color: "#4F7FFA", fontFamily: FONT }}>{fmt(personalTotalSpent)}</p>
          </div>

          {/* Gastos por categoría */}
          {personalCatData.length > 0 ? (
            <div style={{ background: colors.card, borderRadius: 20, padding: 16, boxShadow: colors.shadow, border: `1px solid ${colors.cardBorder}`, marginBottom: 16 }}>
              <p style={{ margin: "0 0 14px", fontSize: 11, fontWeight: 700, color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.8, fontFamily: FONT }}>Por categoría</p>
              {personalCatData.map((c, idx) => {
                const barColor = c.budget > 0 ? (c.pct >= 100 ? "#e74c3c" : c.pct >= 80 ? "#f39c12" : "#4F7FFA") : "#4F7FFA";
                const barWidth = c.budget > 0 ? `${c.pct}%` : `${Math.min(100, (c.total / (personalCatData[0]?.total || 1)) * 100)}%`;
                return (
                  <div key={c.id} style={{ marginBottom: idx < personalCatData.length - 1 ? 14 : 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                      <span style={{ fontSize: 18, width: 26, flexShrink: 0 }}>{c.icon}</span>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: colors.text, fontFamily: FONT, flex: 1 }}>{c.label}</p>
                      {c.budget > 0 && c.pct >= 80 && <span style={{ fontSize: 14 }}>{c.pct >= 100 ? "🚨" : "⚠️"}</span>}
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: colors.text, fontFamily: FONT }}>{fmt(c.total)}</p>
                    </div>
                    <div style={{ background: colors.divider, borderRadius: 4, height: 5, overflow: "hidden" }}>
                      <div style={{ height: 5, borderRadius: 4, width: barWidth, background: barColor, transition: "width 0.4s ease" }} />
                    </div>
                    {c.budget > 0 && (
                      <p style={{ margin: "3px 0 0", fontSize: 10, color: colors.textMuted, fontFamily: FONT, textAlign: "right" }}>
                        {fmt(c.total)} / {fmt(c.budget)}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <p style={{ margin: 0, fontSize: 14, color: colors.textMuted, fontFamily: FONT }}>Sin gastos este mes</p>
            </div>
          )}
        </>
      )}

      {!isPersonal && showSaldosTooltip && (
        <div style={{ background: "#4F7FFA18", border: "1px solid #4F7FFA44", borderRadius: 16, padding: "12px 14px", marginBottom: 12, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>💡</span>
          <p style={{ flex: 1, margin: 0, fontSize: 13, color: colors.text, fontFamily: FONT, lineHeight: 1.5 }}>
            Acá ves quién le debe a quién. Cuando alguien paga, tocá Saldar para registrarlo.
          </p>
          <button type="button" onClick={() => { localStorage.setItem('onboarding_seen_saldos', 'true'); setShowSaldosTooltip(false); }}
            style={{ background: "none", border: "none", cursor: "pointer", color: colors.textMuted, fontSize: 18, lineHeight: 1, padding: 0, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", width: 24, height: 24, fontFamily: FONT }}>×</button>
        </div>
      )}

      {/* Vista Pozo Común — ranking por integrante + categorías + presupuesto */}
      {!isPersonal && isPozo && (
        <>
          {/* Resumen total del mes con comparación */}
          <div style={{ background: colors.card, borderRadius: 20, padding: "14px 16px", boxShadow: colors.shadow, border: `1px solid ${colors.cardBorder}`, marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.8, fontFamily: FONT }}>Total del mes</p>
                <p style={{ margin: "4px 0 0", fontSize: 26, fontWeight: 800, color: "#4F7FFA", fontFamily: FONT }}>{fmt(totalSpent)}</p>
              </div>
              {totalDelta !== null && (
                <div style={{ background: totalDelta > 0 ? "#e74c3c18" : "#2ecc7118", borderRadius: 12, padding: "6px 12px", textAlign: "center" }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: totalDelta > 0 ? "#e74c3c" : "#2ecc71", fontFamily: FONT }}>
                    {totalDelta > 0 ? "▲" : "▼"} {Math.abs(totalDelta).toFixed(0)}%
                  </p>
                  <p style={{ margin: 0, fontSize: 10, color: colors.textMuted, fontFamily: FONT }}>vs mes anterior</p>
                </div>
              )}
            </div>
            {/* Barra de presupuesto total si existe */}
            {totalBudget > 0 && (
              <div style={{ marginTop: 12 }}>
                {(totalBudgetPct >= 80) && (
                  <div style={{ background: totalBudgetPct >= 100 ? "#e74c3c18" : "#f39c1218", borderRadius: 8, padding: "5px 10px", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 14 }}>{totalBudgetPct >= 100 ? "🚨" : "⚠️"}</span>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 600, fontFamily: FONT, color: totalBudgetPct >= 100 ? "#e74c3c" : "#f39c12" }}>
                      {totalBudgetPct >= 100 ? "Superaron el presupuesto mensual" : `Usaron el ${totalBudgetPct.toFixed(0)}% del presupuesto`}
                    </p>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <p style={{ margin: 0, fontSize: 11, color: colors.textMuted, fontFamily: FONT }}>Presupuesto mensual</p>
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 700, fontFamily: FONT, color: totalBudgetPct >= 100 ? "#e74c3c" : colors.textMuted }}>{fmt(totalBudget)}</p>
                </div>
                <div style={{ background: colors.divider, borderRadius: 6, height: 6, overflow: "hidden" }}>
                  <div style={{ height: 6, borderRadius: 6, width: `${totalBudgetPct}%`, background: totalBudgetPct >= 100 ? "#e74c3c" : totalBudgetPct >= 80 ? "#f39c12" : "#4F7FFA", transition: "width 0.4s ease" }} />
                </div>
                <p style={{ margin: "4px 0 0", fontSize: 11, color: colors.textMuted, fontFamily: FONT, textAlign: "right" }}>
                  {fmt(Math.max(0, totalBudget - totalSpent))} disponible
                </p>
              </div>
            )}
          </div>

          {/* Ranking por integrante */}
          <div style={{ background: colors.card, borderRadius: 20, overflow: "hidden", boxShadow: colors.shadow, border: `1px solid ${colors.cardBorder}`, marginBottom: 16 }}>
            <div style={{ padding: "12px 16px", borderBottom: `1px solid ${colors.divider}` }}>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.8, fontFamily: FONT }}>Gastos por integrante</p>
            </div>
            {memberTotals.length === 0 ? (
              <div style={{ padding: "20px 16px", textAlign: "center" }}>
                <p style={{ margin: 0, fontSize: 13, color: colors.textMuted, fontFamily: FONT }}>Sin gastos este mes</p>
              </div>
            ) : memberTotals.map((m, idx) => (
              <div key={m.uid} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "13px 16px",
                borderBottom: idx < memberTotals.length - 1 ? `1px solid ${colors.divider}` : "none",
                background: m.uid === currentUser.uid ? colors.pill : "transparent",
              }}>
                {m.photo
                  ? <img src={m.photo} style={{ width: 38, height: 38, borderRadius: 19, flexShrink: 0 }} alt="" />
                  : <div style={{ width: 38, height: 38, borderRadius: 19, background: (m.color || "#4F7FFA") + "22", border: `2px solid ${(m.color || "#4F7FFA") + "44"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: m.color || "#4F7FFA", flexShrink: 0, fontFamily: FONT }}>
                      {m.name?.[0]?.toUpperCase() || "?"}
                    </div>}
                <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: colors.text, fontFamily: FONT, flex: 1 }}>
                  {m.name}{m.uid === currentUser.uid ? " (vos)" : ""}
                </p>
                {/* % del total */}
                {totalSpent > 0 && (
                  <p style={{ margin: 0, fontSize: 11, color: colors.textMuted, fontFamily: FONT, marginRight: 6 }}>
                    {((m.total / totalSpent) * 100).toFixed(0)}%
                  </p>
                )}
                <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: "#4F7FFA", fontFamily: FONT }}>{fmt(m.total)}</p>
              </div>
            ))}
          </div>

          {/* Ranking por categoría con comparación vs mes anterior y presupuesto */}
          {catTotalsWithCompare.length > 0 && (
            <div style={{ background: colors.card, borderRadius: 20, padding: 16, boxShadow: colors.shadow, border: `1px solid ${colors.cardBorder}`, marginBottom: 16 }}>
              <p style={{ margin: "0 0 14px", fontSize: 11, fontWeight: 700, color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.8, fontFamily: FONT }}>Por categoría</p>
              {catTotalsWithCompare.map((c, idx) => {
                const barColor = c.pct >= 100 ? "#e74c3c" : c.pct >= 80 ? "#f39c12" : "#4F7FFA";
                return (
                  <div key={c.id} style={{ marginBottom: idx < catTotalsWithCompare.length - 1 ? 14 : 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                      <span style={{ fontSize: 18, width: 26, flexShrink: 0 }}>{c.icon}</span>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: colors.text, fontFamily: FONT, flex: 1 }}>{c.label}</p>
                      {/* Badge comparación */}
                      {c.delta !== null && (
                        <span style={{ fontSize: 11, fontWeight: 700, color: c.delta > 10 ? "#e74c3c" : c.delta < -10 ? "#2ecc71" : colors.textMuted, fontFamily: FONT }}>
                          {c.delta > 0 ? "▲" : "▼"}{Math.abs(c.delta).toFixed(0)}%
                        </span>
                      )}
                      {c.budget > 0 && (c.pct >= 80) && (
                        <span style={{ fontSize: 14 }}>{c.pct >= 100 ? "🚨" : "⚠️"}</span>
                      )}
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: colors.text, fontFamily: FONT }}>{fmt(c.total)}</p>
                    </div>
                    <div style={{ background: colors.divider, borderRadius: 4, height: 5, overflow: "hidden" }}>
                      <div style={{
                        height: 5, borderRadius: 4,
                        width: c.budget > 0 ? `${c.pct}%` : `${Math.min(100, (c.total / catTotalsWithCompare[0].total) * 100)}%`,
                        background: c.budget > 0 ? barColor : "#4F7FFA",
                        transition: "width 0.4s ease",
                      }} />
                    </div>
                    {c.budget > 0 && (
                      <p style={{ margin: "3px 0 0", fontSize: 10, color: colors.textMuted, fontFamily: FONT, textAlign: "right" }}>
                        {fmt(c.total)} / {fmt(c.budget)}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Lista compacta estilo Tricount */}
      {!isPersonal && !isPozo && <div style={{ background: colors.card, borderRadius: 20, overflow: "hidden", boxShadow: colors.shadow, border: `1px solid ${colors.cardBorder}`, marginBottom: 16 }}>
        {realMembers?.map((m, idx) => {
          const s = saldos[m.uid] || { paid: 0, owes: 0, balance: 0 };
          const isMe = m.uid === currentUser.uid;
          const showPct = account?.divisionSystem === "proportional" && totalSalary > 0;
          const pct = showPct ? ((m.salary || 0) / totalSalary * 100).toFixed(0) : null;
          // ¿Este miembro tiene deuda pendiente hacia alguien?
          const myDebts = debtPairs.filter(p => p.debtorUid === m.uid && p.amount > 0 && !settledPairs[p.debtorUid + "-" + p.creditorUid]);

          return (
            <div key={m.uid} style={{
              display: "flex", alignItems: "center", gap: 12, padding: "14px 16px",
              borderBottom: idx < realMembers.length - 1 ? `1px solid ${colors.divider}` : "none",
            }}>
              {/* Avatar */}
              {m.photo
                ? <img src={m.photo} style={{ width: 40, height: 40, borderRadius: 20, flexShrink: 0 }} alt="" />
                : <div style={{ width: 40, height: 40, borderRadius: 20, background: (m.color || "#4F7FFA") + "22", border: `2px solid ${m.color || "#4F7FFA"}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 700, color: m.color || "#4F7FFA", flexShrink: 0, fontFamily: FONT }}>
                    {m.name?.[0]?.toUpperCase() || "?"}
                  </div>}

              {/* Nombre */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: colors.text, fontFamily: FONT, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {m.name}{isMe ? " (vos)" : ""}
                </p>
                {showPct && <p style={{ margin: 0, fontSize: 11, color: colors.textMuted, fontFamily: FONT }}>{pct}% de la cuenta</p>}
              </div>

              {/* Balance */}
              <p style={{ margin: 0, fontWeight: 700, fontSize: 16, fontFamily: FONT, flexShrink: 0,
                color: s.balance > 0.005 ? colors.success : s.balance < -0.005 ? colors.danger : "#4F7FFA" }}>
                {s.balance > 0.005 ? "+" : ""}{fmt(Math.abs(s.balance) < 0.005 ? 0 : s.balance)}
              </p>

              {/* Botón Saldar — solo para el mes actual, con todos los members cargados */}
              {allMembersLoaded && myDebts.length > 0 && selectedMonth === todayMonth ? (
                <button
                  onClick={() => setSettleModal({ debtorUid: m.uid, debts: myDebts })}
                  style={{ flexShrink: 0, marginLeft: 8, padding: "7px 14px", borderRadius: 20, background: "#2ecc7118", color: "#2ecc71", border: "1px solid #2ecc7144", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}>
                  Saldar
                </button>
              ) : (
                <div style={{ width: 70, flexShrink: 0 }} />
              )}
            </div>
          );
        })}
      </div>}

      {/* Resumen de quién le debe a quién */}
      {!isPersonal && !isPozo && debtPairs.length > 0 && (
        <div style={{ background: colors.card, borderRadius: 20, padding: "14px 16px", boxShadow: colors.shadow, border: `1px solid ${colors.cardBorder}`, marginBottom: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.8, margin: "0 0 10px", fontFamily: FONT }}>Quién le debe a quién</p>
          {debtPairs.filter(pair => pair.amount > 0).map(pair => {
            const debtor   = realMembers.find(m => m.uid === pair.debtorUid);
            const creditor = realMembers.find(m => m.uid === pair.creditorUid);
            const isSettled = !!settledPairs[pair.debtorUid + "-" + pair.creditorUid];
            const futureSett = !isSettled ? (settlements || []).find(s =>
              !s.isCorrection && s.amount > 0 &&
              s.month > selectedMonth &&
              s.debtorUid === pair.debtorUid &&
              s.creditorUid === pair.creditorUid
            ) : null;
            const settledInLabel = futureSett ? (() => {
              const raw = new Date(futureSett.month + "-02").toLocaleString("es-AR", { month: "long", year: "numeric" });
              return raw.charAt(0).toUpperCase() + raw.slice(1);
            })() : null;
            return (
              <div key={pair.debtorUid + "-" + pair.creditorUid} style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: isSettled ? colors.textMuted : colors.text, fontFamily: FONT, flex: 1 }}>
                    {debtor?.name} → {creditor?.name}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: isSettled ? "#4F7FFA" : colors.danger, fontFamily: FONT, flexShrink: 0 }}>
                    {isSettled ? fmt(0) : fmt(pair.amount)}
                  </span>
                </div>
                {settledInLabel && (
                  <p style={{ margin: "2px 0 0 0", fontSize: 11, color: colors.textMuted, fontFamily: FONT }}>
                    Saldado en {settledInLabel}
                  </p>
                )}
              </div>
            );
          })}
          {pendingDebts.length > 0 && (
            <button onClick={() => setShowPassDebt(true)}
              style={{ width: "100%", marginTop: 8, padding: 12, borderRadius: 12, background: colors.pill, color: colors.textMuted, border: `1px solid ${colors.cardBorder}`, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>
              📅 Pasar saldo al mes siguiente
            </button>
          )}
        </div>
      )}

      {/* Historial colapsable con navegación por mes */}
      {!isPersonal && !isPozo && hasAnySettlements && (
        <div style={{ background: colors.card, borderRadius: 20, overflow: "hidden", boxShadow: colors.shadow, border: `1px solid ${colors.cardBorder}`, marginBottom: 16 }}>

          {/* Header toggle */}
          <button onClick={() => setHistoryOpen(o => !o)}
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", background: "none", border: "none", cursor: "pointer", fontFamily: FONT }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.8, fontFamily: FONT }}>
              Pagos registrados{historyItems.length > 0 ? ` (${historyItems.length})` : ""}
            </p>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.textMuted} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              style={{ transform: historyOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
              <path d="M6 9l6 6 6-6"/>
            </svg>
          </button>

          {historyOpen && (
            <>
              {/* Navegación por mes */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderTop: `1px solid ${colors.divider}` }}>
                <button
                  onClick={() => setSelectedMonth(shiftMonth(selectedMonth, -1))}
                  style={{ background: colors.pill, border: "none", borderRadius: 10, padding: "6px 14px", fontSize: 16, cursor: "pointer", color: colors.text, lineHeight: 1 }}>
                  ←
                </button>
                <span style={{ fontSize: 13, fontWeight: 700, color: colors.text, fontFamily: FONT }}>{selectedMonthLabel}</span>
                <button
                  onClick={() => canGoNext && setSelectedMonth(shiftMonth(selectedMonth, 1))}
                  disabled={!canGoNext}
                  style={{ background: canGoNext ? colors.pill : "transparent", border: "none", borderRadius: 10, padding: "6px 14px", fontSize: 16, cursor: canGoNext ? "pointer" : "default", color: canGoNext ? colors.text : colors.textMuted, lineHeight: 1, opacity: canGoNext ? 1 : 0.3 }}>
                  →
                </button>
              </div>

              {/* Sin items en el mes seleccionado */}
              {historyDates.length === 0 && (
                <div style={{ padding: "20px 16px", textAlign: "center", borderTop: `1px solid ${colors.divider}` }}>
                  <p style={{ margin: 0, fontSize: 13, color: colors.textMuted, fontFamily: FONT }}>Sin pagos registrados</p>
                </div>
              )}

              {/* Grupos por fecha */}
              {historyDates.map(date => (
                <div key={date}>
                  {/* Separador de fecha */}
                  <div style={{ padding: "5px 16px", background: colors.pill, borderTop: `1px solid ${colors.divider}` }}>
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: colors.textMuted, letterSpacing: 0.5, fontFamily: FONT }}>{date}</p>
                  </div>

                  {historyByDate[date].map(s => {
                    const debtor   = realMembers.find(m => m.uid === s.debtorUid);
                    const creditor = realMembers.find(m => m.uid === s.creditorUid);
                    const isMeDebtor   = s.debtorUid   === currentUser.uid;
                    const isMeCreditor = s.creditorUid === currentUser.uid;
                    const isMe  = isMeDebtor || isMeCreditor;
                    const canDel = canDeleteSettlement(s);
                    return (
                      <SwipeableSettlementRow
                        key={s.id}
                        s={s}
                        debtor={debtor}
                        creditor={creditor}
                        isMeDebtor={isMeDebtor}
                        isMeCreditor={isMeCreditor}
                        isMe={isMe}
                        fmt={fmt}
                        colors={colors}
                        canDel={canDel}
                        onDelete={(settlement) => setConfirmDelete(settlement)}
                      />
                    );
                  })}
                </div>
              ))}
            </>
          )}
        </div>
      )}

      <div style={{ height: 120 }} />

      {/* Confirmación de eliminación de settlement */}
      {confirmDelete && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 24px" }}>
          <div style={{ background: colors.card, borderRadius: 20, padding: 24, width: "100%", maxWidth: 340, fontFamily: FONT }}>
            <p style={{ fontSize: 17, fontWeight: 700, color: colors.text, margin: "0 0 8px", fontFamily: FONT }}>¿Eliminar pago?</p>
            <p style={{ fontSize: 13, color: colors.textMuted, margin: "0 0 20px", fontFamily: FONT }}>
              {realMembers.find(m => m.uid === confirmDelete.debtorUid)?.name}
              {" → "}
              {realMembers.find(m => m.uid === confirmDelete.creditorUid)?.name}
              {" · "}{fmt(confirmDelete.amount)}
            </p>
            <button onClick={() => handleDeleteSettlement(confirmDelete)}
              style={{ width: "100%", padding: 13, borderRadius: 14, background: "#e74c3c", color: "#fff", border: "none", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: FONT, marginBottom: 8 }}>
              Eliminar
            </button>
            <button onClick={() => setConfirmDelete(null)}
              style={{ width: "100%", padding: 13, borderRadius: 14, background: colors.pill, color: colors.textMuted, border: "none", fontSize: 14, cursor: "pointer", fontFamily: FONT }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {settleModal && (
        <SettleModal
          debtor={realMembers.find(m => m.uid === settleModal.debtorUid)}
          debts={settleModal.debts}
          members={realMembers}
          fmt={fmt}
          currencySymbol={CURRENCIES[account?.currency || "ARS"]?.symbol || "$"}
          colors={colors}
          onFullSettle={handleFullSettle}
          onPartialSettle={handlePartialSettle}
          onClose={() => setSettleModal(null)}
        />
      )}

      {showPassDebt && (
        <PassDebtModal
          debts={pendingDebts}
          members={realMembers}
          nextMonth={nextMonth}
          fmt={fmt}
          colors={colors}
          onConfirm={handlePassDebt}
          onClose={() => setShowPassDebt(false)}
        />
      )}
    </div>
  );
}