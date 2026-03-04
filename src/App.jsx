import { useState, useEffect, useRef } from "react";
import { collection, addDoc, onSnapshot, deleteDoc, doc, query, orderBy, getDoc, updateDoc, setDoc } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { db, auth } from "./firebase";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import AuthScreen from "./AuthScreen";
import ConfigScreen from "./ConfigScreen";
import SettingsScreen from "./SettingsScreen";
import AccountSelectorScreen from "./AccountSelectorScreen";
import WelcomeScreen from "./WelcomeScreen";
import EditExpenseModal from "./EditExpenseModal";
import DateInput from "./DateInput";
import { NotifProvider, useNotif, NotifCenter, NOTIF_TYPES } from "./notifications";
import { useTheme, formatAmount, CURRENCIES } from "./theme.jsx";

const FONT = `'DM Sans', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif`;
const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');`;

// Altura del header fijo para calcular paddingTop de cada sección
const HEADER_HEIGHT = 90;
// Altura de la nav bar
const NAV_HEIGHT = 72;

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

// Tamaños de fuente
const FONT_SIZE_MAP = { small: { base: 12, sub: 10, title: 18 }, medium: { base: 14, sub: 12, title: 20 }, large: { base: 17, sub: 14, title: 22 } };

function useExpenseFontSize() {
  const [size, setSize] = useState(() => localStorage.getItem("expenseFontSize") || "medium");
  useEffect(() => {
    const handler = (e) => setSize(e.detail);
    window.addEventListener("expenseFontSizeChange", handler);
    return () => window.removeEventListener("expenseFontSizeChange", handler);
  }, []);
  return FONT_SIZE_MAP[size] || FONT_SIZE_MAP.medium;
}

