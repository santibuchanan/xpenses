import { useState, useEffect, useMemo } from "react";
import { useTheme, formatAmount } from "../theme.jsx";
import { DEFAULT_CATEGORIES } from "../constants/categories.js";
import { calcSaldos } from "../hooks/useBalances.js";
import { SwipeableExpenseRow } from "../components/expenses/SwipeableExpenseRow.jsx";
import { FONT } from "../constants/ui.js";

const FONT_SIZE_MAP = {
  small:  { base: 12, sub: 10, title: 18 },
  medium: { base: 14, sub: 12, title: 20 },
  large:  { base: 17, sub: 14, title: 22 },
};

/**
 * FIX #8: Reemplaza el segundo useState() (incorrecto) por useEffect.
 * Antes: el event listener NUNCA se registraba porque useState no ejecuta
 * callbacks como effects — cambiar el tamaño de fuente desde el menú
 * no actualizaba HomeScreen hasta que el componente se remontaba.
 */
function useExpenseFontSize() {
  const [size, setSize] = useState(() => localStorage.getItem("expenseFontSize") || "medium");

  useEffect(() => {
    const handler = (e) => setSize(e.detail);
    window.addEventListener("expenseFontSizeChange", handler);
    return () => window.removeEventListener("expenseFontSizeChange", handler);
  }, []);

  return FONT_SIZE_MAP[size] || FONT_SIZE_MAP.medium;
}

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

function Tag({ color, children }) {
  return <span style={{ background: color + "22", color, fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20, fontFamily: FONT }}>{children}</span>;
}

function SectionTitle({ children, style = {} }) {
  const { colors } = useTheme();
  return <p style={{ fontSize: 20, fontWeight: 700, margin: "22px 0 10px", color: colors.text, fontFamily: FONT, ...style }}>{children}</p>;
}

function StatPill({ label, value, color }) {
  const { colors } = useTheme();
  return (
    <div style={{ background: color + "14", borderRadius: 14, padding: "12px 14px", flex: 1 }}>
      <p style={{ margin: "0 0 3px", fontSize: 10, color, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, fontFamily: FONT }}>{label}</p>
      <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: colors.text, fontFamily: FONT }}>{value}</p>
    </div>
  );
}

// ── FIXED EXPENSE ROW ──
// FIX #11: colors eliminado como prop — se consume directo de useTheme()
function FixedExpenseHomeRow({ f, fmt, fs, currentMonth, allMembers, onMarkPaid }) {
  const { colors } = useTheme();
  const payment = f.payments?.[currentMonth];
  const isPaid = payment?.paid === true;
  const paidByMember = isPaid ? allMembers?.find(m => m.uid === payment.paidBy) : null;
  const today = new Date().getDate();
  const daysLeft = f.dueDay ? f.dueDay - today : null;
  const isUrgent = !isPaid && daysLeft !== null && daysLeft >= 0 && daysLeft <= 5;
  const isOverdue = !isPaid && daysLeft !== null && daysLeft < 0;

  return (
    <Card style={{ padding: "12px 16px", marginBottom: 8, opacity: isPaid ? 0.75 : 1 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: 12, background: isPaid ? "#2ecc7114" : (f.shared ? "#4F7FFA14" : "#FA4F7F14"), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
          {isPaid ? "✅" : (f.shared ? "🏠" : "👤")}
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontWeight: 600, fontSize: fs.base, color: colors.text, fontFamily: FONT }}>{f.name}</p>
          <p style={{ margin: "2px 0 0", fontSize: fs.sub, fontFamily: FONT,
            color: isPaid ? "#2ecc71" : isOverdue ? "#e74c3c" : isUrgent ? "#f39c12" : colors.textMuted,
            fontWeight: isPaid || isOverdue || isUrgent ? 600 : 400 }}>
            {isPaid
              ? `Pagado${paidByMember ? ` por ${paidByMember.name}` : ""}`
              : isOverdue ? `⚠️ Venció hace ${Math.abs(daysLeft)}d`
              : isUrgent ? `⏰ Vence en ${daysLeft}d (día ${f.dueDay})`
              : f.dueDay ? `Vence día ${f.dueDay}` : "Pendiente"}
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: fs.base, color: isPaid ? "#2ecc71" : isUrgent || isOverdue ? "#e74c3c" : colors.text, fontFamily: FONT }}>{fmt(f.amount || 0)}</p>
          {!isPaid && (
            <button onClick={() => onMarkPaid(f)} style={{
              background: "linear-gradient(135deg,#2ecc71,#27ae60)", border: "none", borderRadius: 10,
              padding: "5px 10px", fontSize: 11, color: "#fff", cursor: "pointer", fontFamily: FONT, fontWeight: 700, whiteSpace: "nowrap",
            }}>
              Pagar ✓
            </button>
          )}
        </div>
      </div>
    </Card>
  );
}

