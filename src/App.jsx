import { useState, useEffect } from "react";
import { collection, addDoc, onSnapshot, deleteDoc, doc, query, orderBy } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { db, auth } from "./firebase";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import AuthScreen from "./AuthScreen";
import ConfigScreen from "./ConfigScreen";
import SettingsScreen from "./SettingsScreen";
import AccountSelectorScreen from "./AccountSelectorScreen";
import WelcomeScreen from "./WelcomeScreen";
import EditExpenseModal from "./EditExpenseModal";
import { NotifProvider, useNotif, NotifCenter, NOTIF_TYPES } from "./notifications";
import { useTheme, formatAmount, CURRENCIES } from "./theme.jsx";

const SF = `-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', sans-serif`;

const DEFAULT_CATEGORIES = [
  { id: "super", label: "Supermercado", icon: "🛒" },
  { id: "salidas", label: "Salidas", icon: "🍕" },
  { id: "servicios", label: "Impuestos y Servicios", icon: "💡" },
  { id: "transporte", label: "Transporte", icon: "🚗" },
  { id: "salud", label: "Salud", icon: "💊" },
  { id: "ropa", label: "Ropa y Calzado", icon: "👗" },
  { id: "hogar", label: "Hogar", icon: "🏠" },
  { id: "otros", label: "Otros", icon: "📦" },
];
const CAT_COLORS = ["#4F7FFA","#FA4F7F","#f39c12","#2ecc71","#9b59b6","#1abc9c","#e74c3c","#95a5a6"];
const getCurrentMonth = () => new Date().toISOString().slice(0, 7);

const NAV_ICONS = {
  home: (active, color) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? color : "#aaa"} strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/><path d="M9 21V12h6v9"/>
    </svg>
  ),
  gastos: (active, color) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? color : "#aaa"} strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9h10M7 13h6"/>
    </svg>
  ),
  saldos: (active, color) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? color : "#aaa"} strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v18M5 8l7-5 7 5M5 16l7 5 7-5"/>
    </svg>
  ),
  graficos: (active, color) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? color : "#aaa"} strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20V14M9 20V8M14 20v-5M19 20V4"/>
    </svg>
  ),
  ajustes: (active, color) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? color : "#aaa"} strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
    </svg>
  ),
};

const NAV = [
  { id: "home", label: "Inicio" },
  { id: "gastos", label: "Gastos" },
  { id: "saldos", label: "Saldos" },
  { id: "graficos", label: "Gráficos" },
  { id: "ajustes", label: "Ajustes" },
];

function calcSaldos(expenses, members, divisionSystem) {
  if (!members || members.length < 2) return {};
  const result = {};
  members.forEach(m => { result[m.uid] = { paid: 0, owes: 0 }; });
  const totalSalary = members.reduce((s, m) => s + (m.salary || 0), 0);
  expenses.forEach(e => {
    if (e.type === "hogar") {
      if (result[e.paidBy] !== undefined) result[e.paidBy].paid += e.amount;
      members.forEach(m => {
        const share = divisionSystem === "proportional" && totalSalary > 0
          ? e.amount * ((m.salary || 0) / totalSalary)
          : e.amount / members.length;
        if (result[m.uid] !== undefined) result[m.uid].owes += share;
      });
    }
    if (e.type === "personal") {
      if (result[e.paidBy] !== undefined) result[e.paidBy].paid += e.amount;
      if (e.forWhom && result[e.forWhom] !== undefined) result[e.forWhom].owes += e.amount;
    }
    if (e.type === "extraordinary") {
      members.forEach(m => {
        const paid = e[`paid_${m.uid}`] || 0;
        if (result[m.uid] !== undefined) { result[m.uid].paid += paid; result[m.uid].owes += e.amount / members.length; }
      });
    }
  });
  Object.keys(result).forEach(uid => { result[uid].balance = result[uid].paid - result[uid].owes; });
  return result;
}

function Card({ children, style = {} }) {
  const { colors } = useTheme();
  return <div style={{ background: colors.card, borderRadius: 20, padding: 18, marginBottom: 12, boxShadow: colors.shadow, border: `1px solid ${colors.cardBorder}`, ...style }}>{children}</div>;
}
function Tag({ color, children }) {
  return <span style={{ background: color + "22", color, fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20 }}>{children}</span>;
}
function SectionTitle({ children }) {
  const { colors } = useTheme();
  return <p style={{ fontSize: 20, fontWeight: 700, margin: "22px 0 10px", color: colors.text, fontFamily: SF }}>{children}</p>;
}
function StatPill({ label, value, color }) {
  const { colors } = useTheme();
  return <div style={{ background: color + "14", borderRadius: 14, padding: "12px 14px", flex: 1 }}><p style={{ margin: "0 0 3px", fontSize: 10, color, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</p><p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: colors.text }}>{value}</p></div>;
}
function Spinner({ text = "Cargando..." }) {
  const { colors } = useTheme();
  return <div style={{ textAlign: "center", padding: 60, color: colors.textMuted, fontSize: 14, fontFamily: SF }}>{text}</div>;
}

