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

function Card({ children, style = {} }) {
  const { colors } = useTheme();
  return <div style={{ background: colors.card, borderRadius: 20, padding: 18, marginBottom: 12, boxShadow: colors.shadow, border: `1px solid ${colors.cardBorder}`, ...style }}>{children}</div>;
}

function SectionTitle({ children, style = {} }) {
  const { colors } = useTheme();
  return <p style={{ fontSize: 20, fontWeight: 700, margin: "22px 0 10px", color: colors.text, fontFamily: FONT, ...style }}>{children}</p>;
}

// ── MODAL SALDO PARCIAL ──
function PartialSettleModal({ debtor, creditor, totalDebt, fmt, currencySymbol, colors, onConfirm, onClose }) {
  const [amount, setAmount] = useState(totalDebt.toString());
  const [date, setDate]     = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const parsed = parseFloat(amount) || 0;
  const valid  = parsed > 0 && parsed <= totalDebt;
  const symbolWidth = (currencySymbol || "$").length > 1 ? 38 : 30;

  const handleConfirm = async () => {
    if (!valid) return;
    setLoading(true);
    await onConfirm({ debtorUid: debtor.uid, creditorUid: creditor.uid, amount: parsed, date });
    setLoading(false);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 300, display: "flex", alignItems: "flex-end" }}>
      <div style={{ background: colors.card, borderRadius: "24px 24px 0 0", width: "100%", padding: "24px 20px calc(40px + env(safe-area-inset-bottom))", fontFamily: FONT }}>
        <div style={{ width: 36, height: 4, background: colors.divider, borderRadius: 2, margin: "0 auto 20px" }} />
        <p style={{ fontSize: 18, fontWeight: 700, color: colors.text, margin: "0 0 4px", fontFamily: FONT }}>Saldar parcialmente</p>
        <p style={{ fontSize: 13, color: colors.textMuted, margin: "0 0 20px", fontFamily: FONT }}>
          {debtor.name} le debe {fmt(totalDebt)} a {creditor.name}
        </p>

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
        {parsed > totalDebt && <p style={{ fontSize: 12, color: "#e74c3c", margin: "-10px 0 12px", fontFamily: FONT }}>No puede superar la deuda total ({fmt(totalDebt)})</p>}

        <p style={{ fontSize: 11, fontWeight: 700, color: colors.textMuted, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 6, fontFamily: FONT }}>Fecha del pago</p>
        <DateInput value={date} onChange={setDate} />

        <button onClick={handleConfirm} disabled={!valid || loading}
          style={{ width: "100%", padding: 15, borderRadius: 14, background: !valid || loading ? "#aaa" : "linear-gradient(135deg,#2ecc71,#27ae60)", color: "#fff", border: "none", fontSize: 15, fontWeight: 700, cursor: !valid || loading ? "default" : "pointer", fontFamily: FONT, marginBottom: 8 }}>
          {loading ? "Guardando..." : `Registrar pago de ${fmt(parsed)}`}
        </button>
        <button onClick={onClose} style={{ width: "100%", padding: 14, borderRadius: 14, background: colors.pill, color: colors.textMuted, border: "none", fontSize: 15, cursor: "pointer", fontFamily: FONT }}>Cancelar</button>
      </div>
    </div>
  );
}