// ── MARK PAID MODAL ──
// FIX #11: colors eliminado como prop — se consume directo de useTheme()
function MarkPaidModal({ fixedExpense, allMembers, currentUser, currentMonth, onConfirm, onClose }) {
  const { colors } = useTheme();
  const [paidBy, setPaidBy] = useState(currentUser.uid);
  const [loading, setLoading] = useState(false);
  // allMembers ya viene normalizado desde App.jsx via buildAllMembers()
  // No es necesario re-normalizar aquí
  const members = allMembers || [];

  const handleConfirm = async () => {
    setLoading(true);
    await onConfirm(fixedExpense.id, paidBy);
    setLoading(false);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 200, display: "flex", alignItems: "flex-end" }}>
      <div style={{ background: colors.card, borderRadius: "24px 24px 0 0", width: "100%", padding: "24px 20px calc(40px + env(safe-area-inset-bottom))", fontFamily: FONT }}>
        <div style={{ width: 36, height: 4, background: colors.divider, borderRadius: 2, margin: "0 auto 20px" }} />
        <p style={{ fontSize: 18, fontWeight: 700, color: colors.text, margin: "0 0 4px", fontFamily: FONT }}>¿Quién pagó?</p>
        <p style={{ fontSize: 13, color: colors.textMuted, margin: "0 0 20px", fontFamily: FONT }}>{fixedExpense.name} · {fixedExpense.amount?.toLocaleString("es-AR")}</p>

        {members.length > 1 ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
            {members.map(m => (
              <button key={m.uid} onClick={() => setPaidBy(m.uid)}
                style={{ flex: 1, minWidth: 80, padding: 14, borderRadius: 14, border: "2px solid", fontWeight: 600, cursor: "pointer", fontFamily: FONT,
                  borderColor: paidBy === m.uid ? (m.color || "#4F7FFA") : colors.inputBorder,
                  background: paidBy === m.uid ? (m.color || "#4F7FFA") + "18" : colors.input,
                  color: paidBy === m.uid ? (m.color || "#4F7FFA") : colors.textMuted }}>
                {m.name}
              </button>
            ))}
          </div>
        ) : (
          <div style={{ background: colors.pill, borderRadius: 14, padding: "12px 16px", marginBottom: 20 }}>
            <p style={{ margin: 0, fontSize: 14, color: colors.text, fontFamily: FONT }}>
              Pagado por <strong>{members[0]?.name || "vos"}</strong>
            </p>
          </div>
        )}

        <button onClick={handleConfirm} disabled={loading}
          style={{ width: "100%", padding: 15, borderRadius: 14, background: loading ? "#aaa" : "linear-gradient(135deg,#2ecc71,#27ae60)", color: "#fff", border: "none", fontSize: 15, fontWeight: 700, cursor: loading ? "default" : "pointer", fontFamily: FONT, marginBottom: 8 }}>
          {loading ? "Guardando..." : "Confirmar pago ✓"}
        </button>
        <button onClick={onClose} style={{ width: "100%", padding: 14, borderRadius: 14, background: colors.pill, color: colors.textMuted, border: "none", fontSize: 15, cursor: "pointer", fontFamily: FONT }}>Cancelar</button>
      </div>
    </div>
  );
}