function AddExpenseModal({ onClose, onAdd, currentUser, members, currency, customCategories }) {
  const { colors } = useTheme();
  const otherMember = members?.find(m => m.uid !== currentUser.uid);
  const allCategories = [...DEFAULT_CATEGORIES, ...(customCategories || [])];
  const [form, setForm] = useState({ type: "hogar", concept: "", amount: "", category: "super", date: new Date().toISOString().slice(0, 10), paidBy: currentUser.uid, forWhom: otherMember?.uid || "", owner: currentUser.uid });
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const currSymbol = CURRENCIES[currency]?.symbol || "$";
  const labelStyle = { fontSize: 11, fontWeight: 600, color: colors.textMuted, marginBottom: 6, letterSpacing: 0.6, textTransform: "uppercase" };
  const inputStyle = { width: "100%", padding: "13px 14px", borderRadius: 14, border: `2px solid ${colors.inputBorder}`, fontSize: 15, marginBottom: 14, fontFamily: SF, outline: "none", boxSizing: "border-box", color: colors.inputText, background: colors.input };
  const handleAdd = async () => {
    if (!form.concept || !form.amount) return;
    setLoading(true);
    const amount = parseFloat(form.amount);
    const extra = {};
    if (form.type === "extraordinary" && members) { members.forEach(m => { extra[`paid_${m.uid}`] = m.uid === form.paidBy ? amount : 0; }); }
    await onAdd({ ...form, ...extra, amount, month: form.date.slice(0, 7) });
    setLoading(false); onClose();
  };
  const types = [["hogar","🏠 Hogar"],["personal","🎁 Para otro"],["extraordinary","⭐ Extra"],["mio","👤 Mío"]];
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 100, display: "flex", alignItems: "flex-end" }}>
      <div style={{ background: colors.card, borderRadius: "24px 24px 0 0", width: "100%", padding: "24px 20px 44px", maxHeight: "88vh", overflowY: "auto", fontFamily: SF }}>
        <div style={{ width: 36, height: 4, background: colors.divider, borderRadius: 2, margin: "0 auto 20px" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <span style={{ fontSize: 20, fontWeight: 700, color: colors.text }}>Nuevo Gasto</span>
          <button onClick={onClose} style={{ background: colors.pill, border: "none", borderRadius: 50, width: 32, height: 32, fontSize: 18, cursor: "pointer", color: colors.text }}>×</button>
        </div>
        <p style={labelStyle}>Tipo</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
          {types.map(([val, lbl]) => (
            <button key={val} onClick={() => set("type", val)} style={{ padding: "10px 8px", borderRadius: 12, border: "2px solid", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: SF, borderColor: form.type === val ? "#4F7FFA" : colors.inputBorder, background: form.type === val ? "#4F7FFA11" : colors.input, color: form.type === val ? "#4F7FFA" : colors.textMuted }}>{lbl}</button>
          ))}
        </div>
        <p style={labelStyle}>Concepto</p>
        <input value={form.concept} onChange={e => set("concept", e.target.value)} placeholder="Ej: Supermercado" style={inputStyle} />
        <p style={labelStyle}>Monto ({currSymbol})</p>
        <div style={{ position: "relative", marginBottom: 14 }}>
          <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: colors.textMuted, fontWeight: 600, fontSize: 15 }}>{currSymbol}</span>
          <input type="number" value={form.amount} onChange={e => set("amount", e.target.value)} placeholder="0" style={{ ...inputStyle, marginBottom: 0, paddingLeft: 36 }} />
        </div>
        <p style={labelStyle}>Categoría</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 16 }}>
          {allCategories.map(c => (
            <button key={c.id} onClick={() => set("category", c.id)} style={{ padding: "7px 12px", borderRadius: 12, border: "2px solid", fontSize: 12, cursor: "pointer", fontFamily: SF, borderColor: form.category === c.id ? "#4F7FFA" : colors.inputBorder, background: form.category === c.id ? "#4F7FFA11" : colors.input, color: form.category === c.id ? "#4F7FFA" : colors.text }}>{c.icon} {c.label}</button>
          ))}
        </div>
        <p style={labelStyle}>Fecha</p>
        <input type="date" value={form.date} onChange={e => set("date", e.target.value)} style={inputStyle} />
        {form.type !== "mio" && members && (<><p style={labelStyle}>Pagó</p><div style={{ display: "flex", gap: 8, marginBottom: 14 }}>{members.map(m => (<button key={m.uid} onClick={() => set("paidBy", m.uid)} style={{ flex: 1, padding: 12, borderRadius: 14, border: "2px solid", fontWeight: 600, cursor: "pointer", fontFamily: SF, borderColor: form.paidBy === m.uid ? (m.color||"#4F7FFA") : colors.inputBorder, background: form.paidBy === m.uid ? (m.color||"#4F7FFA") + "18" : colors.input, color: form.paidBy === m.uid ? (m.color||"#4F7FFA") : colors.textMuted }}>{m.name}</button>))}</div></>)}
        {form.type === "mio" && members && (<><p style={labelStyle}>¿De quién?</p><div style={{ display: "flex", gap: 8, marginBottom: 14 }}>{members.map(m => (<button key={m.uid} onClick={() => set("owner", m.uid)} style={{ flex: 1, padding: 12, borderRadius: 14, border: "2px solid", fontWeight: 600, cursor: "pointer", fontFamily: SF, borderColor: form.owner === m.uid ? (m.color||"#4F7FFA") : colors.inputBorder, background: form.owner === m.uid ? (m.color||"#4F7FFA") + "18" : colors.input, color: form.owner === m.uid ? (m.color||"#4F7FFA") : colors.textMuted }}>{m.name}</button>))}</div></>)}
        {form.type === "personal" && members && (<><p style={labelStyle}>Para...</p><div style={{ display: "flex", gap: 8, marginBottom: 14 }}>{members.map(m => (<button key={m.uid} onClick={() => set("forWhom", m.uid)} style={{ flex: 1, padding: 12, borderRadius: 14, border: "2px solid", fontWeight: 600, cursor: "pointer", fontFamily: SF, borderColor: form.forWhom === m.uid ? (m.color||"#4F7FFA") : colors.inputBorder, background: form.forWhom === m.uid ? (m.color||"#4F7FFA") + "18" : colors.input, color: form.forWhom === m.uid ? (m.color||"#4F7FFA") : colors.textMuted }}>{m.name}</button>))}</div></>)}
        <button onClick={handleAdd} disabled={loading} style={{ width: "100%", padding: 16, borderRadius: 16, background: loading ? "#aaa" : "linear-gradient(135deg,#4F7FFA,#3a6ae8)", color: "#fff", border: "none", fontSize: 16, fontWeight: 600, cursor: loading ? "default" : "pointer", fontFamily: SF, marginTop: 4 }}>
          {loading ? "Guardando..." : "Agregar ✓"}
        </button>
      </div>
    </div>
  );
}