// ── Ícono hamburger ──
function MenuIcon({ color = "#ffffffcc" }) {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <rect x="1.5" y="1.5" width="25" height="25" rx="7" stroke={color} strokeWidth="2"/>
      <line x1="7" y1="9.5" x2="21" y2="9.5" stroke={color} strokeWidth="2" strokeLinecap="round"/>
      <line x1="7" y1="14" x2="21" y2="14" stroke={color} strokeWidth="2" strokeLinecap="round"/>
      <line x1="7" y1="18.5" x2="21" y2="18.5" stroke={color} strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

function NavIcon({ id, active, color }) {
  const s = active ? 2 : 1.5;
  const c = active ? color : "#aaa";
  if (id === "home") return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={s} strokeLinecap="round" strokeLinejoin="round"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/><path d="M9 21V12h6v9"/></svg>;
  if (id === "saldos") return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={s} strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v18M5 8l7-5 7 5M5 16l7 5 7-5"/></svg>;
  if (id === "graficos") return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={s} strokeLinecap="round" strokeLinejoin="round"><path d="M4 20V14M9 20V8M14 20v-5M19 20V4"/></svg>;
  if (id === "ajustes") return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={s} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>;
  return null;
}

function calcSaldos(expenses, members, divisionSystem) {
  if (!members || members.length < 2) return {};
  const result = {};
  members.forEach(m => { result[m.uid] = { paid: 0, owes: 0 }; });
  const totalSalary = members.reduce((s, m) => s + (m.salary || 0), 0);
  expenses.forEach(e => {
    if (e.type === "hogar") {
      if (result[e.paidBy] !== undefined) result[e.paidBy].paid += e.amount;
      members.forEach(m => {
        const share = divisionSystem === "proportional" && totalSalary > 0 ? e.amount * ((m.salary || 0) / totalSalary) : e.amount / members.length;
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
  return <span style={{ background: color + "22", color, fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20, fontFamily: FONT }}>{children}</span>;
}
function SectionTitle({ children, style = {} }) {
  const { colors } = useTheme();
  return <p style={{ fontSize: 20, fontWeight: 700, margin: "22px 0 10px", color: colors.text, fontFamily: FONT, ...style }}>{children}</p>;
}
function StatPill({ label, value, color }) {
  const { colors } = useTheme();
  return <div style={{ background: color + "14", borderRadius: 14, padding: "12px 14px", flex: 1 }}><p style={{ margin: "0 0 3px", fontSize: 10, color, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, fontFamily: FONT }}>{label}</p><p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: colors.text, fontFamily: FONT }}>{value}</p></div>;
}
function Spinner({ text = "Cargando..." }) {
  const { colors } = useTheme();
  return <div style={{ textAlign: "center", padding: 60, color: colors.textMuted, fontSize: 14, fontFamily: FONT }}>{text}</div>;
}

// ── HEADER FIJO UNIFICADO ──
function AppHeader({ account, onMenuOpen, onNotifsOpen, unreadCount, colors }) {
  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 60,
      maxWidth: 500, margin: "0 auto",
      background: colors.headerBg,
      paddingTop: "calc(env(safe-area-inset-top) + 10px)",
      paddingBottom: 12, paddingLeft: 16, paddingRight: 16,
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        background: "rgba(255,255,255,0.07)",
        border: "1px solid rgba(255,255,255,0.13)",
        borderRadius: 20, padding: "12px 14px",
      }}>
        <button onClick={onMenuOpen} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", flexShrink: 0 }}>
          <MenuIcon />
        </button>
        <div style={{ flex: 1 }}>
          <p style={{ color: "#ffffff44", fontSize: 10, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", margin: "0 0 2px", fontFamily: FONT }}>X-penses</p>
          <p style={{ fontSize: 15, fontWeight: 700, color: "#fff", margin: 0, letterSpacing: -0.3, fontFamily: FONT }}>{account?.name || "Mis cuentas"}</p>
        </div>
        <button onClick={onNotifsOpen} style={{
          position: "relative", background: "rgba(255,255,255,0.10)",
          border: "1px solid rgba(255,255,255,0.13)", borderRadius: 50,
          width: 38, height: 38, display: "flex", alignItems: "center",
          justifyContent: "center", cursor: "pointer", flexShrink: 0, padding: 0,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffffcc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 01-3.46 0"/>
          </svg>
          {unreadCount > 0 && (
            <div style={{ position: "absolute", top: 5, right: 5, width: 14, height: 14, borderRadius: 7, background: "#FA4F7F", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 8, color: "#fff", fontWeight: 700, fontFamily: FONT }}>{unreadCount > 9 ? "9+" : unreadCount}</span>
            </div>
          )}
        </button>
      </div>
    </div>
  );
}

// ── MENU PANEL ──
function MenuPanel({ onClose, currentUser, userProfile, members, account, onSignOut, onSwitchAccount, isDark, onToggleTheme, colors }) {
  const me = members?.find(m => m.uid === currentUser?.uid);
  const meColor = me?.color || "#4F7FFA";
  const handleShare = () => {
    const url = window.location.origin;
    if (navigator.share) navigator.share({ title: "X-penses", text: "Llevá tus gastos compartidos 💸", url });
    else { navigator.clipboard.writeText(url); alert("¡Link copiado!"); }
  };
  const rows = [
    { icon: "🔀", label: "Cambiar de cuenta", sub: account?.name || "", action: () => { onClose(); onSwitchAccount(); } },
    { icon: "📤", label: "Compartir X-penses", sub: "Invitá a otros a usar la app", action: () => { onClose(); handleShare(); } },
    { icon: isDark ? "☀️" : "🌙", label: isDark ? "Modo claro" : "Modo oscuro", sub: "Tema de la app", action: () => { onToggleTheme(); onClose(); } },
    { icon: "🚪", label: "Cerrar sesión", sub: "", action: () => { onClose(); onSignOut(); }, danger: true },
  ];
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "flex-end" }} onClick={onClose}>
      <div style={{ background: colors.card, borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 500, margin: "0 auto", padding: "20px 20px calc(32px + env(safe-area-inset-bottom))", fontFamily: FONT }} onClick={e => e.stopPropagation()}>
        <div style={{ width: 36, height: 4, background: colors.divider, borderRadius: 2, margin: "0 auto 20px" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", background: colors.pill, borderRadius: 18, marginBottom: 16 }}>
          {currentUser?.photoURL ? <img src={currentUser.photoURL} style={{ width: 48, height: 48, borderRadius: 24, border: `2px solid ${meColor}` }} alt="" /> : <div style={{ width: 48, height: 48, borderRadius: 24, background: meColor + "33", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>👤</div>}
          <div>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 16, color: colors.text, fontFamily: FONT }}>{userProfile?.name || currentUser?.displayName}</p>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: colors.textMuted, fontFamily: FONT }}>{currentUser?.email}</p>
          </div>
        </div>
        <div style={{ padding: "10px 16px", background: "#4F7FFA11", borderRadius: 14, marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20 }}>{account?.type === "shared" ? "👥" : "👤"}</span>
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#4F7FFA", fontFamily: FONT }}>{account?.name}</p>
            <p style={{ margin: 0, fontSize: 11, color: colors.textMuted, fontFamily: FONT }}>{account?.type === "shared" ? "Cuenta compartida" : "Cuenta personal"}</p>
          </div>
        </div>
        {rows.map((r, i) => (
          <button key={i} onClick={r.action} style={{ width: "100%", background: "none", border: "none", borderRadius: 14, padding: "13px 16px", marginBottom: 4, display: "flex", alignItems: "center", gap: 14, cursor: "pointer", fontFamily: FONT, textAlign: "left" }}>
            <span style={{ fontSize: 22, width: 32 }}>{r.icon}</span>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: r.danger ? colors.danger : colors.text, fontFamily: FONT }}>{r.label}</p>
              {r.sub && <p style={{ margin: "2px 0 0", fontSize: 12, color: colors.textMuted, fontFamily: FONT }}>{r.sub}</p>}
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={colors.textMuted} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── ADD EXPENSE MODAL con swipe-to-close y fondo bloqueado ──
function AddExpenseModal({ onClose, onAdd, currentUser, members, currency, customCategories }) {
  const { colors } = useTheme();
  const otherMember = members?.find(m => m.uid !== currentUser.uid);
  const allCategories = [...DEFAULT_CATEGORIES, ...(customCategories || [])];
  const [form, setForm] = useState({ type: "hogar", concept: "", amount: "", category: "super", date: new Date().toISOString().slice(0, 10), paidBy: currentUser.uid, forWhom: otherMember?.uid || "", owner: currentUser.uid });
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const currSymbol = CURRENCIES[currency]?.symbol || "$";

  const sheetRef = useRef(null);
  const startY = useRef(null);
  const dragY = useRef(0);
  const [translateY, setTranslateY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const onTouchStart = (e) => {
    // Solo iniciar drag desde el handle
    const handle = sheetRef.current?.querySelector("[data-handle]");
    if (handle && handle.contains(e.target)) {
      startY.current = e.touches[0].clientY;
      setIsDragging(true);
    }
  };
  const onTouchMove = (e) => {
    if (!isDragging || startY.current === null) return;
    e.stopPropagation();
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 0) { dragY.current = dy; setTranslateY(dy); }
  };
  const onTouchEnd = () => {
    if (dragY.current > 120) onClose();
    else setTranslateY(0);
    dragY.current = 0; startY.current = null; setIsDragging(false);
  };

  const labelStyle = { fontSize: 11, fontWeight: 600, color: colors.textMuted, marginBottom: 6, letterSpacing: 0.6, textTransform: "uppercase", fontFamily: FONT };
  const inputStyle = { width: "100%", padding: "13px 14px", borderRadius: 14, border: `2px solid ${colors.inputBorder}`, fontSize: 15, marginBottom: 14, fontFamily: FONT, outline: "none", boxSizing: "border-box", color: colors.inputText, background: colors.input };

  const handleAdd = async () => {
    if (!form.concept || !form.amount) return;
    setLoading(true);
    const amount = parseFloat(form.amount);
    const extra = {};
    if (form.type === "extraordinary" && members) { members.forEach(m => { extra[`paid_${m.uid}`] = m.uid === form.paidBy ? amount : 0; }); }
    await onAdd({ ...form, ...extra, amount, month: form.date.slice(0, 7) });
    setLoading(false); onClose();
  };

  const types = [["hogar","🏠 Hogar"],["personal","🎁 Para otro"],["extraordinary","✈️ Extraordinario"],["mio","👤 Para mí"]];

  return (
    // Fondo no clickeable — no cierra al tocar afuera, solo con swipe o botón X
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 100, display: "flex", alignItems: "flex-end" }}>
      <div
        ref={sheetRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          background: colors.card, borderRadius: "24px 24px 0 0",
          width: "100%", padding: "0 20px 44px",
          maxHeight: "90vh", overflowY: "auto", fontFamily: FONT,
          transform: `translateY(${translateY}px)`,
          transition: isDragging ? "none" : "transform 0.3s ease",
        }}>
        {/* Handle — área de swipe */}
        <div data-handle style={{ padding: "20px 0 4px", cursor: "grab", touchAction: "none" }}>
          <div style={{ width: 36, height: 4, background: colors.divider, borderRadius: 2, margin: "0 auto" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, paddingTop: 12 }}>
          <span style={{ fontSize: 20, fontWeight: 700, color: colors.text, fontFamily: FONT }}>Nuevo Gasto</span>
          <button onClick={onClose} style={{ background: colors.pill, border: "none", borderRadius: 50, width: 32, height: 32, fontSize: 18, cursor: "pointer", color: colors.text }}>×</button>
        </div>
        <p style={labelStyle}>Tipo</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
          {types.map(([val, lbl]) => (
            <button key={val} onClick={() => set("type", val)} style={{ padding: "10px 8px", borderRadius: 12, border: "2px solid", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: FONT, borderColor: form.type === val ? "#4F7FFA" : colors.inputBorder, background: form.type === val ? "#4F7FFA11" : colors.input, color: form.type === val ? "#4F7FFA" : colors.textMuted }}>{lbl}</button>
          ))}
        </div>
        <p style={labelStyle}>Concepto</p>
        <input value={form.concept} onChange={e => set("concept", e.target.value)} placeholder="Ej: Supermercado" style={inputStyle} />
        <p style={labelStyle}>Monto ({currSymbol})</p>
        <div style={{ position: "relative", marginBottom: 14 }}>
          <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: colors.textMuted, fontWeight: 600, fontSize: 15, fontFamily: FONT }}>{currSymbol}</span>
          <input type="number" value={form.amount} onChange={e => set("amount", e.target.value)} placeholder="0" style={{ ...inputStyle, marginBottom: 0, paddingLeft: 36 }} />
        </div>
        <p style={labelStyle}>Categoría</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 16 }}>
          {allCategories.map(c => (
            <button key={c.id} onClick={() => set("category", c.id)} style={{ padding: "7px 12px", borderRadius: 12, border: "2px solid", fontSize: 12, cursor: "pointer", fontFamily: FONT, borderColor: form.category === c.id ? "#4F7FFA" : colors.inputBorder, background: form.category === c.id ? "#4F7FFA11" : colors.input, color: form.category === c.id ? "#4F7FFA" : colors.text }}>{c.icon} {c.label}</button>
          ))}
        </div>
        <p style={labelStyle}>Fecha</p>
        <DateInput value={form.date} onChange={v => set("date", v)} />
        {form.type !== "mio" && members && (<><p style={labelStyle}>Pagó</p><div style={{ display: "flex", gap: 8, marginBottom: 14 }}>{members.map(m => (<button key={m.uid} onClick={() => set("paidBy", m.uid)} style={{ flex: 1, padding: 12, borderRadius: 14, border: "2px solid", fontWeight: 600, cursor: "pointer", fontFamily: FONT, borderColor: form.paidBy === m.uid ? (m.color||"#4F7FFA") : colors.inputBorder, background: form.paidBy === m.uid ? (m.color||"#4F7FFA") + "18" : colors.input, color: form.paidBy === m.uid ? (m.color||"#4F7FFA") : colors.textMuted }}>{m.name}</button>))}</div></>)}
        {form.type === "mio" && members && (<><p style={labelStyle}>¿De quién?</p><div style={{ display: "flex", gap: 8, marginBottom: 14 }}>{members.map(m => (<button key={m.uid} onClick={() => set("owner", m.uid)} style={{ flex: 1, padding: 12, borderRadius: 14, border: "2px solid", fontWeight: 600, cursor: "pointer", fontFamily: FONT, borderColor: form.owner === m.uid ? (m.color||"#4F7FFA") : colors.inputBorder, background: form.owner === m.uid ? (m.color||"#4F7FFA") + "18" : colors.input, color: form.owner === m.uid ? (m.color||"#4F7FFA") : colors.textMuted }}>{m.name}</button>))}</div></>)}
        {form.type === "personal" && members && (<><p style={labelStyle}>Para...</p><div style={{ display: "flex", gap: 8, marginBottom: 14 }}>{members.map(m => (<button key={m.uid} onClick={() => set("forWhom", m.uid)} style={{ flex: 1, padding: 12, borderRadius: 14, border: "2px solid", fontWeight: 600, cursor: "pointer", fontFamily: FONT, borderColor: form.forWhom === m.uid ? (m.color||"#4F7FFA") : colors.inputBorder, background: form.forWhom === m.uid ? (m.color||"#4F7FFA") + "18" : colors.input, color: form.forWhom === m.uid ? (m.color||"#4F7FFA") : colors.textMuted }}>{m.name}</button>))}</div></>)}
        <button onClick={handleAdd} disabled={loading} style={{ width: "100%", padding: 16, borderRadius: 16, background: loading ? "#aaa" : "linear-gradient(135deg,#4F7FFA,#3a6ae8)", color: "#fff", border: "none", fontSize: 16, fontWeight: 600, cursor: loading ? "default" : "pointer", fontFamily: FONT, marginTop: 4 }}>
          {loading ? "Guardando..." : "Agregar ✓"}
        </button>
      </div>
    </div>
  );
}

