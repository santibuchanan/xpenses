import { useState, useRef } from "react";
import MonthNavBar from "../components/MonthNavBar.jsx";
import useIsDesktop from "../hooks/useIsDesktop.js";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useTheme, formatAmount } from "../theme.jsx";
import { DEFAULT_CATEGORIES } from "../constants/categories.js";

const FONT = `'DM Sans', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif`;
const CAT_COLORS = ["#4F7FFA","#FA4F7F","#f39c12","#2ecc71","#9b59b6","#1abc9c","#e74c3c","#95a5a6"];

function Card({ children, style = {} }) {
  const { colors } = useTheme();
  return <div style={{ background: colors.card, borderRadius: 20, padding: 18, marginBottom: 12, boxShadow: colors.shadow, border: `1px solid ${colors.cardBorder}`, ...style }}>{children}</div>;
}

function SectionTitle({ children, style = {} }) {
  const { colors } = useTheme();
  return <p style={{ fontSize: 20, fontWeight: 700, margin: "22px 0 10px", color: colors.text, fontFamily: FONT, ...style }}>{children}</p>;
}

export default function GraficosScreen({ expenses, account, customCategories, fixedExpenses, categoryBudgets, selectedMonth, setSelectedMonth }) {
  const { colors } = useTheme();
  const isDesktop = useIsDesktop();
  const fmt = (n) => formatAmount(n, account?.currency || "ARS");
  const allCategories = [...DEFAULT_CATEGORIES, ...(customCategories || [])];

  const activeExpenses = expenses.filter(e => !e.deleted);
  const allMonths = [...new Set(activeExpenses.map(e => e.month))].sort();
  const last6 = allMonths.slice(-6);
  const monthLabel = (m) => new Date(m + "-02").toLocaleString("es-AR", { month: "short" });

  const [barView, setBarView] = useState("total");

  const todayMonth = new Date().toISOString().slice(0, 7);
  const shiftMonth = (base, delta) => {
    const [y, m] = base.split('-').map(Number);
    let nm = m + delta, ny = y;
    if (nm > 12) { nm = 1; ny++; }
    if (nm < 1)  { nm = 12; ny--; }
    return `${ny}-${String(nm).padStart(2, '0')}`;
  };
  const minMonth = activeExpenses.length > 0
    ? activeExpenses.reduce((min, e) => (e.month && e.month < min ? e.month : min), activeExpenses[0]?.month || todayMonth)
    : todayMonth;
  const canGoPrev = selectedMonth > minMonth;
  const canGoNext = selectedMonth < todayMonth;

  const touchStartX = useRef(null);
  const handleTouchStart = (e) => {
    if (isDesktop) return;
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e) => {
    if (isDesktop) return;
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < 50) return;
    if (delta < 0) { if (canGoNext) setSelectedMonth(shiftMonth(selectedMonth, 1)); }
    else           { if (canGoPrev) setSelectedMonth(shiftMonth(selectedMonth, -1)); }
  };

  const pieMonth = selectedMonth;
  const barMonth = selectedMonth;

  const barDataTotal = last6.map(m => ({
    mes: monthLabel(m),
    Total: activeExpenses.filter(e => e.month === m).reduce((s, e) => s + e.amount, 0),
  }));

  const barDataTipoMonth = [{
    mes: barMonth ? new Date(barMonth + "-02").toLocaleString("es-AR", { month: "short", year: "2-digit" }) : "-",
    Ordinario:     activeExpenses.filter(e => e.month === barMonth && e.type === "hogar").reduce((s, e) => s + e.amount, 0),
    "Para mí":     activeExpenses.filter(e => e.month === barMonth && e.type === "mio").reduce((s, e) => s + e.amount, 0),
    Extraordinario: activeExpenses.filter(e => e.month === barMonth && e.type === "extraordinary").reduce((s, e) => s + e.amount, 0),
    Fijos: (fixedExpenses || []).filter(f => {
      const start = (f.startDate || "2000-01").slice(0, 7);
      return barMonth >= start;
    }).reduce((s, f) => s + (f.amount || 0), 0),
  }];

  const pieData = allCategories.map((c, i) => {
    const fromExp   = activeExpenses.filter(e => e.month === pieMonth && e.category === c.id).reduce((s, e) => s + e.amount, 0);
    const fromFixed = (fixedExpenses || []).filter(f => {
      const start = (f.startDate || "2000-01").slice(0, 7);
      return f.category === c.id && pieMonth >= start;
    }).reduce((s, f) => s + (f.amount || 0), 0);
    return { name: c.label, value: fromExp + fromFixed, color: CAT_COLORS[i % CAT_COLORS.length] };
  }).filter(c => c.value > 0);

  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
    if (percent < 0.07) return null;
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.55;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    return <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={700} fontFamily={FONT}>{`${(percent * 100).toFixed(0)}%`}</text>;
  };

  return (
    <div style={{ padding: "0 20px", paddingTop: "calc(env(safe-area-inset-top) + 76px)", fontFamily: FONT }} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <MonthNavBar selectedMonth={selectedMonth} minMonth={minMonth} todayMonth={todayMonth} setSelectedMonth={setSelectedMonth} />
      <div style={{
        display: isDesktop ? 'grid' : 'block',
        gridTemplateColumns: isDesktop ? '1fr 1fr' : undefined,
        gap: isDesktop ? 24 : 0,
        alignItems: 'start',
      }}>
        {/* Bar chart */}
        <div style={{ height: isDesktop ? 420 : undefined }}>
          <SectionTitle>Comparación</SectionTitle>

          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            {[["total","Por mes"],["por_tipo","Por tipo"]].map(([val, lbl]) => (
              <button key={val} onClick={() => setBarView(val)}
                style={{ padding: "7px 16px", borderRadius: 20, border: "2px solid", cursor: "pointer", fontFamily: FONT, fontSize: 12, fontWeight: 600,
                  borderColor: barView === val ? "#4F7FFA" : colors.inputBorder,
                  background: barView === val ? "#4F7FFA" : colors.card,
                  color: barView === val ? "#fff" : colors.textMuted }}>
                {lbl}
              </button>
            ))}
          </div>

          {barView === "por_tipo" && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", marginBottom: 8, gap: 8 }}>
              <button onClick={() => canGoPrev && setSelectedMonth(shiftMonth(selectedMonth, -1))} disabled={!canGoPrev}
                style={{ background: "none", border: "none", cursor: !canGoPrev ? "default" : "pointer", color: !canGoPrev ? colors.textSubtle : "#4F7FFA", fontSize: 18, padding: "0 4px" }}>←</button>
              <span style={{ fontSize: 13, fontWeight: 600, color: colors.text, fontFamily: FONT, minWidth: 70, textAlign: "center" }}>
                {barMonth ? new Date(barMonth + "-02").toLocaleString("es-AR", { month: "short", year: "2-digit" }) : "-"}
              </span>
              <button onClick={() => canGoNext && setSelectedMonth(shiftMonth(selectedMonth, 1))} disabled={!canGoNext}
                style={{ background: "none", border: "none", cursor: !canGoNext ? "default" : "pointer", color: !canGoNext ? colors.textSubtle : "#4F7FFA", fontSize: 18, padding: "0 4px" }}>→</button>
            </div>
          )}

          <Card>
            {last6.length === 0
              ? <p style={{ color: colors.textMuted, textAlign: "center", padding: 20, fontFamily: FONT }}>Sin datos aún</p>
              : <ResponsiveContainer width="100%" height={210}>
                  <BarChart data={barView === "total" ? barDataTotal : barDataTipoMonth} barCategoryGap="30%">
                    <XAxis dataKey="mes" tick={{ fontSize: 12, fill: colors.textMuted, fontFamily: FONT }} />
                    <YAxis tick={{ fontSize: 10, fill: colors.textMuted, fontFamily: FONT }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={v => fmt(v)} contentStyle={{ background: colors.card, border: "none", borderRadius: 12, fontFamily: FONT }} />
                    {barView === "total"
                      ? <Bar dataKey="Total" fill="#4F7FFA" radius={[6,6,0,0]} />
                      : <>
                          <Bar dataKey="Ordinario"      fill="#4F7FFA" radius={[6,6,0,0]} />
                          <Bar dataKey="Para mí"        fill="#2ecc71" radius={[6,6,0,0]} />
                          <Bar dataKey="Extraordinario" fill="#f39c12" radius={[6,6,0,0]} />
                          <Bar dataKey="Fijos"    fill="#9b59b6" radius={[6,6,0,0]} />
                        </>
                    }
                  </BarChart>
                </ResponsiveContainer>
            }
            {barView === "por_tipo" && (
              <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 6 }}>
                {[["#4F7FFA","Ordinario"],["#2ecc71","Para mí"],["#f39c12","Extraordinario"],["#9b59b6","Fijos"]].map(([col, lbl]) => (
                  <div key={lbl} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 3, background: col }} />
                    <span style={{ fontSize: 11, color: colors.textMuted, fontFamily: FONT }}>{lbl}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Pie chart */}
        <div style={{ height: isDesktop ? 420 : undefined }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, marginTop: 4 }}>
            <SectionTitle style={{ margin: 0 }}>Por categoría</SectionTitle>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button onClick={() => canGoPrev && setSelectedMonth(shiftMonth(selectedMonth, -1))} disabled={!canGoPrev}
                style={{ background: "none", border: "none", cursor: !canGoPrev ? "default" : "pointer", color: !canGoPrev ? colors.textSubtle : "#4F7FFA", fontSize: 18, padding: "0 4px" }}>←</button>
              <span style={{ fontSize: 13, fontWeight: 600, color: colors.text, fontFamily: FONT, minWidth: 60, textAlign: "center" }}>
                {pieMonth ? new Date(pieMonth + "-02").toLocaleString("es-AR", { month: "short", year: "2-digit" }) : "-"}
              </span>
              <button onClick={() => canGoNext && setSelectedMonth(shiftMonth(selectedMonth, 1))} disabled={!canGoNext}
                style={{ background: "none", border: "none", cursor: !canGoNext ? "default" : "pointer", color: !canGoNext ? colors.textSubtle : "#4F7FFA", fontSize: 18, padding: "0 4px" }}>→</button>
            </div>
          </div>

          <Card>
            {pieData.length === 0
              ? <p style={{ color: colors.textMuted, textAlign: "center", padding: 20, fontFamily: FONT }}>Sin datos para este mes</p>
              : <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" outerRadius={80} dataKey="value" labelLine={false} label={renderCustomLabel}>
                      {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip formatter={v => fmt(v)} contentStyle={{ background: colors.card, border: "none", borderRadius: 12, fontFamily: FONT }} />
                  </PieChart>
                </ResponsiveContainer>
            }
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6, justifyContent: "center" }}>
              {pieData.map(p => (
                <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: p.color }} />
                  <span style={{ fontSize: 11, color: colors.textMuted, fontFamily: FONT }}>{p.name}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
      {/* ── PRESUPUESTO POR CATEGORÍA ── */}
      {categoryBudgets && Object.keys(categoryBudgets).filter(k => k !== "_total" && categoryBudgets[k] > 0).length > 0 && (() => {
        const budgetCats = Object.keys(categoryBudgets)
          .filter(k => k !== "_total" && categoryBudgets[k] > 0)
          .map(catId => {
            const cat    = allCategories.find(c => c.id === catId);
            const budget = categoryBudgets[catId];
            const spent  = activeExpenses.filter(e => e.month === pieMonth && e.category === catId).reduce((s, e) => s + e.amount, 0);
            const pct    = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;
            const over80 = pct >= 80 && pct < 100;
            const over100 = pct >= 100;
            return { catId, cat, budget, spent, pct, over80, over100 };
          })
          .filter(b => b.cat); // solo categorías que existen

        const totalBudget = categoryBudgets._total || 0;
        const totalSpent  = activeExpenses.filter(e => e.month === pieMonth).reduce((s, e) => s + e.amount, 0);
        const totalPct    = totalBudget > 0 ? Math.min(100, (totalSpent / totalBudget) * 100) : 0;
        const totalOver80 = totalPct >= 80 && totalPct < 100;
        const totalOver100 = totalPct >= 100;

        return (
          <>
            <SectionTitle>Presupuesto</SectionTitle>
            {/* Presupuesto total */}
            {totalBudget > 0 && (
              <Card style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: colors.text, fontFamily: FONT }}>Total del mes</p>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, fontFamily: FONT,
                    color: totalOver100 ? "#e74c3c" : totalOver80 ? "#f39c12" : colors.textMuted }}>
                    {fmt(totalSpent)} / {fmt(totalBudget)}
                  </p>
                </div>
                {(totalOver80 || totalOver100) && (
                  <div style={{ background: totalOver100 ? "#e74c3c18" : "#f39c1218", borderRadius: 10, padding: "7px 12px", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 16 }}>{totalOver100 ? "🚨" : "⚠️"}</span>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 600, fontFamily: FONT,
                      color: totalOver100 ? "#e74c3c" : "#f39c12" }}>
                      {totalOver100 ? "Superaste el presupuesto mensual" : `Usaste el ${totalPct.toFixed(0)}% del presupuesto`}
                    </p>
                  </div>
                )}
                <div style={{ background: colors.divider, borderRadius: 6, height: 8, overflow: "hidden" }}>
                  <div style={{
                    height: 8, borderRadius: 6,
                    width: `${totalPct}%`,
                    background: totalOver100 ? "#e74c3c" : totalOver80 ? "#f39c12" : "#4F7FFA",
                    transition: "width 0.4s ease",
                  }} />
                </div>
                <p style={{ margin: "6px 0 0", fontSize: 11, color: colors.textMuted, fontFamily: FONT, textAlign: "right" }}>
                  {fmt(Math.max(0, totalBudget - totalSpent))} disponible
                </p>
              </Card>
            )}

            {/* Presupuesto por categoría */}
            <Card>
              {budgetCats.map((b, idx) => (
                <div key={b.catId} style={{ marginBottom: idx < budgetCats.length - 1 ? 16 : 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 18 }}>{b.cat?.icon}</span>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: colors.text, fontFamily: FONT }}>{b.cat?.label}</p>
                      {(b.over80 || b.over100) && (
                        <span style={{ fontSize: 14 }}>{b.over100 ? "🚨" : "⚠️"}</span>
                      )}
                    </div>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 700, fontFamily: FONT,
                      color: b.over100 ? "#e74c3c" : b.over80 ? "#f39c12" : colors.textMuted }}>
                      {fmt(b.spent)} / {fmt(b.budget)}
                    </p>
                  </div>
                  <div style={{ background: colors.divider, borderRadius: 4, height: 6, overflow: "hidden" }}>
                    <div style={{
                      height: 6, borderRadius: 4,
                      width: `${b.pct}%`,
                      background: b.over100 ? "#e74c3c" : b.over80 ? "#f39c12" : CAT_COLORS[idx % CAT_COLORS.length],
                      transition: "width 0.4s ease",
                    }} />
                  </div>
                </div>
              ))}
            </Card>
          </>
        );
      })()}

      <div style={{ height: 120 }} />
    </div>
  );
}