// ── MODAL PASAR SALDO AL MES SIGUIENTE ──
function PassDebtModal({ debts, members, nextMonth, fmt, colors, onConfirm, onClose }) {
  const [loading, setLoading] = useState(false);
  const monthName = new Date(nextMonth + "-02").toLocaleString("es-AR", { month: "long", year: "numeric" });
  const currentMonthName = new Date(new Date().toISOString().slice(0, 7) + "-02").toLocaleString("es-AR", { month: "long" });

  const handleConfirm = async () => {
    setLoading(true);
    await onConfirm(debts);
    setLoading(false);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 300, display: "flex", alignItems: "flex-end" }}>
      <div style={{ background: colors.card, borderRadius: "24px 24px 0 0", width: "100%", padding: "24px 20px calc(40px + env(safe-area-inset-bottom))", fontFamily: FONT }}>
        <div style={{ width: 36, height: 4, background: colors.divider, borderRadius: 2, margin: "0 auto 20px" }} />
        <p style={{ fontSize: 18, fontWeight: 700, color: colors.text, margin: "0 0 4px", fontFamily: FONT }}>Pasar saldo al mes siguiente</p>
        <p style={{ fontSize: 13, color: colors.textMuted, margin: "0 0 20px", fontFamily: FONT }}>
          Se generarán gastos en {monthName} imputados al deudor
        </p>
        {debts.map(d => {
          const debtor   = members.find(m => m.uid === d.debtorUid);
          const creditor = members.find(m => m.uid === d.creditorUid);
          return (
            <div key={d.debtorUid} style={{ background: colors.pill, borderRadius: 14, padding: "12px 16px", marginBottom: 10 }}>
              <p style={{ margin: "0 0 2px", fontWeight: 700, fontSize: 14, color: colors.text, fontFamily: FONT }}>
                {debtor?.name} → {creditor?.name}
              </p>
              <p style={{ margin: 0, fontSize: 13, color: colors.textMuted, fontFamily: FONT }}>
                {fmt(d.amount)} · "Saldo pendiente del mes de {currentMonthName}"
              </p>
            </div>
          );
        })}
        <button onClick={handleConfirm} disabled={loading}
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

  // FIX #6: ref para evitar double-submit en settlements
  const isSubmitting = useRef(false);

  const monthExp = expenses.filter(e => e.month === currentMonth && !e.deleted);
  // Filtrar labels — calcSaldos solo funciona con usuarios reales (con uid real de Firebase Auth)
  const realMembers = (members || []).filter(m => !m._isLabel);
  // visibleFixed ya viene filtrado desde App.jsx via getVisibleFixed()
  const monthSettlements = (settlements || []).filter(s => s.month === currentMonth);

  const saldos = useMemo(
    () => calcSaldos(monthExp, visibleFixed, realMembers, account?.divisionSystem, currentMonth, monthSettlements),
    [monthExp, visibleFixed, realMembers, account?.divisionSystem, currentMonth, monthSettlements]
  );

  const balances = realMembers.map(m => ({ ...m, balance: saldos[m.uid]?.balance || 0 }));
  const debtPairs = [];
  balances.forEach(debtor => {
    if (debtor.balance >= 0) return;
    balances.forEach(creditor => {
      if (creditor.balance <= 0) return;
      const amount = Math.min(Math.abs(debtor.balance), creditor.balance);
      if (amount > 0) debtPairs.push({ debtorUid: debtor.uid, creditorUid: creditor.uid, amount });
    });
  });

  const [partialModal, setPartialModal] = useState(null);
  const [showPassDebt, setShowPassDebt] = useState(false);
  const [settledPairs, setSettledPairs] = useState({});

  const handleFullSettle = async (debtorUid, creditorUid, amount) => {
    // FIX #6: evitar double-submit
    if (isSubmitting.current) return;
    isSubmitting.current = true;
    try {
      const debtor   = realMembers.find(m => m.uid === debtorUid);
      const creditor = realMembers.find(m => m.uid === creditorUid);
      await addDoc(collection(db, "accounts", account.id, "settlements"), {
        debtorUid, creditorUid, amount,
        date: new Date().toISOString().slice(0, 10),
        month: currentMonth, full: true,
      });
      setSettledPairs(p => ({ ...p, [debtorUid]: true }));
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
    });
    setPartialModal(null);
  };

  /**
   * FIX #12: getRemainingDebt — antes era un stub que devolvía siempre
   * el monto original, ignorando pagos parciales ya registrados.
   * Ahora descuenta los settlements del mes para ese par deudor/acreedor.
   */
  const getRemainingDebt = (debtorUid, creditorUid, originalAmount) => {
    const paid = monthSettlements
      .filter(s => s.debtorUid === debtorUid && s.creditorUid === creditorUid)
      .reduce((sum, s) => sum + (s.amount || 0), 0);
    return Math.max(0, originalAmount - paid);
  };

  const nextMonth = (() => {
    const [y, m] = currentMonth.split("-").map(Number);
    const next = new Date(y, m, 1);
    return next.toISOString().slice(0, 7);
  })();

  const handlePassDebt = async (debts) => {
    const currentMonthName = new Date(currentMonth + "-02").toLocaleString("es-AR", { month: "long" });
    await Promise.all(debts.map(d =>
      onAddExpense({
        concept: `Saldo pendiente del mes de ${currentMonthName}`,
        amount: d.amount,
        type: "personal",
        category: "otros",
        date: nextMonth + "-01",
        month: nextMonth,
        paidBy: d.creditorUid,
        forWhom: [d.debtorUid],
        createdBy: currentUser.uid,
        accountId: account?.id,
        isDebtCarryover: true,
      })
    ));
    setShowPassDebt(false);
  };

  const pendingDebts = debtPairs
    .map(d => ({ ...d, remaining: getRemainingDebt(d.debtorUid, d.creditorUid, d.amount) }))
    .filter(d => d.remaining > 0);

  const totalSalary = (realMembers || []).reduce((acc, mb) => acc + (mb.salary || 0), 0);

  return (
    <div style={{ padding: "0 20px", paddingTop: "calc(env(safe-area-inset-top) + 76px)", fontFamily: FONT }}>
      <SectionTitle>Saldos del mes</SectionTitle>

      {realMembers?.map(m => {
        const s = saldos[m.uid] || { paid: 0, owes: 0, balance: 0 };
        const showPct = account?.divisionSystem === "proportional" && totalSalary > 0;
        const pct = showPct ? ((m.salary || 0) / totalSalary * 100).toFixed(0) : null;
        return (
          <Card key={m.uid}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              {m.photo ? <img src={m.photo} style={{ width: 44, height: 44, borderRadius: 22 }} alt="" /> : <div style={{ width: 44, height: 44, borderRadius: 22, background: (m.color || "#4F7FFA") + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>👤</div>}
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 16, color: colors.text, fontFamily: FONT }}>{m.name}</p>
                <p style={{ margin: 0, fontSize: 12, color: colors.textMuted, fontFamily: FONT }}>{showPct ? `${fmt(m.salary)} · ${pct}% de la cuenta` : "Miembro"}</p>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
              <div style={{ background: "#4F7FFA14", borderRadius: 12, padding: 12 }}><p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: colors.textMuted, textTransform: "uppercase", fontFamily: FONT }}>Pagó</p><p style={{ margin: 0, fontWeight: 700, fontSize: 16, color: colors.text, fontFamily: FONT }}>{fmt(s.paid)}</p></div>
              <div style={{ background: "#4F7FFA14", borderRadius: 12, padding: 12 }}><p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: colors.textMuted, textTransform: "uppercase", fontFamily: FONT }}>Le toca</p><p style={{ margin: 0, fontWeight: 700, fontSize: 16, color: colors.text, fontFamily: FONT }}>{fmt(s.owes)}</p></div>
            </div>
            <div style={{ background: s.balance >= 0 ? colors.successBg : colors.dangerBg, borderRadius: 14, padding: 14, textAlign: "center" }}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 22, color: s.balance >= 0 ? colors.success : colors.danger, fontFamily: FONT }}>{s.balance >= 0 ? "+" : ""}{fmt(s.balance)}</p>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: colors.textMuted, fontFamily: FONT }}>{s.balance >= 0 ? "A favor" : "A pagar"}</p>
            </div>
          </Card>
        );
      })}

      <Card style={{ background: colors.headerBg, border: "none", marginTop: 8 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: "#ffffff55", textTransform: "uppercase", marginBottom: 12, fontFamily: FONT }}>Saldado de cuentas</p>

        {debtPairs.length === 0 ? (
          <div style={{ textAlign: "center", padding: "8px 0 4px" }}>
            <p style={{ fontSize: 28, margin: "0 0 6px" }}>🎉</p>
            <p style={{ color: "#fff", fontWeight: 700, margin: 0, fontFamily: FONT }}>¡Están al día!</p>
          </div>
        ) : (
          debtPairs.map(pair => {
            const debtor   = realMembers.find(m => m.uid === pair.debtorUid);
            const creditor = realMembers.find(m => m.uid === pair.creditorUid);
            const remaining = getRemainingDebt(pair.debtorUid, pair.creditorUid, pair.amount);
            const isSettled = remaining === 0 || settledPairs[pair.debtorUid];
            const pairSettlements = monthSettlements.filter(s => s.debtorUid === pair.debtorUid && s.creditorUid === pair.creditorUid);

            return (
              <div key={pair.debtorUid} style={{ marginBottom: 16 }}>
                <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 14, padding: "12px 14px", marginBottom: 8 }}>
                  <p style={{ margin: "0 0 2px", fontSize: 14, fontWeight: 700, color: "#fff", fontFamily: FONT }}>
                    {debtor?.name} le debe a {creditor?.name}
                  </p>
                  <p style={{ margin: 0, fontSize: 13, color: isSettled ? "#2ecc71" : "#FA4F7F", fontWeight: 600, fontFamily: FONT }}>
                    {isSettled ? "✅ Saldado" : fmt(remaining) + " pendiente"}
                  </p>
                  {pairSettlements.map(s => (
                    <p key={s.id} style={{ margin: "4px 0 0", fontSize: 11, color: "#ffffff88", fontFamily: FONT }}>
                      ✓ {fmt(s.amount)} pagado el {fmtDate(s.date)}
                    </p>
                  ))}
                </div>

                {!isSettled && (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => handleFullSettle(pair.debtorUid, pair.creditorUid, remaining)}
                      style={{ flex: 1, padding: "11px 0", borderRadius: 12, background: "#2ecc71", color: "#fff", border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}>
                      ✅ Saldar
                    </button>
                    <button onClick={() => setPartialModal({ debtorUid: pair.debtorUid, creditorUid: pair.creditorUid, amount: remaining })}
                      style={{ flex: 1, padding: "11px 0", borderRadius: 12, background: "rgba(255,255,255,0.12)", color: "#fff", border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}>
                      💸 Saldar parcial
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}

        {pendingDebts.length > 0 && (
          <button onClick={() => setShowPassDebt(true)}
            style={{ width: "100%", marginTop: 8, padding: 13, borderRadius: 14, background: "rgba(255,255,255,0.1)", color: "#ffffffcc", border: "1px solid rgba(255,255,255,0.2)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>
            📅 Pasar saldo al mes siguiente
          </button>
        )}
      </Card>

      <div style={{ height: 120 }} />

      {partialModal && (
        <PartialSettleModal
          debtor={realMembers.find(m => m.uid === partialModal.debtorUid)}
          creditor={realMembers.find(m => m.uid === partialModal.creditorUid)}
          totalDebt={partialModal.amount}
          fmt={fmt}
          currencySymbol={CURRENCIES[account?.currency || "ARS"]?.symbol || "$"}
          colors={colors}
          onConfirm={handlePartialSettle}
          onClose={() => setPartialModal(null)}
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