function HomeScreen({ expenses, currentUser, members, account, currentMonth, customCategories }) {
  const { colors } = useTheme();
  const currency = account?.currency || "ARS";
  const fmt = (n) => formatAmount(n, currency);
  const me = members?.find(m => m.uid === currentUser.uid);
  const meColor = me?.color || "#4F7FFA";
  const allCategories = [...DEFAULT_CATEGORIES, ...(customCategories || [])];
  const monthExp = expenses.filter(e => e.month === currentMonth);
  const sharedExp = monthExp.filter(e => e.type !== "mio");
  const saldos = calcSaldos(sharedExp, members, account?.divisionSystem);
  const myBalance = saldos[currentUser.uid]?.balance || 0;
  const myPersonalTotal = monthExp.filter(e => e.type === "mio" && e.owner === currentUser.uid).reduce((s, e) => s + e.amount, 0);
  const recent = [...monthExp].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  const catTotals = allCategories.map(c => ({ ...c, total: monthExp.filter(e => e.category === c.id).reduce((s, e) => s + e.amount, 0) })).filter(c => c.total > 0).sort((a, b) => b.total - a.total).slice(0, 4);
  const monthLabel = new Date(currentMonth + "-02").toLocaleString("es-AR", { month: "long", year: "numeric" });
  return (
    <div style={{ fontFamily: SF }}>
      <div style={{ background: colors.headerBg, borderRadius: "0 0 32px 32px", padding: "52px 20px 28px" }}>
        <p style={{ color: "#ffffff33", fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", margin: "0 0 14px" }}>X-penses · {account?.name || ""}</p>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
          {me?.photo ? <img src={me.photo} style={{ width: 44, height: 44, borderRadius: 22, border: "2px solid #ffffff44" }} alt="" /> : <div style={{ width: 44, height: 44, borderRadius: 22, background: meColor+"44", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>👤</div>}
          <div><p style={{ color: "#ffffff88", fontSize: 12, margin: 0 }}>Hola,</p><p style={{ color: "#fff", fontSize: 22, fontWeight: 700, margin: 0 }}>{me?.name || currentUser.displayName}</p></div>
        </div>
        <div style={{ background: meColor, borderRadius: 22, padding: 20 }}>
          <p style={{ color: "#ffffff88", fontSize: 11, margin: "0 0 6px", fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase" }}>Saldo — {monthLabel}</p>
          <p style={{ color: "#fff", fontSize: 36, fontWeight: 700, margin: "0 0 4px", letterSpacing: -1 }}>{myBalance >= 0 ? "+" : ""}{fmt(myBalance)}</p>
          <p style={{ color: "#ffffff88", fontSize: 12, margin: 0 }}>{myBalance >= 0 ? "✅ Te deben a vos" : "⚠️ Debés este monto"}</p>
        </div>
      </div>
      <div style={{ padding: "0 20px" }}>
        <SectionTitle>Resumen del mes</SectionTitle>
        <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
          <StatPill label="Compartido" value={fmt(sharedExp.reduce((s,e)=>s+e.amount,0))} color="#4F7FFA" />
          <StatPill label="Mis gastos" value={fmt(myPersonalTotal)} color={meColor} />
        </div>
        {catTotals.length > 0 && <><SectionTitle>Top categorías</SectionTitle>{catTotals.map(c => (
          <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
            <span style={{ fontSize: 22, width: 30 }}>{c.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: colors.text }}>{c.label}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: colors.text }}>{fmt(c.total)}</span>
              </div>
              <div style={{ background: colors.divider, borderRadius: 4, height: 5 }}>
                <div style={{ background: "#4F7FFA", borderRadius: 4, height: 5, width: `${Math.min(100,(c.total/catTotals[0].total)*100)}%` }} />
              </div>
            </div>
          </div>
        ))}</>}
        <SectionTitle>Últimos movimientos</SectionTitle>
        {recent.length === 0 && <Card style={{ textAlign: "center", color: colors.textMuted, padding: 32 }}><p style={{ fontSize: 32, margin: "0 0 8px" }}>📭</p><p style={{ margin: 0 }}>Sin gastos este mes</p></Card>}
        {recent.map(e => {
          const cat = allCategories.find(c => c.id === e.category);
          const who = e.type === "mio" ? members?.find(m=>m.uid===e.owner) : members?.find(m=>m.uid===e.paidBy);
          return (
            <Card key={e.id} style={{ padding: "14px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 22 }}>{cat?.icon}</span>
                  <div><p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: colors.text }}>{e.concept}</p><p style={{ margin: "2px 0 0", fontSize: 11, color: colors.textMuted }}>{e.date} · {who?.name}</p></div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ margin: "0 0 4px", fontWeight: 700, fontSize: 15, color: colors.text }}>{fmt(e.amount)}</p>
                  <Tag color={e.type==="hogar"?"#4F7FFA":e.type==="personal"?"#FA4F7F":e.type==="extraordinary"?"#f39c12":"#2ecc71"}>{e.type==="hogar"?"Hogar":e.type==="personal"?"Para otro":e.type==="extraordinary"?"Extra":"Mío"}</Tag>
                </div>
              </div>
            </Card>
          );
        })}
        <div style={{ height: 100 }} />
      </div>
    </div>
  );
}

function GastosScreen({ expenses, members, currentMonth, onEdit, onDelete, account, customCategories }) {
  const { colors } = useTheme();
  const fmt = (n) => formatAmount(n, account?.currency || "ARS");
  const allCategories = [...DEFAULT_CATEGORIES, ...(customCategories || [])];
  const [filterType, setFilterType] = useState("todos");
  const monthExp = expenses.filter(e => e.month === currentMonth);
  const filtered = filterType === "todos" ? monthExp : monthExp.filter(e => e.type === filterType);
  const sorted = [...filtered].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <div style={{ padding: "0 20px", fontFamily: SF }}>
      <SectionTitle>Todos los gastos</SectionTitle>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, overflowX: "auto", paddingBottom: 4 }}>
        {[["todos","Todos"],["hogar","🏠"],["personal","🎁"],["extraordinary","⭐"],["mio","👤"]].map(([val, lbl]) => (
          <button key={val} onClick={() => setFilterType(val)} style={{ whiteSpace: "nowrap", padding: "8px 14px", borderRadius: 20, border: "2px solid", cursor: "pointer", fontFamily: SF, fontSize: 12, fontWeight: 600, borderColor: filterType === val ? "#4F7FFA" : colors.inputBorder, background: filterType === val ? "#4F7FFA" : colors.card, color: filterType === val ? "#fff" : colors.textMuted }}>{lbl}</button>
        ))}
      </div>
      {sorted.length === 0 && <Card style={{ textAlign: "center", color: colors.textMuted, padding: 32 }}><p style={{ fontSize: 32, margin: "0 0 8px" }}>📭</p><p style={{ margin: 0 }}>Sin gastos</p></Card>}
      {sorted.map(e => {
        const cat = allCategories.find(c => c.id === e.category);
        const who = e.type === "mio" ? members?.find(m=>m.uid===e.owner) : members?.find(m=>m.uid===e.paidBy);
        return (
          <Card key={e.id} style={{ padding: "14px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
                <span style={{ fontSize: 22 }}>{cat?.icon}</span>
                <div><p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: colors.text }}>{e.concept}</p><p style={{ margin: "2px 0 4px", fontSize: 11, color: colors.textMuted }}>{e.date} · {who?.name}</p><Tag color={e.type==="hogar"?"#4F7FFA":e.type==="personal"?"#FA4F7F":e.type==="extraordinary"?"#f39c12":"#2ecc71"}>{e.type==="hogar"?"Hogar":e.type==="personal"?"Para otro":e.type==="extraordinary"?"Extra":"Mío"}</Tag></div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: colors.text }}>{fmt(e.amount)}</p>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => onEdit(e)} style={{ background: "#4F7FFA18", border: "none", borderRadius: 8, padding: "5px 10px", fontSize: 11, color: "#4F7FFA", cursor: "pointer", fontFamily: SF, fontWeight: 600 }}>✏️</button>
                  <button onClick={() => onDelete(e.id)} style={{ background: colors.dangerBg, border: "none", borderRadius: 8, padding: "5px 10px", fontSize: 11, color: colors.danger, cursor: "pointer", fontFamily: SF }}>✕</button>
                </div>
              </div>
            </div>
          </Card>
        );
      })}
      <div style={{ height: 100 }} />
    </div>
  );
}