// ── HOME SCREEN (con gastos unificados, filtros, gastos fijos colapsables) ──
function HomeScreen({ expenses, currentUser, members, account, currentMonth, customCategories, fixedExpenses, onEdit, onDelete }) {
  const { colors } = useTheme();
  const fs = useExpenseFontSize();
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
  const catTotals = allCategories.map(c => ({ ...c, total: monthExp.filter(e => e.category === c.id).reduce((s, e) => s + e.amount, 0) })).filter(c => c.total > 0).sort((a, b) => b.total - a.total).slice(0, 4);
  const monthLabel = new Date(currentMonth + "-02").toLocaleString("es-AR", { month: "long", year: "numeric" });

  // Filtros de gastos
  const [filterType, setFilterType] = useState("todos");
  const filtered = filterType === "todos" ? monthExp : monthExp.filter(e => e.type === filterType);
  const sorted = [...filtered].sort((a, b) => b.date.localeCompare(a.date));

  // Gastos fijos colapsables
  const [fixedExpanded, setFixedExpanded] = useState(false);
  const today = new Date().getDate();

  return (
    <div style={{ fontFamily: FONT }}>
      {/* Hero header */}
      <div style={{ background: colors.headerBg, borderRadius: "0 0 32px 32px", padding: `${HEADER_HEIGHT + 16}px 20px 28px` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
          {me?.photo ? <img src={me.photo} style={{ width: 44, height: 44, borderRadius: 22, border: "2px solid #ffffff44" }} alt="" /> : <div style={{ width: 44, height: 44, borderRadius: 22, background: meColor+"44", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>👤</div>}
          <div>
            <p style={{ color: "#ffffff88", fontSize: 12, margin: 0, fontFamily: FONT }}>Hola,</p>
            <p style={{ color: "#fff", fontSize: 22, fontWeight: 700, margin: 0, fontFamily: FONT }}>{me?.name || currentUser.displayName}</p>
          </div>
        </div>
        <div style={{ background: meColor, borderRadius: 22, padding: 20 }}>
          <p style={{ color: "#ffffff88", fontSize: 11, margin: "0 0 6px", fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", fontFamily: FONT }}>Saldo — {monthLabel}</p>
          <p style={{ color: "#fff", fontSize: 36, fontWeight: 700, margin: "0 0 4px", letterSpacing: -1, fontFamily: FONT }}>{myBalance >= 0 ? "+" : ""}{fmt(myBalance)}</p>
          <p style={{ color: "#ffffff88", fontSize: 12, margin: 0, fontFamily: FONT }}>{myBalance >= 0 ? "✅ Te deben a vos" : "⚠️ Debés este monto"}</p>
        </div>
      </div>

      <div style={{ padding: "0 20px" }}>
        {/* Resumen */}
        <SectionTitle>Resumen del mes</SectionTitle>
        <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
          <StatPill label="Compartido" value={fmt(sharedExp.reduce((s,e)=>s+e.amount,0))} color="#4F7FFA" />
          <StatPill label="Mis gastos" value={fmt(myPersonalTotal)} color={meColor} />
        </div>

        {/* Top categorías */}
        {catTotals.length > 0 && (
          <>
            <SectionTitle>Top categorías</SectionTitle>
            {catTotals.map(c => (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                <span style={{ fontSize: 22, width: 30 }}>{c.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: fs.base, fontWeight: 600, color: colors.text, fontFamily: FONT }}>{c.label}</span>
                    <span style={{ fontSize: fs.base, fontWeight: 700, color: colors.text, fontFamily: FONT }}>{fmt(c.total)}</span>
                  </div>
                  <div style={{ background: colors.divider, borderRadius: 4, height: 5 }}>
                    <div style={{ background: "#4F7FFA", borderRadius: 4, height: 5, width: `${Math.min(100,(c.total/catTotals[0].total)*100)}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </>
        )}

        {/* ── Gastos fijos colapsables ── */}
        {fixedExpenses && fixedExpenses.length > 0 && (
          <>
            <button onClick={() => setFixedExpanded(v => !v)} style={{
              width: "100%", background: "none", border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "18px 0 8px", fontFamily: FONT,
            }}>
              <span style={{ fontSize: 20, fontWeight: 700, color: colors.text, fontFamily: FONT }}>
                📋 Gastos fijos
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, color: colors.textMuted, fontFamily: FONT }}>
                  {fmt(fixedExpenses.reduce((s, f) => s + (f.amount || 0), 0))}
                </span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.textMuted} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  style={{ transform: fixedExpanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
                  <path d="M6 9l6 6 6-6"/>
                </svg>
              </div>
            </button>
            {fixedExpanded && (
              <div style={{ marginBottom: 8 }}>
                {fixedExpenses.map(f => {
                  const daysLeft = f.dueDay ? f.dueDay - today : null;
                  const isUrgent = daysLeft !== null && daysLeft >= 0 && daysLeft <= 5;
                  return (
                    <Card key={f.id} style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 12, background: f.shared ? "#4F7FFA14" : "#FA4F7F14", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
                          {f.shared ? "🏠" : "👤"}
                        </div>
                        <div style={{ flex: 1 }}>
                          <p style={{ margin: 0, fontWeight: 600, fontSize: fs.base, color: colors.text, fontFamily: FONT }}>{f.name}</p>
                          {f.dueDay && (
                            <p style={{ margin: "2px 0 0", fontSize: fs.sub, color: isUrgent ? "#e74c3c" : colors.textMuted, fontFamily: FONT, fontWeight: isUrgent ? 700 : 400 }}>
                              {daysLeft === 0 ? "⚠️ Vence hoy" : daysLeft < 0 ? `Venció hace ${Math.abs(daysLeft)}d` : `Vence en ${daysLeft}d (día ${f.dueDay})`}
                            </p>
                          )}
                        </div>
                        <p style={{ margin: 0, fontWeight: 700, fontSize: fs.base, color: isUrgent ? "#e74c3c" : colors.text, fontFamily: FONT }}>{fmt(f.amount || 0)}</p>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ── Todos los gastos con filtros ── */}
        <SectionTitle>Movimientos</SectionTitle>

        {/* Filtros */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16, overflowX: "auto", paddingBottom: 4 }}>
          {[["todos","Todos"],["hogar","🏠"],["personal","🎁"],["extraordinary","✈️"],["mio","👤"]].map(([val, lbl]) => (
            <button key={val} onClick={() => setFilterType(val)} style={{ whiteSpace: "nowrap", padding: "8px 14px", borderRadius: 20, border: "2px solid", cursor: "pointer", fontFamily: FONT, fontSize: 12, fontWeight: 600, borderColor: filterType === val ? "#4F7FFA" : colors.inputBorder, background: filterType === val ? "#4F7FFA" : colors.card, color: filterType === val ? "#fff" : colors.textMuted }}>{lbl}</button>
          ))}
        </div>

        {sorted.length === 0 && (
          <Card style={{ textAlign: "center", color: colors.textMuted, padding: 32 }}>
            <p style={{ fontSize: 32, margin: "0 0 8px" }}>📭</p>
            <p style={{ margin: 0, fontFamily: FONT }}>Sin gastos este mes</p>
          </Card>
        )}

        {sorted.map(e => {
          const cat = allCategories.find(c => c.id === e.category);
          const who = e.type === "mio" ? members?.find(m=>m.uid===e.owner) : members?.find(m=>m.uid===e.paidBy);
          return (
            <Card key={e.id} style={{ padding: "14px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
                  <span style={{ fontSize: 22 }}>{cat?.icon}</span>
                  <div>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: fs.base, color: colors.text, fontFamily: FONT }}>{e.concept}</p>
                    <p style={{ margin: "2px 0 4px", fontSize: fs.sub, color: colors.textMuted, fontFamily: FONT }}>{e.date} · {who?.name}</p>
                    <Tag color={e.type==="hogar"?"#4F7FFA":e.type==="personal"?"#FA4F7F":e.type==="extraordinary"?"#f39c12":"#2ecc71"}>{e.type==="hogar"?"Hogar":e.type==="personal"?"Para otro":e.type==="extraordinary"?"Extraordinario":"Para mí"}</Tag>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: fs.base, color: colors.text, fontFamily: FONT }}>{fmt(e.amount)}</p>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => onEdit(e)} style={{ background: "#4F7FFA18", border: "none", borderRadius: 8, padding: "5px 10px", fontSize: 11, color: "#4F7FFA", cursor: "pointer", fontFamily: FONT, fontWeight: 600 }}>✏️</button>
                    <button onClick={() => onDelete(e.id)} style={{ background: colors.dangerBg, border: "none", borderRadius: 8, padding: "5px 10px", fontSize: 11, color: colors.danger, cursor: "pointer", fontFamily: FONT }}>✕</button>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
        <div style={{ height: 120 }} />
      </div>
    </div>
  );
}

// ── SALDOS SCREEN ──
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
    <div style={{ padding: "0 20px", paddingTop: HEADER_HEIGHT + 8, fontFamily: FONT }}>
      <SectionTitle>Saldos del mes</SectionTitle>
      {members?.map(m => {
        const s = saldos[m.uid] || { paid: 0, owes: 0, balance: 0 };
        const totalSalary = members.reduce((acc, mb) => acc + (mb.salary || 0), 0);
        const pct = totalSalary > 0 ? ((m.salary || 0) / totalSalary * 100).toFixed(0) : 50;
        return (
          <Card key={m.uid}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              {m.photo ? <img src={m.photo} style={{ width: 44, height: 44, borderRadius: 22 }} alt="" /> : <div style={{ width: 44, height: 44, borderRadius: 22, background: (m.color||"#4F7FFA")+"22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>👤</div>}
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 16, color: colors.text, fontFamily: FONT }}>{m.name}</p>
                <p style={{ margin: 0, fontSize: 12, color: colors.textMuted, fontFamily: FONT }}>{fmt(m.salary)} · {pct}% del hogar</p>
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
      <Card style={{ background: colors.headerBg, border: "none" }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: "#ffffff55", textTransform: "uppercase", marginBottom: 8, fontFamily: FONT }}>Conclusión</p>
        <p style={{ color: "#fff", fontSize: 15, fontWeight: 600, margin: 0, fontFamily: FONT }}>{debtSummary()}</p>
        {!settled ? (
          <button onClick={handleSettle} style={{ marginTop: 16, width: "100%", padding: 14, borderRadius: 14, background: "#4F7FFA", color: "#fff", border: "none", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>✅ Saldar cuentas</button>
        ) : (
          <div style={{ marginTop: 14, background: "#2ecc7122", borderRadius: 12, padding: 14, textAlign: "center" }}><p style={{ color: "#2ecc71", fontWeight: 700, margin: 0, fontFamily: FONT }}>¡Cuentas saldadas! 🎉</p></div>
        )}
      </Card>
      <div style={{ height: 120 }} />
    </div>
  );
}

// ── GRAFICOS SCREEN ──
function GraficosScreen({ expenses, account }) {
  const { colors } = useTheme();
  const fmt = (n) => formatAmount(n, account?.currency || "ARS");
  const allMonths = [...new Set(expenses.map(e => e.month))].sort();
  const last3 = allMonths.slice(-3);
  const monthLabel = (m) => new Date(m + "-02").toLocaleString("es-AR", { month: "short" });
  const barData = last3.map(m => ({ mes: monthLabel(m), Hogar: expenses.filter(e=>e.month===m&&e.type==="hogar").reduce((s,e)=>s+e.amount,0), Personal: expenses.filter(e=>e.month===m&&e.type==="mio").reduce((s,e)=>s+e.amount,0), Extra: expenses.filter(e=>e.month===m&&e.type==="extraordinary").reduce((s,e)=>s+e.amount,0) }));
  const lastMonth = last3[last3.length - 1];
  const pieData = DEFAULT_CATEGORIES.map((c,i)=>({ name:c.label, value:expenses.filter(e=>e.month===lastMonth&&e.category===c.id).reduce((s,e)=>s+e.amount,0), color:CAT_COLORS[i] })).filter(c=>c.value>0);

  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
    if (percent < 0.07) return null;
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.55;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    return <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={700} fontFamily={FONT}>{`${(percent*100).toFixed(0)}%`}</text>;
  };

  return (
    <div style={{ padding: "0 20px", paddingTop: HEADER_HEIGHT + 8, fontFamily: FONT }}>
      <SectionTitle>Comparación mensual</SectionTitle>
      <Card>
        {barData.length === 0 ? <p style={{ color: colors.textMuted, textAlign: "center", padding: 20, fontFamily: FONT }}>Sin datos aún</p> :
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={barData} barCategoryGap="30%">
              <XAxis dataKey="mes" tick={{ fontSize: 12, fill: colors.textMuted, fontFamily: FONT }} />
              <YAxis tick={{ fontSize: 10, fill: colors.textMuted, fontFamily: FONT }} tickFormatter={v=>`${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={v=>fmt(v)} contentStyle={{ background: colors.card, border: "none", borderRadius: 12, fontFamily: FONT }} />
              <Bar dataKey="Hogar" fill="#4F7FFA" radius={[6,6,0,0]} />
              <Bar dataKey="Personal" fill="#2ecc71" radius={[6,6,0,0]} />
              <Bar dataKey="Extra" fill="#f39c12" radius={[6,6,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        }
        <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 6 }}>
          {[["#4F7FFA","Hogar"],["#2ecc71","Personal"],["#f39c12","Extra"]].map(([col,lbl])=><div key={lbl} style={{ display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 10, height: 10, borderRadius: 3, background: col }} /><span style={{ fontSize: 11, color: colors.textMuted, fontFamily: FONT }}>{lbl}</span></div>)}
        </div>
      </Card>
      <SectionTitle>Por categoría — último mes</SectionTitle>
      <Card>
        {pieData.length === 0 ? <p style={{ color: colors.textMuted, textAlign: "center", padding: 20, fontFamily: FONT }}>Sin datos aún</p> :
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" outerRadius={80} dataKey="value" labelLine={false} label={renderCustomLabel}>
                {pieData.map((e,i)=><Cell key={i} fill={e.color} />)}
              </Pie>
              <Tooltip formatter={v=>fmt(v)} contentStyle={{ background: colors.card, border: "none", borderRadius: 12, fontFamily: FONT }} />
            </PieChart>
          </ResponsiveContainer>
        }
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6, justifyContent: "center" }}>
          {pieData.map(p=><div key={p.name} style={{ display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 8, height: 8, borderRadius: 2, background: p.color }} /><span style={{ fontSize: 11, color: colors.textMuted, fontFamily: FONT }}>{p.name}</span></div>)}
        </div>
      </Card>
      <div style={{ height: 120 }} />
    </div>
  );
}

// ── APP INNER ──
function AppInner() {
  const { colors, toggleTheme, isDark } = useTheme();
  const { unreadCount } = useNotif();
  const [authUser, setAuthUser] = useState(undefined);
  const [userProfile, setUserProfile] = useState(null);
  const [account, setAccount] = useState(null);
  const [members, setMembers] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [customCategories, setCustomCategories] = useState([]);
  const [fixedExpenses, setFixedExpenses] = useState([]);
  const [tab, setTab] = useState("home");
  const [showAdd, setShowAdd] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState(null);
  const [userAccounts, setUserAccounts] = useState([]);
  const [showWelcome, setShowWelcome] = useState(true);
  const [pendingInviteId, setPendingInviteId] = useState(null);
  const currentMonth = getCurrentMonth();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const inviteId = params.get("invite");
    if (inviteId) { setPendingInviteId(inviteId); window.history.replaceState({}, "", window.location.pathname); }
  }, []);

  useEffect(() => {
    if (!pendingInviteId || !authUser) return;
    const processInvite = async () => {
      try {
        const inviteSnap = await getDoc(doc(db, "invites", pendingInviteId));
        if (!inviteSnap.exists()) return;
        const invite = inviteSnap.data();
        if (invite.used) return;
        const accountId = invite.accountId;
        const accountSnap = await getDoc(doc(db, "accounts", accountId));
        if (!accountSnap.exists()) return;
        const accountData = accountSnap.data();
        const memberIds = accountData.memberIds || [];
        if (!memberIds.includes(authUser.uid)) {
          await updateDoc(doc(db, "accounts", accountId), { memberIds: [...memberIds, authUser.uid] });
        }
        const userSnap = await getDoc(doc(db, "users", authUser.uid));
        const existingIds = userSnap.exists() ? (userSnap.data().accountIds || []) : [];
        if (!existingIds.includes(accountId)) {
          await setDoc(doc(db, "users", authUser.uid), { accountIds: [...existingIds, accountId] }, { merge: true });
        }
        await updateDoc(doc(db, "invites", pendingInviteId), { used: true });
        setSelectedAccountId(accountId);
        setPendingInviteId(null);
      } catch (err) { console.error("Error procesando invitación:", err); }
    };
    processInvite();
  }, [pendingInviteId, authUser]);

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
  useEffect(() => { if (!account?.id) return; return onSnapshot(collection(db, "accounts", account.id, "fixedExpenses"), snap => { setFixedExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() }))); }); }, [account?.id]);

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

  // Nav dinámica: si cuenta personal, sin Saldos
  const isPersonal = account?.type === "personal";
  const NAV_LEFT = isPersonal
    ? [{ id: "home", label: "Inicio" }]
    : [{ id: "home", label: "Inicio" }, { id: "saldos", label: "Saldos" }];
  const NAV_RIGHT = isPersonal
    ? [{ id: "graficos", label: "Gráficos" }, { id: "ajustes", label: "Ajustes" }]
    : [{ id: "graficos", label: "Gráficos" }, { id: "ajustes", label: "Ajustes" }];

  // Si estaba en saldos y cambiamos a cuenta personal, redirigir
  if (isPersonal && tab === "saldos") setTab("home");

  return (
    <div style={{
      width: "100%", maxWidth: 500, margin: "0 auto",
      background: colors.bg, minHeight: "100dvh",
      position: "relative", fontFamily: FONT,
      paddingLeft: "env(safe-area-inset-left)",
      paddingRight: "env(safe-area-inset-right)",
      boxSizing: "border-box", overflowX: "hidden",
    }}>
      <style>{`
        ${FONT_IMPORT}
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { display: none; }
        html, body, #root { width: 100%; min-height: 100dvh; margin: 0; padding: 0; }
      `}</style>

      {/* Header fijo */}
      <AppHeader account={account} onMenuOpen={() => setShowMenu(true)} onNotifsOpen={() => setShowNotifs(true)} unreadCount={unreadCount} colors={colors} />

      {/* Contenido */}
      <div style={{ paddingBottom: NAV_HEIGHT + 20, minHeight: "100dvh" }}>
        {tab === "home" && <HomeScreen expenses={expenses} currentUser={authUser} members={members} account={account} currentMonth={currentMonth} customCategories={customCategories} fixedExpenses={fixedExpenses} onEdit={setEditingExpense} onDelete={deleteExpense} />}
        {tab === "saldos" && <SaldosScreen expenses={expenses} members={members} account={account} currentMonth={currentMonth} />}
        {tab === "graficos" && <GraficosScreen expenses={expenses} account={account} />}
        {tab === "ajustes" && <SettingsScreen currentUser={authUser} userProfile={userProfile} account={account} members={members} onSignOut={handleSignOut} onSwitchAccount={() => setSelectedAccountId(null)} />}
      </div>

      {/* ── NAV BAR con FAB elevado ── */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        width: "100%", maxWidth: 500, margin: "0 auto",
        zIndex: 40,
      }}>
        {/* FAB elevado — sobresale sobre la barra */}
        <div style={{
          position: "absolute", top: -28, left: "50%",
          transform: "translateX(-50%)", zIndex: 41,
        }}>
          <button onClick={() => setShowAdd(true)} style={{
            width: 64, height: 64, borderRadius: 32,
            background: "linear-gradient(135deg,#4F7FFA,#3a6ae8)",
            border: "4px solid " + colors.navBg,
            color: "#fff", fontSize: 30, cursor: "pointer",
            boxShadow: "0 6px 24px #4F7FFA88",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>+</button>
        </div>

        {/* Barra */}
        <div style={{
          background: colors.navBg, borderTop: `1px solid ${colors.navBorder}`,
          display: "flex", alignItems: "center",
          padding: `10px 0 calc(16px + env(safe-area-inset-bottom))`,
          boxShadow: "0 -4px 20px rgba(0,0,0,0.08)",
        }}>
          {NAV_LEFT.map(n => (
            <button key={n.id} onClick={() => setTab(n.id)} style={{ flex: 1, background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, fontFamily: FONT, padding: "2px 0" }}>
              <NavIcon id={n.id} active={tab === n.id} color="#4F7FFA" />
              <span style={{ fontSize: 9, fontWeight: tab === n.id ? 700 : 500, letterSpacing: 0.2, color: tab === n.id ? "#4F7FFA" : colors.textSubtle, textTransform: "uppercase", fontFamily: FONT }}>{n.label}</span>
            </button>
          ))}

          {/* Espacio central para el FAB */}
          <div style={{ flex: isPersonal ? 0.8 : 1, flexShrink: 0 }} />

          {NAV_RIGHT.map(n => (
            <button key={n.id} onClick={() => setTab(n.id)} style={{ flex: 1, background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, fontFamily: FONT, padding: "2px 0" }}>
              <NavIcon id={n.id} active={tab === n.id} color="#4F7FFA" />
              <span style={{ fontSize: 9, fontWeight: tab === n.id ? 700 : 500, letterSpacing: 0.2, color: tab === n.id ? "#4F7FFA" : colors.textSubtle, textTransform: "uppercase", fontFamily: FONT }}>{n.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Modales */}
      {showAdd && <AddExpenseModal onClose={() => setShowAdd(false)} onAdd={addExpense} currentUser={authUser} members={members} currency={account?.currency || "ARS"} customCategories={customCategories} />}
      {editingExpense && <EditExpenseModal expense={editingExpense} members={members} onClose={() => setEditingExpense(null)} />}
      {showNotifs && <NotifCenter onClose={() => setShowNotifs(false)} />}
      {showMenu && <MenuPanel onClose={() => setShowMenu(false)} currentUser={authUser} userProfile={userProfile} members={members} account={account} onSignOut={handleSignOut} onSwitchAccount={() => setSelectedAccountId(null)} isDark={isDark} onToggleTheme={toggleTheme} colors={colors} />}
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
