import { useState } from "react";
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

export default function GraficosScreen({ expenses, account, customCategories, fixedExpenses }) {
  const { colors } = useTheme();
  const fmt = (n) => formatAmount(n, account?.currency || "ARS");
  const allCategories = [...DEFAULT_CATEGORIES, ...(customCategories || [])];

  const activeExpenses = expenses.filter(e => !e.deleted);
  const allMonths = [...new Set(activeExpenses.map(e => e.month))].sort();
  const last6 = allMonths.slice(-6);
  const monthLabel = (m) => new Date(m + "-02").toLocaleString("es-AR", { month: "short" });

  const [barView, setBarView] = useState("total");
  const [pieMonthIdx, setPieMonthIdx] = useState(last6.length - 1);
  const [barMonthIdx, setBarMonthIdx] = useState(last6.length - 1);

  const pieMonth = last6[pieMonthIdx] || last6[last6.length - 1];
  const barMonth = last6[barMonthIdx] || last6[last6.length - 1];

  const barDataTotal = last6.map(m => ({
    mes: monthLabel(m),
    Total: activeExpenses.filter(e => e.month === m).reduce((s, e) => s + e.amount, 0),
  }));

  const barDataTipoMonth = [{
    mes: barMonth ? new Date(barMonth + "-02").toLocaleString("es-AR", { month: "short", year: "2-digit" }) : "-",
    Hogar:    activeExpenses.filter(e => e.month === barMonth && e.type === "hogar").reduce((s, e) => s + e.amount, 0),
    Personal: activeExpenses.filter(e => e.month === barMonth && e.type === "mio").reduce((s, e) => s + e.amount, 0),
    Extra:    activeExpenses.filter(e => e.month === barMonth && e.type === "extraordinary").reduce((s, e) => s + e.amount, 0),
    Fijos: (fixedExpenses || []).filter(f => {
      const start = (f.startDate || "2000-01").slice(0, 7);
      return barMonth >= start;
    }).reduce((s, f) => s + (f.amount || 0), 0),
  }];

  const pieData = allCategories.map((c, i) => ({
    name: c.label,
    value: activeExpenses.filter(e => e.month === pieMonth && e.category === c.id).reduce((s, e) => s + e.amount, 0),
    color: CAT_COLORS[i % CAT_COLORS.length],
  })).filter(c => c.value > 0);

  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
    if (percent < 0.07) return null;
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.55;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    return <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={700} fontFamily={FONT}>{`${(percent * 100).toFixed(0)}%`}</text>;
  };

  return (
    <div style={{ padding: "0 20px", paddingTop: "calc(env(safe-area-inset-top) + 76px)", fontFamily: FONT }}>
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
          <button onClick={() => setBarMonthIdx(i => Math.max(0, i - 1))} disabled={barMonthIdx === 0}
            style={{ background: "none", border: "none", cursor: barMonthIdx === 0 ? "default" : "pointer", color: barMonthIdx === 0 ? colors.textSubtle : "#4F7FFA", fontSize: 18, padding: "0 4px" }}>←</button>
          <span style={{ fontSize: 13, fontWeight: 600, color: colors.text, fontFamily: FONT, minWidth: 70, textAlign: "center" }}>
            {barMonth ? new Date(barMonth + "-02").toLocaleString("es-AR", { month: "short", year: "2-digit" }) : "-"}
          </span>
          <button onClick={() => setBarMonthIdx(i => Math.min(last6.length - 1, i + 1))} disabled={barMonthIdx === last6.length - 1}
            style={{ background: "none", border: "none", cursor: barMonthIdx === last6.length - 1 ? "default" : "pointer", color: barMonthIdx === last6.length - 1 ? colors.textSubtle : "#4F7FFA", fontSize: 18, padding: "0 4px" }}>→</button>
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
                      <Bar dataKey="Hogar"    fill="#4F7FFA" radius={[6,6,0,0]} />
                      <Bar dataKey="Personal" fill="#2ecc71" radius={[6,6,0,0]} />
                      <Bar dataKey="Extra"    fill="#f39c12" radius={[6,6,0,0]} />
                      <Bar dataKey="Fijos"    fill="#9b59b6" radius={[6,6,0,0]} />
                    </>
                }
              </BarChart>
            </ResponsiveContainer>
        }
        {barView === "por_tipo" && (
          <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 6 }}>
            {[["#4F7FFA","Hogar"],["#2ecc71","Personal"],["#f39c12","Extra"],["#9b59b6","Fijos"]].map(([col, lbl]) => (
              <div key={lbl} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: col }} />
                <span style={{ fontSize: 11, color: colors.textMuted, fontFamily: FONT }}>{lbl}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, marginTop: 4 }}>
        <SectionTitle style={{ margin: 0 }}>Por categoría</SectionTitle>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => setPieMonthIdx(i => Math.max(0, i - 1))} disabled={pieMonthIdx === 0}
            style={{ background: "none", border: "none", cursor: pieMonthIdx === 0 ? "default" : "pointer", color: pieMonthIdx === 0 ? colors.textSubtle : "#4F7FFA", fontSize: 18, padding: "0 4px" }}>←</button>
          <span style={{ fontSize: 13, fontWeight: 600, color: colors.text, fontFamily: FONT, minWidth: 60, textAlign: "center" }}>
            {pieMonth ? new Date(pieMonth + "-02").toLocaleString("es-AR", { month: "short", year: "2-digit" }) : "-"}
          </span>
          <button onClick={() => setPieMonthIdx(i => Math.min(last6.length - 1, i + 1))} disabled={pieMonthIdx === last6.length - 1}
            style={{ background: "none", border: "none", cursor: pieMonthIdx === last6.length - 1 ? "default" : "pointer", color: pieMonthIdx === last6.length - 1 ? colors.textSubtle : "#4F7FFA", fontSize: 18, padding: "0 4px" }}>→</button>
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
      <div style={{ height: 120 }} />
    </div>
  );
}