function MisGastosScreen({ expenses, currentUser, members, currentMonth, account, customCategories }) {
  const { colors } = useTheme();
  const fmt = (n) => formatAmount(n, account?.currency || "ARS");
  const allCategories = [...DEFAULT_CATEGORIES, ...(customCategories || [])];
  const me = members?.find(m => m.uid === currentUser.uid);
  const meColor = me?.color || "#FA4F7F";
  const myExp = expenses.filter(e => e.type === "mio" && e.owner === currentUser.uid && e.month === currentMonth);
  const total = myExp.reduce((s, e) => s + e.amount, 0);
  const catTotals = allCategories.map((c, i) => ({ ...c, total: myExp.filter(e => e.category === c.id).reduce((s, e) => s + e.amount, 0), color: CAT_COLORS[i % CAT_COLORS.length] })).filter(c => c.total > 0);
  return (
    <div style={{ padding: "0 20px", fontFamily: SF }}>
      <SectionTitle>Mis gastos personales</SectionTitle>
      <Card style={{ background: `linear-gradient(135deg, ${meColor}ee, ${meColor}88)`, border: "none" }}>
        <p style={{ color: "#ffffff88", fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", margin: "0 0 6px" }}>Total personal este mes</p>
        <p style={{ color: "#fff", fontSize: 32, fontWeight: 700, margin: 0, letterSpacing: -1 }}>{fmt(total)}</p>
        <p style={{ color: "#ffffff88", fontSize: 12, margin: "6px 0 0" }}>{myExp.length} gasto{myExp.length !== 1 ? "s" : ""}</p>
      </Card>
      {catTotals.length > 0 && <Card><ResponsiveContainer width="100%" height={180}><PieChart><Pie data={catTotals} cx="50%" cy="50%" outerRadius={75} dataKey="total" label={({ percent }) => `${(percent*100).toFixed(0)}%`} labelLine={false}>{catTotals.map((e, i) => <Cell key={i} fill={e.color} />)}</Pie><Tooltip formatter={v => fmt(v)} /></PieChart></ResponsiveContainer><div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8, justifyContent: "center" }}>{catTotals.map(c => <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 8, height: 8, borderRadius: 2, background: c.color }} /><span style={{ fontSize: 11, color: colors.textMuted }}>{c.label}</span></div>)}</div></Card>}
      {[...myExp].sort((a,b) => b.date.localeCompare(a.date)).map(e => {
        const cat = allCategories.find(c => c.id === e.category);
        return <Card key={e.id} style={{ padding: "14px 16px" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><div style={{ display: "flex", alignItems: "center", gap: 10 }}><div style={{ width: 40, height: 40, borderRadius: 14, background: meColor+"18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{cat?.icon}</div><div><p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: colors.text }}>{e.concept}</p><p style={{ margin: "2px 0 0", fontSize: 11, color: colors.textMuted }}>{e.date}</p></div></div><p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: meColor }}>{fmt(e.amount)}</p></div></Card>;
      })}
      <div style={{ height: 100 }} />
    </div>
  );
}

function SaldosScreen({ expenses, members, account, currentMonth }) {
  const { colors } = useTheme();
  const { sendNotification } = useNotif();
  const fmt = (n) => formatAmount(n, account?.currency || "ARS");
  const monthExp = expenses.filter(e => e.month === currentMonth && e.type !== "mio");
  const saldos = calcSaldos(monthExp, members, account?.divisionSystem);
  const [settled, setSettled] = useState(false);
  const handleSettle = async () => {
    setSettled(true);
    const otherMembers = members?.filter(m => m.uid !== members[0]?.uid) || [];
    await sendNotification({ type: NOTIF_TYPES.ACCOUNT_SETTLED, title: "¡Cuentas saldadas! 🎉", body: `Las cuentas de ${new Date(currentMonth + "-02").toLocaleString("es-AR", { month: "long" })} fueron saldadas.`, fromName: members[0]?.name || "Un miembro", toUids: otherMembers.map(m => m.uid), accountId: account?.id });
  };
  const debtSummary = () => {
    if (!members || members.length < 2) return "Configurá los miembros para ver saldos";
    const balances = members.map(m => ({ ...m, balance: saldos[m.uid]?.balance || 0 }));
    const creditor = balances.find(m => m.balance > 0);
    const debtor = balances.find(m => m.balance < 0);
    if (!creditor || !debtor) return "¡Están al día! 🎉";
    return `${debtor.name} le debe ${fmt(Math.abs(debtor.balance))} a ${creditor.name}`;
  };
  return (
    <div style={{ padding: "0 20px", fontFamily: SF }}>
      <SectionTitle>Saldos del mes</SectionTitle>
      {members?.map(m => {
        const s = saldos[m.uid] || { paid: 0, owes: 0, balance: 0 };
        const totalSalary = members.reduce((acc, mb) => acc + (mb.salary || 0), 0);
        const pct = totalSalary > 0 ? ((m.salary || 0) / totalSalary * 100).toFixed(0) : 50;
        return (
          <Card key={m.uid}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              {m.photo ? <img src={m.photo} style={{ width: 44, height: 44, borderRadius: 22 }} alt="" /> : <div style={{ width: 44, height: 44, borderRadius: 22, background: (m.color||"#4F7FFA")+"22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>👤</div>}
              <div><p style={{ margin: 0, fontWeight: 700, fontSize: 16, color: colors.text }}>{m.name}</p><p style={{ margin: 0, fontSize: 12, color: colors.textMuted }}>{fmt(m.salary)} · {pct}% del hogar</p></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
              <div style={{ background: "#4F7FFA14", borderRadius: 12, padding: 12 }}><p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: colors.textMuted, letterSpacing: 0.5, textTransform: "uppercase" }}>Pagó</p><p style={{ margin: 0, fontWeight: 700, fontSize: 16, color: colors.text }}>{fmt(s.paid)}</p></div>
              <div style={{ background: "#4F7FFA14", borderRadius: 12, padding: 12 }}><p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: colors.textMuted, letterSpacing: 0.5, textTransform: "uppercase" }}>Le toca</p><p style={{ margin: 0, fontWeight: 700, fontSize: 16, color: colors.text }}>{fmt(s.owes)}</p></div>
            </div>
            <div style={{ background: s.balance >= 0 ? colors.successBg : colors.dangerBg, borderRadius: 14, padding: 14, textAlign: "center" }}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 22, color: s.balance >= 0 ? colors.success : colors.danger }}>{s.balance >= 0 ? "+" : ""}{fmt(s.balance)}</p>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: colors.textMuted }}>{s.balance >= 0 ? "A favor" : "A pagar"}</p>
            </div>
          </Card>
        );
      })}
      <Card style={{ background: colors.headerBg, border: "none" }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: "#ffffff55", letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 8 }}>Conclusión</p>
        <p style={{ color: "#fff", fontSize: 15, fontWeight: 600, margin: 0 }}>{debtSummary()}</p>
        {!settled ? (
          <button onClick={handleSettle} style={{ marginTop: 16, width: "100%", padding: 14, borderRadius: 14, background: "#4F7FFA", color: "#fff", border: "none", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: SF }}>✅ Saldar cuentas</button>
        ) : (
          <div style={{ marginTop: 14, background: "#2ecc7122", borderRadius: 12, padding: 14, textAlign: "center" }}><p style={{ color: "#2ecc71", fontWeight: 700, margin: 0 }}>¡Cuentas saldadas! 🎉</p></div>
        )}
      </Card>
      <div style={{ height: 100 }} />
    </div>
  );
}