// ── HOME SCREEN ──
export default function HomeScreen({ expenses, currentUser, allMembers, account, currentMonth, customCategories, visibleFixed, onEdit, onDelete, onMarkFixedPaid, settlements, isLoading }) {
  const { colors } = useTheme();
  const fs = useExpenseFontSize();
  const isPersonal = account?.type === "personal";
  const isPozo = account?.type === "pozo";
  const currency = account?.currency || "ARS";
  const fmt = (n) => formatAmount(n, currency);
  const me = allMembers?.find(m => m.uid === currentUser.uid);
  const meColor = me?.color || "#4F7FFA";
  const allCategories = [...DEFAULT_CATEGORIES, ...(customCategories || [])];

  const monthExp    = expenses.filter(e => e.month === currentMonth && !e.deleted);
  const monthExpAll = expenses.filter(e => e.month === currentMonth);
  const sharedExp   = monthExp.filter(e => e.type !== "mio");

  // visibleFixed ya viene filtrado desde App.jsx (FIX #9 — no se recalcula aquí)
  const sharedFixed   = (visibleFixed || []).filter(f => f.shared);
  const personalFixed = (visibleFixed || []).filter(f => !f.shared);
  const fixedTotal    = (visibleFixed || []).reduce((s, f) => s + (f.amount || 0), 0);

  // Saldos — incluir labels porque tienen uid estable y participan en gastos
  const realMembers = allMembers?.filter(m => !!m.uid) || [];
  const allMonthSettlements = (settlements || []).filter(s => s.month === currentMonth);
  const saldos = useMemo(
    () => calcSaldos(sharedExp, isPersonal ? [] : visibleFixed, realMembers, account?.divisionSystem, currentMonth, allMonthSettlements),
    [sharedExp, visibleFixed, realMembers, account?.divisionSystem, currentMonth, allMonthSettlements]
  );
  const myBalance = saldos[currentUser.uid]?.balance || 0;

  const normalTotal   = monthExp.reduce((s, e) => s + e.amount, 0);
  const totalMonthExp = normalTotal + fixedTotal;
  const myPersonalTotal = monthExp.filter(e => e.type === "mio" && e.owner === currentUser.uid).reduce((s, e) => s + e.amount, 0);

  const catTotals = allCategories
    .map(c => ({ ...c, total: monthExp.filter(e => e.category === c.id).reduce((s, e) => s + e.amount, 0) }))
    .filter(c => c.total > 0)
    .sort((a, b) => b.total - a.total);

  const [catSectionExpanded, setCatSectionExpanded] = useState(false);
  const [catExpanded, setCatExpanded] = useState(false);
  const monthLabel = new Date(currentMonth + "-02").toLocaleString("es-AR", { month: "long", year: "numeric" });

  const [filterType, setFilterType] = useState("todos");
  const filtered = filterType === "todos" ? monthExpAll : monthExpAll.filter(e => e.category === filterType);
  const monthSettlements = (settlements || []).filter(s => s.month === currentMonth && !s.isCorrection && s.amount > 0);

  // Ordenar por createdAt desc (cuándo se creó el registro).
  // Fallback a date+id para gastos viejos sin createdAt.
  const sortKey = item => item.createdAt || (item.date || "") + "T" + (item.id || "");
  // Settlements se muestran en SaldosScreen — acá solo gastos
  const sorted = [...filtered.map(e => ({ ...e, _type: "expense" }))]
    .sort((a, b) => sortKey(b).localeCompare(sortKey(a)));

  const [fixedExpanded,         setFixedExpanded]         = useState(false);
  const [fixedSharedExpanded,   setFixedSharedExpanded]   = useState(false);
  const [fixedPersonalExpanded, setFixedPersonalExpanded] = useState(false);
  const [payingFixed, setPayingFixed] = useState(null);

  return (
    <div style={{ fontFamily: FONT }}>
      {/* Hero */}
      <div style={{ background: colors.headerBg, borderRadius: "0 0 32px 32px", padding: "calc(env(safe-area-inset-top) + 76px) 20px 28px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
          {me?.photo
            ? <img src={me.photo} style={{ width: 44, height: 44, borderRadius: 22, border: "2px solid #ffffff44" }} alt="" />
            : <div style={{ width: 44, height: 44, borderRadius: 22, background: meColor + "44", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>👤</div>}
          <div>
            <p style={{ color: "#ffffff88", fontSize: 12, margin: 0, fontFamily: FONT }}>Hola,</p>
            <p style={{ color: "#fff", fontSize: 22, fontWeight: 700, margin: 0, fontFamily: FONT }}>{me?.name || currentUser.displayName}</p>
          </div>
        </div>
        <div style={{ background: meColor, borderRadius: 22, padding: 20 }}>
          <p style={{ color: "#ffffff88", fontSize: 11, margin: "0 0 6px", fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", fontFamily: FONT }}>Gastos — {monthLabel}</p>
          {isLoading ? (
            <>
              <div style={{ width: 140, height: 36, borderRadius: 10, background: "#ffffff33", marginBottom: 4 }} />
              <div style={{ width: 100, height: 13, borderRadius: 6, background: "#ffffff33", marginTop: 8 }} />
            </>
          ) : (
            <>
              <p style={{ color: "#fff", fontSize: 36, fontWeight: 700, margin: "0 0 4px", letterSpacing: -1, fontFamily: FONT }}>{fmt(totalMonthExp)}</p>
              {!isPersonal && !isPozo && (() => {
                const displayBalance = Math.abs(myBalance) < 0.5 ? 0 : myBalance;
                return (
                  <p style={{ fontSize: 13, margin: "6px 0 0", fontFamily: FONT, color: displayBalance > 0 ? "#2ecc71" : displayBalance < 0 ? "#ff6b6b" : "#ffffff66", fontWeight: 600 }}>
                    {displayBalance > 0 ? `+${fmt(displayBalance)} a favor` : displayBalance < 0 ? `-${fmt(Math.abs(displayBalance))} a pagar` : "Saldado ✓"}
                  </p>
                );
              })()}
              {isPozo && (
                <p style={{ fontSize: 12, margin: "6px 0 0", fontFamily: FONT, color: "#ffffff88", lineHeight: 1.6 }}>
                  {(allMembers || []).filter(m => !!m.uid).map(m => {
                    const mTotal = monthExp.filter(e => e.paidBy === m.uid).reduce((s, e) => s + e.amount, 0);
                    return `${m.name}: ${fmt(mTotal)}`;
                  }).join(" · ")}
                </p>
              )}
            </>
          )}
        </div>
      </div>

      <div style={{ padding: "0 20px" }}>
        <SectionTitle>Resumen del mes</SectionTitle>
        <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
          {isPersonal ? (
            <StatPill label="Total gastos" value={fmt(totalMonthExp)} color={meColor} />
          ) : isPozo ? (
            <>
              {(allMembers || []).filter(m => !!m.uid).map(m => {
                const mTotal = monthExp.filter(e => e.paidBy === m.uid).reduce((s, e) => s + e.amount, 0);
                return <StatPill key={m.uid} label={m.name} value={fmt(mTotal)} color={m.color || "#f39c12"} />;
              })}
            </>
          ) : (
            <>
              <StatPill label="Compartido" value={fmt(sharedExp.reduce((s, e) => s + e.amount, 0))} color="#4F7FFA" />
              <StatPill label="Mis gastos" value={fmt(myPersonalTotal)} color={meColor} />
            </>
          )}
        </div>

        {catTotals.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <button onClick={() => setCatSectionExpanded(v => !v)} style={{ width: "100%", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 0 8px", fontFamily: FONT }}>
              <span style={{ fontSize: 20, fontWeight: 700, color: colors.text, fontFamily: FONT }}>🏷️ Top categorías</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, color: colors.textMuted, fontFamily: FONT }}>{catTotals.length} categoría{catTotals.length !== 1 ? "s" : ""}</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.textMuted} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: catSectionExpanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}><path d="M6 9l6 6 6-6"/></svg>
              </div>
            </button>

            {catSectionExpanded && (
              <div>
                {(catExpanded ? catTotals : catTotals.slice(0, 4)).map(c => (
                  <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                    <span style={{ fontSize: 22, width: 30 }}>{c.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: fs.base, fontWeight: 600, color: colors.text, fontFamily: FONT }}>{c.label}</span>
                        <span style={{ fontSize: fs.base, fontWeight: 700, color: colors.text, fontFamily: FONT }}>{fmt(c.total)}</span>
                      </div>
                      <div style={{ background: colors.divider, borderRadius: 4, height: 5 }}>
                        <div style={{ background: "#4F7FFA", borderRadius: 4, height: 5, width: `${Math.min(100, (c.total / catTotals[0].total) * 100)}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
                {catTotals.length > 4 && (
                  <button onClick={() => setCatExpanded(v => !v)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#4F7FFA", fontWeight: 600, fontFamily: FONT, padding: "4px 0" }}>
                    {catExpanded ? "Ver menos ▲" : `Ver todas (${catTotals.length}) ▼`}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Gastos fijos */}
        {visibleFixed.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <button onClick={() => setFixedExpanded(v => !v)} style={{ width: "100%", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 0 8px", fontFamily: FONT }}>
              <span style={{ fontSize: 20, fontWeight: 700, color: colors.text, fontFamily: FONT }}>📋 Gastos fijos</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, color: colors.textMuted, fontFamily: FONT }}>{fmt(fixedTotal)}</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.textMuted} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: fixedExpanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}><path d="M6 9l6 6 6-6"/></svg>
              </div>
            </button>

            {fixedExpanded && (
              <div>
                {!isPersonal && sharedFixed.length > 0 && (
                  <>
                    <button onClick={() => setFixedSharedExpanded(v => !v)} style={{ width: "100%", background: colors.pill, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: 14, marginBottom: 6, fontFamily: FONT }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: colors.text, fontFamily: FONT }}>🏠 Gastos fijos del Hogar</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 12, color: colors.textMuted, fontFamily: FONT }}>{fmt(sharedFixed.reduce((s, f) => s + (f.amount || 0), 0))}</span>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={colors.textMuted} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: fixedSharedExpanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}><path d="M6 9l6 6 6-6"/></svg>
                      </div>
                    </button>
                    {fixedSharedExpanded && sharedFixed.map(f => (
                      <FixedExpenseHomeRow key={f.id} f={f} fmt={fmt} fs={fs} currentMonth={currentMonth} allMembers={allMembers} onMarkPaid={setPayingFixed} />
                    ))}
                  </>
                )}

                {!isPersonal && personalFixed.length > 0 && (
                  <>
                    <button onClick={() => setFixedPersonalExpanded(v => !v)} style={{ width: "100%", background: colors.pill, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: 14, marginBottom: 6, fontFamily: FONT }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: colors.text, fontFamily: FONT }}>👤 Gastos fijos Personales</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 12, color: colors.textMuted, fontFamily: FONT }}>{fmt(personalFixed.reduce((s, f) => s + (f.amount || 0), 0))}</span>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={colors.textMuted} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: fixedPersonalExpanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}><path d="M6 9l6 6 6-6"/></svg>
                      </div>
                    </button>
                    {fixedPersonalExpanded && personalFixed.map(f => (
                      <FixedExpenseHomeRow key={f.id} f={f} fmt={fmt} fs={fs} currentMonth={currentMonth} allMembers={allMembers} onMarkPaid={setPayingFixed} />
                    ))}
                  </>
                )}

                {isPersonal && visibleFixed.map(f => (
                  <FixedExpenseHomeRow key={f.id} f={f} fmt={fmt} fs={fs} currentMonth={currentMonth} allMembers={allMembers} onMarkPaid={setPayingFixed} />
                ))}
              </div>
            )}
          </div>
        )}

        <SectionTitle>Movimientos</SectionTitle>
        <div style={{ display: "flex", gap: 8, marginBottom: 16, overflowX: "auto", paddingBottom: 4 }}>
          {[["todos", "Todas"], ...allCategories.filter(c => monthExp.some(e => e.category === c.id)).map(c => [c.id, c.icon])].map(([val, lbl]) => (
            <button key={val} onClick={() => setFilterType(val)} style={{ whiteSpace: "nowrap", padding: "8px 14px", borderRadius: 20, border: "2px solid", cursor: "pointer", fontFamily: FONT, fontSize: 12, fontWeight: 600, borderColor: filterType === val ? "#4F7FFA" : colors.inputBorder, background: filterType === val ? "#4F7FFA" : colors.card, color: filterType === val ? "#fff" : colors.textMuted }}>{lbl}</button>
          ))}
        </div>

        {isLoading && [1,2,3].map(i => (
          <div key={i} style={{ background: colors.card, borderRadius: 16, padding: "14px 16px", marginBottom: 8, border: "1px solid " + colors.cardBorder, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: colors.divider, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ width: "50%", height: 13, borderRadius: 6, background: colors.divider, marginBottom: 8 }} />
              <div style={{ width: "30%", height: 10, borderRadius: 5, background: colors.divider }} />
            </div>
            <div style={{ width: 60, height: 13, borderRadius: 6, background: colors.divider }} />
          </div>
        ))}
        {!isLoading && sorted.length === 0 && (
          <Card style={{ textAlign: "center", color: colors.textMuted, padding: 32 }}>
            <p style={{ fontSize: 32, margin: "0 0 8px" }}>📭</p>
            <p style={{ margin: 0, fontFamily: FONT }}>Sin gastos este mes</p>
          </Card>
        )}
        {sorted.map(item => (
          <SwipeableExpenseRow key={`${item.id}-${item.deleted ? "del" : "ok"}`} e={item} allCategories={allCategories} allMembers={allMembers} fmt={fmt} fs={fs} colors={colors} onEdit={onEdit} onDelete={onDelete} isPersonal={isPersonal} currentUser={currentUser} />
        ))}
        <div style={{ height: 120 }} />
      </div>

      {payingFixed && (
        <MarkPaidModal
          fixedExpense={payingFixed}
          allMembers={allMembers}
          currentUser={currentUser}
          currentMonth={currentMonth}
          onConfirm={async (fixedId, paidByUid) => {
            await onMarkFixedPaid(fixedId, paidByUid, currentMonth);
            setPayingFixed(null);
          }}
          onClose={() => setPayingFixed(null)}
        />
      )}
    </div>
  );
}