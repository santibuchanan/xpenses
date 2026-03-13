import { useState, useMemo, useRef } from "react";
import { collection, addDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useTheme, formatAmount, CURRENCIES } from "../theme.jsx";
import { useNotif, NOTIF_TYPES } from "../notifications";
import { calcSaldos } from "../hooks/useBalances.js";
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

// ── MODAL SALDAR (total o parcial) ──
function SettleModal({ debtor, creditor, totalDebt, fmt, currencySymbol, colors, onFullSettle, onPartialSettle, onClose }) {
  const [mode, setMode]     = useState(null); // null | "partial"
  const [amount, setAmount] = useState(totalDebt.toString());
  const [date, setDate]     = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const parsed = parseFloat(amount) || 0;
  const valid  = parsed > 0 && parsed <= totalDebt;
  const symbolWidth = (currencySymbol || "$").length > 1 ? 38 : 30;

  const handleFull = async () => {
    setLoading(true);
    await onFullSettle();
    setLoading(false);
  };

  const handlePartial = async () => {
    if (!valid) return;
    setLoading(true);
    await onPartialSettle({ debtorUid: debtor.uid, creditorUid: creditor.uid, amount: parsed, date });
    setLoading(false);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 300, display: "flex", alignItems: "flex-end" }}>
      <div style={{ background: colors.card, borderRadius: "24px 24px 0 0", width: "100%", padding: "24px 20px calc(40px + env(safe-area-inset-bottom))", fontFamily: FONT }}>
        <div style={{ width: 36, height: 4, background: colors.divider, borderRadius: 2, margin: "0 auto 20px" }} />

        <p style={{ fontSize: 18, fontWeight: 700, color: colors.text, margin: "0 0 4px", fontFamily: FONT }}>
          {debtor.name} le debe a {creditor.name}
        </p>
        <p style={{ fontSize: 13, color: colors.textMuted, margin: "0 0 20px", fontFamily: FONT }}>
          Deuda pendiente: <span style={{ fontWeight: 700, color: colors.text }}>{fmt(totalDebt)}</span>
        </p>

        {mode === null && (
          <>
            <button onClick={handleFull} disabled={loading}
              style={{ width: "100%", padding: 15, borderRadius: 14, background: loading ? "#aaa" : "linear-gradient(135deg,#2ecc71,#27ae60)", color: "#fff", border: "none", fontSize: 15, fontWeight: 700, cursor: loading ? "default" : "pointer", fontFamily: FONT, marginBottom: 10 }}>
              {loading ? "Guardando..." : `✅ Saldar todo — ${fmt(totalDebt)}`}
            </button>
            <button onClick={() => setMode("partial")}
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
              <input
                type="number" inputMode="decimal"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                style={{ width: "100%", padding: `13px 14px 13px ${symbolWidth}px`, borderRadius: 14, border: `2px solid ${valid || !amount ? colors.inputBorder : "#e74c3c"}`, fontSize: 15, fontFamily: FONT, outline: "none", boxSizing: "border-box", color: colors.inputText, background: colors.input }}
              />
            </div>
            {parsed > totalDebt && <p style={{ fontSize: 12, color: "#e74c3c", margin: "-10px 0 12px", fontFamily: FONT }}>No puede superar la deuda ({fmt(totalDebt)})</p>}
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

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 300, display: "flex", alignItems: "flex-end" }}>
      <div style={{ background: colors.card, borderRadius: "24px 24px 0 0", width: "100%", padding: "24px 20px calc(40px + env(safe-area-inset-bottom))", fontFamily: FONT }}>
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
          {loading ? "Generando..." : "Confirmar y generar gastos →"}
        </button>
        <button onClick={onClose} style={{ width: "100%", padding: 14, borderRadius: 14, background: colors.pill, color: colors.textMuted, border: "none", fontSize: 15, cursor: "pointer", fontFamily: FONT }}>Cancelar</button>
      </div>
    </div>
  );
}