function GraficosScreen({ expenses, account }) {
  const { colors } = useTheme();
  const fmt = (n) => formatAmount(n, account?.currency || "ARS");
  const allMonths = [...new Set(expenses.map(e => e.month))].sort();
  const last3 = allMonths.slice(-3);
  const monthLabel = (m) => new Date(m + "-02").toLocaleString("es-AR", { month: "short" });
  const barData = last3.map(m => ({ mes: monthLabel(m), Hogar: expenses.filter(e=>e.month===m&&e.type==="hogar").reduce((s,e)=>s+e.amount,0), Personal: expenses.filter(e=>e.month===m&&e.type==="mio").reduce((s,e)=>s+e.amount,0), Extra: expenses.filter(e=>e.month===m&&e.type==="extraordinary").reduce((s,e)=>s+e.amount,0) }));
  const lastMonth = last3[last3.length - 1];
  const pieData = DEFAULT_CATEGORIES.map((c,i)=>({ name:c.label, value:expenses.filter(e=>e.month===lastMonth&&e.category===c.id).reduce((s,e)=>s+e.amount,0), color:CAT_COLORS[i] })).filter(c=>c.value>0);
  return (
    <div style={{ padding: "0 20px", fontFamily: SF }}>
      <SectionTitle>Comparación mensual</SectionTitle>
      <Card>
        {barData.length === 0 ? <p style={{ color: colors.textMuted, textAlign: "center", padding: 20 }}>Sin datos aún</p> : <ResponsiveContainer width="100%" height={210}><BarChart data={barData} barCategoryGap="30%"><XAxis dataKey="mes" tick={{ fontSize: 12, fill: colors.textMuted }} /><YAxis tick={{ fontSize: 10, fill: colors.textMuted }} tickFormatter={v=>`${(v/1000).toFixed(0)}k`} /><Tooltip formatter={v=>fmt(v)} contentStyle={{ background: colors.card, border: "none", borderRadius: 12 }} /><Bar dataKey="Hogar" fill="#4F7FFA" radius={[6,6,0,0]} /><Bar dataKey="Personal" fill="#2ecc71" radius={[6,6,0,0]} /><Bar dataKey="Extra" fill="#f39c12" radius={[6,6,0,0]} /></BarChart></ResponsiveContainer>}
        <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 6 }}>{[["#4F7FFA","Hogar"],["#2ecc71","Personal"],["#f39c12","Extra"]].map(([col,lbl])=><div key={lbl} style={{ display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 10, height: 10, borderRadius: 3, background: col }} /><span style={{ fontSize: 11, color: colors.textMuted }}>{lbl}</span></div>)}</div>
      </Card>
      <SectionTitle>Por categoría — último mes</SectionTitle>
      <Card>
        {pieData.length === 0 ? <p style={{ color: colors.textMuted, textAlign: "center", padding: 20 }}>Sin datos aún</p> : <ResponsiveContainer width="100%" height={200}><PieChart><Pie data={pieData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({percent})=>`${(percent*100).toFixed(0)}%`} labelLine={false}>{pieData.map((e,i)=><Cell key={i} fill={e.color} />)}</Pie><Tooltip formatter={v=>fmt(v)} contentStyle={{ background: colors.card, border: "none", borderRadius: 12 }} /></PieChart></ResponsiveContainer>}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6, justifyContent: "center" }}>{pieData.map(p=><div key={p.name} style={{ display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 8, height: 8, borderRadius: 2, background: p.color }} /><span style={{ fontSize: 11, color: colors.textMuted }}>{p.name}</span></div>)}</div>
      </Card>
      <div style={{ height: 100 }} />
    </div>
  );
}

function AppInner() {
  const { colors } = useTheme();
  const { unreadCount } = useNotif();
  const [authUser, setAuthUser] = useState(undefined);
  const [userProfile, setUserProfile] = useState(null);
  const [account, setAccount] = useState(null);
  const [members, setMembers] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [customCategories, setCustomCategories] = useState([]);
  const [tab, setTab] = useState("home");
  const [showAdd, setShowAdd] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [showNotifs, setShowNotifs] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState(null);
  const [userAccounts, setUserAccounts] = useState([]);
  const [showWelcome, setShowWelcome] = useState(true);
  const currentMonth = getCurrentMonth();

  useEffect(() => { return onAuthStateChanged(auth, user => setAuthUser(user || null)); }, []);
  useEffect(() => { if (!authUser) return; return onSnapshot(doc(db, "users", authUser.uid), snap => { setUserProfile(snap.exists() ? snap.data() : null); }); }, [authUser]);
  useEffect(() => {
    if (!authUser) return;
    return onSnapshot(doc(db, "users", authUser.uid), snap => {
      const data = snap.data();
      const ids = data?.accountIds || [authUser.uid];
      const unsubs = ids.map(id => onSnapshot(doc(db, "accounts", id), aSnap => {
        if (aSnap.exists()) setUserAccounts(prev => { const filtered = prev.filter(a => a.id !== id); return [...filtered, { id: aSnap.id, ...aSnap.data() }]; });
      }));
      return () => unsubs.forEach(u => u());
    });
  }, [authUser]);
  useEffect(() => {
    if (!selectedAccountId || userAccounts.length === 0) return;
    const acc = userAccounts.find(a => a.id === selectedAccountId);
    if (acc) setAccount(acc);
  }, [selectedAccountId, userAccounts]);
  useEffect(() => {
    if (!account?.memberIds) return;
    const ids = [...account.memberIds];
    const unsubs = ids.map(uid => onSnapshot(doc(db, "users", uid), snap => { if (snap.exists()) setMembers(prev => [...prev.filter(m => m.uid !== uid), { uid, ...snap.data() }]); }));
    return () => unsubs.forEach(u => u());
  }, [account?.memberIds?.join(",")]);
  useEffect(() => { if (!authUser) return; const q = query(collection(db, "expenses"), orderBy("date", "desc")); return onSnapshot(q, snap => { setExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() }))); }); }, [authUser]);
  useEffect(() => { if (!account?.id) return; return onSnapshot(collection(db, "accounts", account.id, "categories"), snap => { setCustomCategories(snap.docs.map(d => ({ id: d.id, ...d.data() }))); }); }, [account?.id]);

  const { sendNotification } = useNotif();

  const addExpense = async (e) => {
    await addDoc(collection(db, "expenses"), { ...e, createdBy: authUser.uid, accountId: account?.id });
    const otherMembers = members?.filter(m => m.uid !== authUser.uid) || [];
    const myName = members?.find(m => m.uid === authUser.uid)?.name || "Alguien";
    if (otherMembers.length > 0) {
      await sendNotification({ type: NOTIF_TYPES.EXPENSE_ADDED, title: `Nuevo gasto: ${e.concept}`, body: `${myName} agregó ${formatAmount(e.amount, account?.currency || "ARS")}`, fromName: myName, toUids: otherMembers.map(m => m.uid), accountId: account?.id });
    }
  };

  const deleteExpense = async (id) => { await deleteDoc(doc(db, "expenses", id)); };
  const handleSignOut = async () => { await signOut(auth); setUserProfile(null); setAccount(null); setMembers([]); setShowWelcome(true); };

  if (authUser === undefined) return <Spinner text="Iniciando X-penses..." />;
  if (showWelcome) return <WelcomeScreen onEnter={() => setShowWelcome(false)} />;
  if (!authUser) return <AuthScreen />;
  if (!userProfile?.setupDone) return <ConfigScreen user={authUser} onDone={() => {}} />;
  if (!selectedAccountId) return <AccountSelectorScreen user={authUser} accounts={userAccounts} onSelect={setSelectedAccountId} onCreated={setSelectedAccountId} />;