// ── SALDOS SCREEN ──
export default function SaldosScreen({ expenses, visibleFixed, members, account, currentMonth, currentUser, onAddExpense, settlements }) {
  const { colors } = useTheme();
  const { sendNotification } = useNotif();
  const fmt = (n) => formatAmount(n, account?.currency || "ARS");
  const isSubmitting = useRef(false);

  const monthExp = expenses.filter(e => e.month === currentMonth && !e.deleted);
  const realMembers = (members || []).filter(m => !!m.uid).sort((a, b) => {
    if (a.uid === currentUser.uid) return -1;
    if (b.uid === currentUser.uid) return 1;
    return 0;
  });
  const monthSettlements = (settlements || []).filter(s => s.month === currentMonth);

  const saldos = useMemo(
    () => calcSaldos(monthExp, visibleFixed, realMembers, account?.divisionSystem, currentMonth, monthSettlements),
    [monthExp, visibleFixed, realMembers, account?.divisionSystem, currentMonth, monthSettlements]
  );

  const balances = realMembers.map(m => ({ ...m, balance: saldos[m.uid]?.balance || 0 }));

  // Simplificación de deudas — algoritmo greedy cascada
  const debtPairs = (() => {
    const pairs = [];
    const debtors   = balances.filter(m => m.balance < -0.01).map(m => ({ ...m, remaining: Math.abs(m.balance) })).sort((a, b) => b.remaining - a.remaining);
    const creditors = balances.filter(m => m.balance > 0.01).map(m => ({ ...m, remaining: m.balance })).sort((a, b) => b.remaining - a.remaining);
    let i = 0, j = 0;
    while (i < debtors.length && j < creditors.length) {
      const amount = Math.min(debtors[i].remaining, creditors[j].remaining);
      if (amount > 0.01) pairs.push({ debtorUid: debtors[i].uid, creditorUid: creditors[j].uid, amount: Math.round(amount) });
      debtors[i].remaining   -= amount;
      creditors[j].remaining -= amount;
      if (debtors[i].remaining   < 0.01) i++;
      if (creditors[j].remaining < 0.01) j++;
    }
    return pairs;
  })();

  const [settleModal, setSettleModal]   = useState(null); // { debtorUid, creditorUid, amount }
  const [showPassDebt, setShowPassDebt] = useState(false);
  const [settledPairs, setSettledPairs] = useState({});
  const [historyOpen, setHistoryOpen]   = useState(false);

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
      setSettledPairs(p => ({ ...p, [debtorUid + "-" + creditorUid]: true }));
      setSettleModal(null);
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
    await addDoc(collection(db, "accounts", account.id, "settlements"), {
      debtorUid, creditorUid, amount, date, month: currentMonth, full: false,
      createdAt: new Date().toISOString(),
    });
    setSettleModal(null);
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
  const totalSalary  = (realMembers || []).reduce((acc, mb) => acc + (mb.salary || 0), 0);

  // Historial de settlements del mes (no correctivos)
  const historyItems = monthSettlements.filter(s => !s.isCorrection && s.amount > 0)
    .sort((a, b) => (b.createdAt || b.date || "").localeCompare(a.createdAt || a.date || ""));

  return (
    <div style={{ padding: "0 20px", paddingTop: "calc(env(safe-area-inset-top) + 76px)", fontFamily: FONT }}>
      <SectionTitle>Saldos del mes</SectionTitle>

      {/* Lista compacta estilo Tricount */}
      <div style={{ background: colors.card, borderRadius: 20, overflow: "hidden", boxShadow: colors.shadow, border: `1px solid ${colors.cardBorder}`, marginBottom: 16 }}>
        {realMembers?.map((m, idx) => {
          const s = saldos[m.uid] || { paid: 0, owes: 0, balance: 0 };
          const isMe = m.uid === currentUser.uid;
          const showPct = account?.divisionSystem === "proportional" && totalSalary > 0;
          const pct = showPct ? ((m.salary || 0) / totalSalary * 100).toFixed(0) : null;
          // ¿Este miembro tiene deuda pendiente hacia alguien?
          const myDebt = debtPairs.find(p => p.debtorUid === m.uid && !settledPairs[p.debtorUid + "-" + p.creditorUid]);

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
                color: s.balance > 0.01 ? colors.success : s.balance < -0.01 ? colors.danger : colors.textMuted }}>
                {s.balance > 0.01 ? "+" : ""}{fmt(s.balance)}
              </p>

              {/* Botón Saldar — solo si este miembro tiene deuda pendiente */}
              {myDebt ? (
                <button
                  onClick={() => setSettleModal({ debtorUid: m.uid, creditorUid: myDebt.creditorUid, amount: myDebt.amount })}
                  style={{ flexShrink: 0, marginLeft: 8, padding: "7px 14px", borderRadius: 20, background: "#2ecc7118", color: "#2ecc71", border: "1px solid #2ecc7144", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}>
                  Saldar
                </button>
              ) : (
                <div style={{ width: 70, flexShrink: 0 }} />
              )}
            </div>
          );
        })}
      </div>

      {/* Resumen de quién le debe a quién */}
      {debtPairs.length > 0 && (
        <div style={{ background: colors.card, borderRadius: 20, padding: "14px 16px", boxShadow: colors.shadow, border: `1px solid ${colors.cardBorder}`, marginBottom: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.8, margin: "0 0 10px", fontFamily: FONT }}>Quién le debe a quién</p>
          {debtPairs.map(pair => {
            const debtor   = realMembers.find(m => m.uid === pair.debtorUid);
            const creditor = realMembers.find(m => m.uid === pair.creditorUid);
            const isSettled = !!settledPairs[pair.debtorUid + "-" + pair.creditorUid];
            return (
              <div key={pair.debtorUid + "-" + pair.creditorUid}
                style={{ display: "flex", alignItems: "center", gap: 10, paddingVertical: 6, marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: isSettled ? colors.textMuted : colors.text, fontFamily: FONT, flex: 1,
                  textDecoration: isSettled ? "line-through" : "none" }}>
                  {debtor?.name} → {creditor?.name}
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: isSettled ? colors.textMuted : colors.danger, fontFamily: FONT, flexShrink: 0 }}>
                  {isSettled ? "✅" : fmt(pair.amount)}
                </span>
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

      {/* Historial colapsable */}
      {historyItems.length > 0 && (
        <div style={{ background: colors.card, borderRadius: 20, overflow: "hidden", boxShadow: colors.shadow, border: `1px solid ${colors.cardBorder}`, marginBottom: 16 }}>
          <button onClick={() => setHistoryOpen(o => !o)}
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", background: "none", border: "none", cursor: "pointer", fontFamily: FONT }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.8, fontFamily: FONT }}>
              Pagos registrados ({historyItems.length})
            </p>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.textMuted} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              style={{ transform: historyOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
              <path d="M6 9l6 6 6-6"/>
            </svg>
          </button>
          {historyOpen && historyItems.map((s, idx) => {
            const debtor   = realMembers.find(m => m.uid === s.debtorUid);
            const creditor = realMembers.find(m => m.uid === s.creditorUid);
            return (
              <div key={s.id} style={{ padding: "12px 16px", borderTop: `1px solid ${colors.divider}`,
                display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 18 }}>🫱🏼‍🫲🏾</span>
                  <div>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: colors.text, fontFamily: FONT }}>
                      {debtor?.name} → {creditor?.name}
                    </p>
                    <p style={{ margin: "2px 0 0", fontSize: 11, color: colors.textMuted, fontFamily: FONT }}>
                      {fmtDate(s.date)} · {s.full ? "Saldo total" : "Saldo parcial"}
                    </p>
                  </div>
                </div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: colors.success, fontFamily: FONT }}>{fmt(s.amount)}</p>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ height: 120 }} />

      {settleModal && (() => {
        const debtor   = realMembers.find(m => m.uid === settleModal.debtorUid);
        const creditor = realMembers.find(m => m.uid === settleModal.creditorUid);
        return (
          <SettleModal
            debtor={debtor}
            creditor={creditor}
            totalDebt={settleModal.amount}
            fmt={fmt}
            currencySymbol={CURRENCIES[account?.currency || "ARS"]?.symbol || "$"}
            colors={colors}
            onFullSettle={() => handleFullSettle(settleModal.debtorUid, settleModal.creditorUid, settleModal.amount)}
            onPartialSettle={handlePartialSettle}
            onClose={() => setSettleModal(null)}
          />
        );
      })()}

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