return (
    <div style={{
      width: "100%",
      maxWidth: 500,
      margin: "0 auto",
      background: colors.bg,
      minHeight: "100dvh",
      position: "relative",
      fontFamily: SF,
      paddingTop: "env(safe-area-inset-top)",
      paddingLeft: "env(safe-area-inset-left)",
      paddingRight: "env(safe-area-inset-right)",
      boxSizing: "border-box",
      overflowX: "hidden",
    }}>
      <style>{`
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { display: none; }
        html, body, #root {
          width: 100%;
          min-height: 100dvh;
          margin: 0;
          padding: 0;
          background: ${colors.bg};
        }
      `}</style>

      {/* Botón notificaciones */}
      <button onClick={() => setShowNotifs(true)} style={{
        position: "fixed", top: "calc(14px + env(safe-area-inset-top))", right: 14,
        zIndex: 60, background: colors.card, border: `1px solid ${colors.cardBorder}`,
        borderRadius: 20, width: 40, height: 40, display: "flex", alignItems: "center",
        justifyContent: "center", cursor: "pointer", boxShadow: colors.shadow
      }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors.text} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/>
        </svg>
        {unreadCount > 0 && (
          <div style={{ position: "absolute", top: 6, right: 6, width: 14, height: 14, borderRadius: 7, background: "#FA4F7F", border: `2px solid ${colors.card}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 8, color: "#fff", fontWeight: 700 }}>{unreadCount > 9 ? "9+" : unreadCount}</span>
          </div>
        )}
      </button>

      {/* Contenido principal */}
      <div style={{ paddingBottom: 80, minHeight: "100dvh" }}>
        {tab === "home"      && <HomeScreen expenses={expenses} currentUser={authUser} members={members} account={account} currentMonth={currentMonth} customCategories={customCategories} />}
        {tab === "gastos"    && <GastosScreen expenses={expenses} members={members} currentMonth={currentMonth} onEdit={setEditingExpense} onDelete={deleteExpense} account={account} customCategories={customCategories} />}
        {tab === "misgastos" && <MisGastosScreen expenses={expenses} currentUser={authUser} members={members} currentMonth={currentMonth} account={account} customCategories={customCategories} />}
        {tab === "saldos"    && <SaldosScreen expenses={expenses} members={members} account={account} currentMonth={currentMonth} />}
        {tab === "graficos"  && <GraficosScreen expenses={expenses} account={account} />}
        {tab === "ajustes"   && <SettingsScreen currentUser={authUser} userProfile={userProfile} account={account} members={members} onSignOut={handleSignOut} onSwitchAccount={() => setSelectedAccountId(null)} />}
      </div>

      {/* Botón + agregar gasto */}
      {tab !== "ajustes" && (
        <button onClick={() => setShowAdd(true)} style={{
          position: "fixed", bottom: "calc(88px + env(safe-area-inset-bottom))", right: 16,
          width: 54, height: 54, borderRadius: 27,
          background: "linear-gradient(135deg,#4F7FFA,#3a6ae8)",
          border: "none", color: "#fff", fontSize: 28, cursor: "pointer",
          boxShadow: "0 4px 20px #4F7FFA77",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50
        }}>+</button>
      )}

      {/* Barra de navegación inferior */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        width: "100%", maxWidth: 500, margin: "0 auto",
        background: colors.navBg, borderTop: `1px solid ${colors.navBorder}`,
        display: "flex", padding: `10px 0 calc(20px + env(safe-area-inset-bottom))`,
        zIndex: 40, boxShadow: "0 -4px 20px rgba(0,0,0,0.08)"
      }}>
        {NAV.map(n => (
          <button key={n.id} onClick={() => setTab(n.id)} style={{ flex: 1, background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, fontFamily: SF, padding: "2px 0" }}>
            {NAV_ICONS[n.id]?.(tab === n.id, "#4F7FFA")}
            <span style={{ fontSize: 9, fontWeight: tab === n.id ? 700 : 500, letterSpacing: 0.2, color: tab === n.id ? "#4F7FFA" : colors.textSubtle, textTransform: "uppercase" }}>{n.label}</span>
          </button>
        ))}
      </div>

      {/* Modales */}
      {showAdd       && <AddExpenseModal onClose={() => setShowAdd(false)} onAdd={addExpense} currentUser={authUser} members={members} currency={account?.currency || "ARS"} customCategories={customCategories} />}
      {editingExpense && <EditExpenseModal expense={editingExpense} members={members} onClose={() => setEditingExpense(null)} />}
      {showNotifs    && <NotifCenter onClose={() => setShowNotifs(false)} />}
    </div>
  );
}

export default function App() {
  const [authUser, setAuthUser] = useState(undefined);
  const [accountId, setAccountId] = useState(null);
  useEffect(() => { return onAuthStateChanged(auth, user => { setAuthUser(user || null); setAccountId(user?.uid || null); }); }, []);
  return (
    <NotifProvider currentUser={authUser} accountId={accountId}>
      <AppInner />
    </NotifProvider>
  );
}
