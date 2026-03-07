import { useState, useEffect, useRef, useMemo } from "react";
import { collection, addDoc, onSnapshot, doc, query, orderBy, where, getDoc, updateDoc, setDoc, arrayUnion } from "firebase/firestore";
import { onAuthStateChanged, signOut, linkWithPopup } from "firebase/auth";
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
import { useExpenses } from "./hooks/useExpenses.js";
import AddExpenseModal from "./components/expenses/AddExpenseModal.jsx";
import { SwipeableExpenseRow } from "./components/expenses/SwipeableExpenseRow.jsx";

const FONT = `'DM Sans', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif`;
const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');`;
const NAV_HEIGHT = 72;

import { DEFAULT_CATEGORIES } from "./constants/categories.js";
const CAT_COLORS = ["#4F7FFA","#FA4F7F","#f39c12","#2ecc71","#9b59b6","#1abc9c","#e74c3c","#95a5a6"];
const getCurrentMonth = () => new Date().toISOString().slice(0, 7);

const fmtDate = (iso) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}-${m}-${y}`;
};

const FONT_SIZE_MAP = {
  small:  { base: 12, sub: 10, title: 18 },
  medium: { base: 14, sub: 12, title: 20 },
  large:  { base: 17, sub: 14, title: 22 },
};

function useExpenseFontSize() {
  const [size, setSize] = useState(() => localStorage.getItem("expenseFontSize") || "medium");
  useEffect(() => {
    const handler = (e) => setSize(e.detail);
    window.addEventListener("expenseFontSizeChange", handler);
    return () => window.removeEventListener("expenseFontSizeChange", handler);
  }, []);
  return FONT_SIZE_MAP[size] || FONT_SIZE_MAP.medium;
}

function MenuIcon({ color = "#ffffffcc" }) {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <rect x="1.5" y="1.5" width="25" height="25" rx="7" stroke={color} strokeWidth="2"/>
      <line x1="7" y1="9.5" x2="21" y2="9.5" stroke={color} strokeWidth="2" strokeLinecap="round"/>
      <line x1="7" y1="14"  x2="21" y2="14"  stroke={color} strokeWidth="2" strokeLinecap="round"/>
      <line x1="7" y1="18.5" x2="21" y2="18.5" stroke={color} strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

function NavIcon({ id, active, color }) {
  const s = active ? 2 : 1.5;
  const c = active ? color : "#aaa";
  if (id === "home")    return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={s} strokeLinecap="round" strokeLinejoin="round"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/><path d="M9 21V12h6v9"/></svg>;
  if (id === "saldos")  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={s} strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v18M5 8l7-5 7 5M5 16l7 5 7-5"/></svg>;
  if (id === "graficos") return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={s} strokeLinecap="round" strokeLinejoin="round"><path d="M4 20V14M9 20V8M14 20v-5M19 20V4"/></svg>;
  if (id === "ajustes") return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={s} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>;
  return null;
}

// ── calcSaldos: todos los tipos de gasto + gastos fijos + settlements ──
function calcSaldos(expenses, fixedExpenses, members, divisionSystem, currentMonth, settlements) {
  if (!members || members.length < 2) return {};
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
function Spinner({ text = "Cargando..." }) {
  const { colors } = useTheme();
  return <div style={{ textAlign: "center", padding: 60, color: colors.textMuted, fontSize: 14, fontFamily: FONT }}>{text}</div>;
}

// ── HEADER ──
function AppHeader({ account, onMenuOpen, onNotifsOpen, unreadCount, colors }) {
  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 60, maxWidth: 500, margin: "0 auto", background: colors.headerBg, paddingTop: "calc(env(safe-area-inset-top) + 12px)", paddingBottom: 14, paddingLeft: 20, paddingRight: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <button onClick={onMenuOpen} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", flexShrink: 0 }}><MenuIcon /></button>
        <div style={{ flex: 1 }}>
          <p style={{ color: "#ffffff55", fontSize: 10, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", margin: "0 0 1px", fontFamily: FONT }}>X-penses</p>
          <p style={{ fontSize: 16, fontWeight: 700, color: "#fff", margin: 0, letterSpacing: -0.3, fontFamily: FONT }}>{account?.name || "Mis cuentas"}</p>
        </div>
        <button onClick={onNotifsOpen} style={{ position: "relative", background: "rgba(255,255,255,0.12)", border: "none", borderRadius: 50, width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, padding: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffffcc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
          {unreadCount > 0 && (
            <div style={{ position: "absolute", top: 5, right: 5, width: 14, height: 14, borderRadius: 7, background: "#FA4F7F", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 8, color: "#fff", fontWeight: 700, fontFamily: FONT }}>{unreadCount > 9 ? "9+" : unreadCount}</span>
            </div>
          )}
        </button>
      </div>
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.15) 30%, rgba(255,255,255,0.15) 70%, transparent)" }} />
    </div>
  );
}

// ── MENU PANEL ──
function MenuPanel({ onClose, currentUser, userProfile, members, account, onSignOut, onSwitchAccount, isDark, onToggleTheme, colors }) {
  const me = members?.find(m => m.uid === currentUser?.uid);
  const meColor = me?.color || "#4F7FFA";
  const startY = useRef(null);
  const [dragY, setDragY] = useState(0);
  const dragging = useRef(false);
  const onTouchStart = (e) => { startY.current = e.touches[0].clientY; dragging.current = true; };
  const onTouchMove = (e) => { if (!dragging.current) return; const dy = e.touches[0].clientY - startY.current; if (dy > 0) setDragY(dy); };
  const onTouchEnd = () => { if (dragY > 100) onClose(); else setDragY(0); dragging.current = false; startY.current = null; };
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
      <div onClick={e => e.stopPropagation()} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
        style={{ background: colors.card, borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 500, margin: "0 auto", padding: "20px 20px calc(32px + env(safe-area-inset-bottom))", fontFamily: FONT, transform: `translateY(${dragY}px)`, transition: dragging.current ? "none" : "transform 0.3s ease" }}>
        <div style={{ width: 36, height: 4, background: colors.divider, borderRadius: 2, margin: "0 auto 20px" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", background: colors.pill, borderRadius: 18, marginBottom: 16 }}>
          {currentUser?.photoURL
            ? <img src={currentUser.photoURL} style={{ width: 48, height: 48, borderRadius: 24, border: `2px solid ${meColor}` }} alt="" />
            : <div style={{ width: 48, height: 48, borderRadius: 24, background: meColor + "33", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>👤</div>}
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


// ── CLAIM IDENTITY MODAL ──
function ClaimIdentityModal({ claimData, onClaim, onSkip, colors }) {
  const { memberLabels, accountData } = claimData;
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const handleClaim = async () => { if (!selected) return; setLoading(true); await onClaim(selected); setLoading(false); };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 300, display: "flex", alignItems: "flex-end" }}>
      <div style={{ background: colors.card, borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 500, margin: "0 auto", padding: "24px 20px calc(40px + env(safe-area-inset-bottom))", fontFamily: FONT }}>
        <div style={{ width: 36, height: 4, background: colors.divider, borderRadius: 2, margin: "0 auto 24px" }} />
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <p style={{ fontSize: 40, margin: "0 0 10px" }}>👋</p>
          <p style={{ fontSize: 20, fontWeight: 700, color: colors.text, margin: "0 0 6px", fontFamily: FONT }}>¡Te invitaron a <span style={{ color: "#4F7FFA" }}>{accountData.name}</span>!</p>
          <p style={{ fontSize: 14, color: colors.textMuted, margin: 0, fontFamily: FONT, lineHeight: 1.5 }}>Elegí tu nombre para que los demás te reconozcan</p>
        </div>
        <div style={{ marginBottom: 20 }}>
          {memberLabels.map(label => (
            <button key={label.id} onClick={() => setSelected(label.id)}
              style={{ width: "100%", padding: "14px 16px", borderRadius: 16, border: "2px solid", marginBottom: 8, cursor: "pointer", fontFamily: FONT, textAlign: "left", display: "flex", alignItems: "center", gap: 14, borderColor: selected === label.id ? label.color || "#4F7FFA" : colors.inputBorder, background: selected === label.id ? (label.color || "#4F7FFA") + "14" : colors.input }}>
              <div style={{ width: 44, height: 44, borderRadius: 22, flexShrink: 0, background: (label.color || "#4F7FFA") + "33", border: `2px solid ${label.color || "#4F7FFA"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 18, fontWeight: 700, color: label.color || "#4F7FFA", fontFamily: FONT }}>{label.name[0].toUpperCase()}</span>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 16, color: selected === label.id ? (label.color || "#4F7FFA") : colors.text, fontFamily: FONT }}>{label.name}</p>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: colors.textMuted, fontFamily: FONT }}>Miembro de {accountData.name}</p>
              </div>
              {selected === label.id && <div style={{ width: 24, height: 24, borderRadius: 12, background: label.color || "#4F7FFA", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><span style={{ color: "#fff", fontSize: 14 }}>✓</span></div>}
            </button>
          ))}
        </div>
        <button onClick={handleClaim} disabled={!selected || loading} style={{ width: "100%", padding: 16, borderRadius: 16, border: "none", background: !selected || loading ? "#aaa" : "linear-gradient(135deg,#4F7FFA,#3a6ae8)", color: "#fff", fontSize: 16, fontWeight: 700, cursor: !selected || loading ? "default" : "pointer", fontFamily: FONT, marginBottom: 10 }}>
          {loading ? "Uniéndome..." : "¡Soy yo, unirme! →"}
        </button>
        <button onClick={onSkip} style={{ width: "100%", padding: 14, borderRadius: 14, border: "none", background: colors.pill, color: colors.textMuted, fontSize: 14, cursor: "pointer", fontFamily: FONT }}>Mi nombre no está en la lista</button>
      </div>
    </div>
  );
}


// ── FIXED EXPENSE ROW (en Inicio) ──
// Muestra estado pagado/no pagado y botón para pagar
function FixedExpenseHomeRow({ f, fmt, fs, colors, currentMonth, allMembers, onMarkPaid, isPersonal }) {
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

// Modal para seleccionar quién pagó un gasto fijo
function MarkPaidModal({ fixedExpense, allMembers, currentUser, currentMonth, onConfirm, onClose, colors }) {
  const [paidBy, setPaidBy] = useState(currentUser.uid);
  const [loading, setLoading] = useState(false);
  const members = allMembers?.filter(m => !m._isLabel) || [];

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
function HomeScreen({ expenses, currentUser, allMembers, account, currentMonth, customCategories, fixedExpenses, onEdit, onDelete, onMarkFixedPaid, settlements }) {
  const { colors } = useTheme();
  const fs = useExpenseFontSize();
  const isPersonal = account?.type === "personal";
  const currency = account?.currency || "ARS";
  const fmt = (n) => formatAmount(n, currency);
  const me = allMembers?.find(m => m.uid === currentUser.uid);
  const meColor = me?.color || "#4F7FFA";
  const allCategories = [...DEFAULT_CATEGORIES, ...(customCategories || [])];
  const monthExp    = expenses.filter(e => e.month === currentMonth && !e.deleted); // para cálculos
  const monthExpAll = expenses.filter(e => e.month === currentMonth); // para lista visual (incluye eliminados)
  const sharedExp = monthExp.filter(e => e.type !== "mio");

  // Gastos fijos visibles para este usuario
  const visibleFixed = (fixedExpenses || []).filter(f =>
    f.shared || f.createdBy === currentUser.uid
  );
  const sharedFixed   = visibleFixed.filter(f => f.shared);
  const personalFixed = visibleFixed.filter(f => !f.shared);

  // Total de gastos fijos del mes (suma al total general)
  const fixedTotal = visibleFixed.reduce((s, f) => s + (f.amount || 0), 0);

  // Saldos incluyen gastos fijos no pagados
  const realMembers = allMembers?.filter(m => !m._isLabel) || [];
  const saldos = useMemo(
    () => calcSaldos(sharedExp, isPersonal ? [] : visibleFixed, realMembers, account?.divisionSystem, currentMonth),
    [sharedExp, visibleFixed, realMembers, account?.divisionSystem, currentMonth]
  );
  const myBalance = saldos[currentUser.uid]?.balance || 0;

  // Total del mes = gastos normales + gastos fijos
  const normalTotal = monthExp.reduce((s, e) => s + e.amount, 0);
  const totalMonthExp = normalTotal + fixedTotal;
  const myPersonalTotal = monthExp.filter(e => e.type === "mio" && e.owner === currentUser.uid).reduce((s, e) => s + e.amount, 0);

  const catTotals = allCategories.map(c => ({ ...c, total: monthExp.filter(e => e.category === c.id).reduce((s, e) => s + e.amount, 0) })).filter(c => c.total > 0).sort((a, b) => b.total - a.total);
  const [catExpanded, setCatExpanded] = useState(false);
  const monthLabel = new Date(currentMonth + "-02").toLocaleString("es-AR", { month: "long", year: "numeric" });

  const [filterType, setFilterType] = useState("todos");
  const filtered = isPersonal
    ? (filterType === "todos" ? monthExpAll : monthExpAll.filter(e => e.category === filterType))
    : (filterType === "todos" ? monthExpAll : monthExpAll.filter(e => e.type === filterType));
  const monthSettlements = (settlements || []).filter(s => s.month === currentMonth && !s.isCorrection && s.amount > 0);
  const sorted = [...filtered].sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  // Estado de expansión de gastos fijos — 3 niveles
  const [fixedExpanded,         setFixedExpanded]         = useState(false);
  const [fixedSharedExpanded,   setFixedSharedExpanded]   = useState(false);
  const [fixedPersonalExpanded, setFixedPersonalExpanded] = useState(false);

  // Modal pagar gasto fijo
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
          <p style={{ color: "#fff", fontSize: 36, fontWeight: 700, margin: "0 0 4px", letterSpacing: -1, fontFamily: FONT }}>{fmt(totalMonthExp)}</p>
          {!isPersonal && (
            <p style={{ color: "#ffffff88", fontSize: 12, margin: 0, fontFamily: FONT }}>
              {myBalance >= 0 ? `✅ Saldo a favor: ${fmt(myBalance)}` : `⚠️ Debés: ${fmt(Math.abs(myBalance))}`}
            </p>
          )}
        </div>
      </div>

      <div style={{ padding: "0 20px" }}>
        <SectionTitle>Resumen del mes</SectionTitle>
        <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
          {isPersonal ? (
            <StatPill label="Total gastos" value={fmt(totalMonthExp)} color={meColor} />
          ) : (
            <>
              <StatPill label="Compartido" value={fmt(sharedExp.reduce((s, e) => s + e.amount, 0))} color="#4F7FFA" />
              <StatPill label="Mis gastos" value={fmt(myPersonalTotal)} color={meColor} />
            </>
          )}
        </div>

        {catTotals.length > 0 && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "22px 0 10px" }}>
              <span style={{ fontSize: 20, fontWeight: 700, color: colors.text, fontFamily: FONT }}>Top categorías</span>
              {catTotals.length > 4 && (
                <button onClick={() => setCatExpanded(v => !v)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#4F7FFA", fontWeight: 600, fontFamily: FONT }}>
                  {catExpanded ? "Ver menos ▲" : `Ver todas (${catTotals.length}) ▼`}
                </button>
              )}
            </div>
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
          </>
        )}

        {/* ── GASTOS FIJOS en Inicio ── */}
        {visibleFixed.length > 0 && (
          <div style={{ marginTop: 8 }}>
            {/* Título principal desplegable */}
            <button onClick={() => setFixedExpanded(v => !v)} style={{ width: "100%", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 0 8px", fontFamily: FONT }}>
              <span style={{ fontSize: 20, fontWeight: 700, color: colors.text, fontFamily: FONT }}>📋 Gastos fijos</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, color: colors.textMuted, fontFamily: FONT }}>{fmt(fixedTotal)}</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.textMuted} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: fixedExpanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}><path d="M6 9l6 6 6-6"/></svg>
              </div>
            </button>

            {fixedExpanded && (
              <div>
                {/* Sección Hogar — solo en cuentas compartidas */}
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
                      <FixedExpenseHomeRow key={f.id} f={f} fmt={fmt} fs={fs} colors={colors} currentMonth={currentMonth} allMembers={allMembers} onMarkPaid={setPayingFixed} isPersonal={isPersonal} />
                    ))}
                  </>
                )}

                {/* Sección Personal — en compartidas como subsección, en personales directo */}
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
                      <FixedExpenseHomeRow key={f.id} f={f} fmt={fmt} fs={fs} colors={colors} currentMonth={currentMonth} allMembers={allMembers} onMarkPaid={setPayingFixed} isPersonal={isPersonal} />
                    ))}
                  </>
                )}

                {/* En cuentas personales: lista directa sin sub-secciones */}
                {isPersonal && visibleFixed.map(f => (
                  <FixedExpenseHomeRow key={f.id} f={f} fmt={fmt} fs={fs} colors={colors} currentMonth={currentMonth} allMembers={allMembers} onMarkPaid={setPayingFixed} isPersonal={isPersonal} />
                ))}
              </div>
            )}
          </div>
        )}

        <SectionTitle>Movimientos</SectionTitle>
        <div style={{ display: "flex", gap: 8, marginBottom: 16, overflowX: "auto", paddingBottom: 4 }}>
          {/* Filtro por tipo (solo cuentas compartidas) */}
          {!isPersonal && [["todos","Todos"],["hogar","🏠"],["personal","🎁"],["extraordinary","✈️"],["mio","👤"]].map(([val, lbl]) => (
            <button key={val} onClick={() => setFilterType(val)} style={{ whiteSpace: "nowrap", padding: "8px 14px", borderRadius: 20, border: "2px solid", cursor: "pointer", fontFamily: FONT, fontSize: 12, fontWeight: 600, borderColor: filterType === val ? "#4F7FFA" : colors.inputBorder, background: filterType === val ? "#4F7FFA" : colors.card, color: filterType === val ? "#fff" : colors.textMuted }}>{lbl}</button>
          ))}
          {/* Filtro por categoría (ambos tipos de cuenta) */}
          {isPersonal && [["todos", "Todos"], ...allCategories.filter(c => monthExp.some(e => e.category === c.id)).map(c => [c.id, c.icon])].map(([val, lbl]) => (
            <button key={val} onClick={() => setFilterType(val)} style={{ whiteSpace: "nowrap", padding: "8px 14px", borderRadius: 20, border: "2px solid", cursor: "pointer", fontFamily: FONT, fontSize: 12, fontWeight: 600, borderColor: filterType === val ? "#4F7FFA" : colors.inputBorder, background: filterType === val ? "#4F7FFA" : colors.card, color: filterType === val ? "#fff" : colors.textMuted }}>{lbl}</button>
          ))}
        </div>
        {sorted.length === 0 && (
          <Card style={{ textAlign: "center", color: colors.textMuted, padding: 32 }}>
            <p style={{ fontSize: 32, margin: "0 0 8px" }}>📭</p>
            <p style={{ margin: 0, fontFamily: FONT }}>Sin gastos este mes</p>
          </Card>
        )}
        {sorted.map(e => (
          <SwipeableExpenseRow key={`${e.id}-${e.deleted ? "del" : "ok"}`} e={e} allCategories={allCategories} allMembers={allMembers} fmt={fmt} fs={fs} colors={colors} onEdit={onEdit} onDelete={onDelete} isPersonal={isPersonal} currentUser={currentUser} />
        ))}
        {/* Settlements del mes */}
        {!isPersonal && monthSettlements.map(s => {
          const debtor   = allMembers?.find(m => m.uid === s.debtorUid);
          const creditor = allMembers?.find(m => m.uid === s.creditorUid);
          return (
            <div key={s.id} style={{ background: colors.card, borderRadius: 20, padding: "14px 16px", border: `1px solid ${colors.cardBorder}`, boxShadow: colors.shadow, marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 22 }}>🫱🏼‍🫲🏾</span>
                <div>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: fs.base, color: colors.text, fontFamily: FONT }}>
                    {debtor?.name || "?"} saldó con {creditor?.name || "?"}
                  </p>
                  <p style={{ margin: "2px 0 4px", fontSize: fs.sub, color: colors.textMuted, fontFamily: FONT }}>{fmtDate(s.date)}</p>
                  <Tag color="#2ecc71">{s.full ? "Saldo total" : "Saldo parcial"}</Tag>
                </div>
              </div>
              <p style={{ margin: 0, fontWeight: 700, fontSize: fs.base, color: colors.text, fontFamily: FONT, flexShrink: 0, marginLeft: 8 }}>{fmt(s.amount)}</p>
            </div>
          );
        })}
        <div style={{ height: 120 }} />
      </div>

      {/* Modal para marcar pago */}
      {payingFixed && (
        <MarkPaidModal
          fixedExpense={payingFixed}
          allMembers={allMembers}
          currentUser={currentUser}
          currentMonth={currentMonth}
          colors={colors}
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

// ── MODAL SALDO PARCIAL ──
function PartialSettleModal({ debtor, creditor, totalDebt, fmt, colors, onConfirm, onClose }) {
  const [amount, setAmount] = useState(totalDebt.toString());
  const [date, setDate]     = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const parsed = parseFloat(amount) || 0;
  const valid  = parsed > 0 && parsed <= totalDebt;

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
          <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: colors.textMuted, fontWeight: 600, fontFamily: FONT }}>$</span>
          <input
            type="number" inputMode="decimal"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            style={{ width: "100%", padding: "13px 14px 13px 30px", borderRadius: 14, border: `2px solid ${valid || !amount ? colors.inputBorder : "#e74c3c"}`, fontSize: 15, fontFamily: FONT, outline: "none", boxSizing: "border-box", color: colors.inputText, background: colors.input }}
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
function SaldosScreen({ expenses, fixedExpenses, members, account, currentMonth, currentUser, onAddExpense, settlements }) {
  const { colors } = useTheme();
  const { sendNotification } = useNotif();
  const fmt = (n) => formatAmount(n, account?.currency || "ARS");

  const monthExp = expenses.filter(e => e.month === currentMonth && !e.deleted);
  const visibleFixed = (fixedExpenses || []).filter(f => f.shared || f.createdBy === currentUser.uid);
  const monthSettlements = (settlements || []).filter(s => s.month === currentMonth);

  // Calcular saldos con todos los datos — memoizado para evitar recálculo en cada render
  const saldos = useMemo(
    () => calcSaldos(monthExp, visibleFixed, members, account?.divisionSystem, currentMonth, monthSettlements),
    [monthExp, visibleFixed, members, account?.divisionSystem, currentMonth, monthSettlements]
  );

  // Pares deudor→acreedor (usando balances ya con settlements descontados)
  const balances = (members || []).map(m => ({ ...m, balance: saldos[m.uid]?.balance || 0 }));
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
    const debtor   = members.find(m => m.uid === debtorUid);
    const creditor = members.find(m => m.uid === creditorUid);
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
      toUids: members.filter(m => m.uid !== debtorUid).map(m => m.uid),
      accountId: account?.id, accountName: account?.name,
    });
  };

  const handlePartialSettle = async ({ debtorUid, creditorUid, amount, date }) => {
    await addDoc(collection(db, "accounts", account.id, "settlements"), {
      debtorUid, creditorUid, amount, date, month: currentMonth, full: false,
    });
    setPartialModal(null);
  };

  // Como calcSaldos ya descuenta los settlements, los debtPairs ya tienen la deuda real
  // getRemainingDebt retorna directamente el monto del par (que ya es el remanente)
  const getRemainingDebt = (debtorUid, creditorUid, originalAmount) => originalAmount;

  // Siguiente mes para "pasar saldo"
  const nextMonth = (() => {
    const [y, m] = currentMonth.split("-").map(Number);
    const next = new Date(y, m, 1); // mes siguiente (m es 1-based pero Date usa 0-based, así que m sin -1 ya es el siguiente)
    return next.toISOString().slice(0, 7);
  })();

  const handlePassDebt = async (debts) => {
    const currentMonthName = new Date(currentMonth + "-02").toLocaleString("es-AR", { month: "long" });
    for (const d of debts) {
      await onAddExpense({
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
      });
    }
    setShowPassDebt(false);
  };

  // Deudas pendientes (restando pagos parciales)
  const pendingDebts = debtPairs
    .map(d => ({ ...d, remaining: getRemainingDebt(d.debtorUid, d.creditorUid, d.amount) }))
    .filter(d => d.remaining > 0);

  const totalSalary = (members || []).reduce((acc, mb) => acc + (mb.salary || 0), 0);

  return (
    <div style={{ padding: "0 20px", paddingTop: "calc(env(safe-area-inset-top) + 76px)", fontFamily: FONT }}>
      <SectionTitle>Saldos del mes</SectionTitle>

      {/* Tarjeta por miembro */}
      {members?.map(m => {
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

      {/* ── SALDADO DE CUENTAS ── */}
      <Card style={{ background: colors.headerBg, border: "none", marginTop: 8 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: "#ffffff55", textTransform: "uppercase", marginBottom: 12, fontFamily: FONT }}>Saldado de cuentas</p>

        {debtPairs.length === 0 ? (
          <div style={{ textAlign: "center", padding: "8px 0 4px" }}>
            <p style={{ fontSize: 28, margin: "0 0 6px" }}>🎉</p>
            <p style={{ color: "#fff", fontWeight: 700, margin: 0, fontFamily: FONT }}>¡Están al día!</p>
          </div>
        ) : (
          debtPairs.map(pair => {
            const debtor   = members.find(m => m.uid === pair.debtorUid);
            const creditor = members.find(m => m.uid === pair.creditorUid);
            const remaining = getRemainingDebt(pair.debtorUid, pair.creditorUid, pair.amount);
            const isSettled = remaining === 0 || settledPairs[pair.debtorUid];
            const pairSettlements = monthSettlements.filter(s => s.debtorUid === pair.debtorUid && s.creditorUid === pair.creditorUid);

            return (
              <div key={pair.debtorUid} style={{ marginBottom: 16 }}>
                {/* Resumen deuda */}
                <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 14, padding: "12px 14px", marginBottom: 8 }}>
                  <p style={{ margin: "0 0 2px", fontSize: 14, fontWeight: 700, color: "#fff", fontFamily: FONT }}>
                    {debtor?.name} le debe a {creditor?.name}
                  </p>
                  <p style={{ margin: 0, fontSize: 13, color: isSettled ? "#2ecc71" : "#FA4F7F", fontWeight: 600, fontFamily: FONT }}>
                    {isSettled ? "✅ Saldado" : fmt(remaining) + " pendiente"}
                  </p>
                  {/* Historial de pagos parciales */}
                  {pairSettlements.map(s => (
                    <p key={s.id} style={{ margin: "4px 0 0", fontSize: 11, color: "#ffffff88", fontFamily: FONT }}>
                      ✓ {fmt(s.amount)} pagado el {fmtDate(s.date)}
                    </p>
                  ))}
                </div>

                {/* Botones de acción */}
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

        {/* Pasar saldo al mes siguiente */}
        {pendingDebts.length > 0 && (
          <button onClick={() => setShowPassDebt(true)}
            style={{ width: "100%", marginTop: 8, padding: 13, borderRadius: 14, background: "rgba(255,255,255,0.1)", color: "#ffffffcc", border: "1px solid rgba(255,255,255,0.2)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>
            📅 Pasar saldo al mes siguiente
          </button>
        )}
      </Card>

      <div style={{ height: 120 }} />

      {/* Modales */}
      {partialModal && (
        <PartialSettleModal
          debtor={members.find(m => m.uid === partialModal.debtorUid)}
          creditor={members.find(m => m.uid === partialModal.creditorUid)}
          totalDebt={partialModal.amount}
          fmt={fmt}
          colors={colors}
          onConfirm={handlePartialSettle}
          onClose={() => setPartialModal(null)}
        />
      )}
      {showPassDebt && (
        <PassDebtModal
          debts={pendingDebts}
          members={members}
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

// ── GRAFICOS SCREEN ──
function GraficosScreen({ expenses, account, customCategories }) {
  const { colors } = useTheme();
  const fmt = (n) => formatAmount(n, account?.currency || "ARS");
  const allCategories = [...DEFAULT_CATEGORIES, ...(customCategories || [])];
  const allMonths = [...new Set(expenses.map(e => e.month))].sort();
  const last3 = allMonths.slice(-3);
  const monthLabel = (m) => new Date(m + "-02").toLocaleString("es-AR", { month: "short" });
  const barData = last3.map(m => ({
    mes: monthLabel(m),
    Hogar:    expenses.filter(e => e.month === m && e.type === "hogar").reduce((s, e) => s + e.amount, 0),
    Personal: expenses.filter(e => e.month === m && e.type === "mio").reduce((s, e) => s + e.amount, 0),
    Extra:    expenses.filter(e => e.month === m && e.type === "extraordinary").reduce((s, e) => s + e.amount, 0),
  }));
  const lastMonth = last3[last3.length - 1];
  const pieData = allCategories.map((c, i) => ({
    name: c.label,
    value: expenses.filter(e => e.month === lastMonth && e.category === c.id).reduce((s, e) => s + e.amount, 0),
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
      <SectionTitle>Comparación mensual</SectionTitle>
      <Card>
        {barData.length === 0 ? <p style={{ color: colors.textMuted, textAlign: "center", padding: 20, fontFamily: FONT }}>Sin datos aún</p> :
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={barData} barCategoryGap="30%">
              <XAxis dataKey="mes" tick={{ fontSize: 12, fill: colors.textMuted, fontFamily: FONT }} />
              <YAxis tick={{ fontSize: 10, fill: colors.textMuted, fontFamily: FONT }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={v => fmt(v)} contentStyle={{ background: colors.card, border: "none", borderRadius: 12, fontFamily: FONT }} />
              <Bar dataKey="Hogar"    fill="#4F7FFA" radius={[6,6,0,0]} />
              <Bar dataKey="Personal" fill="#2ecc71" radius={[6,6,0,0]} />
              <Bar dataKey="Extra"    fill="#f39c12" radius={[6,6,0,0]} />
            </BarChart>
          </ResponsiveContainer>}
        <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 6 }}>
          {[["#4F7FFA","Hogar"],["#2ecc71","Personal"],["#f39c12","Extra"]].map(([col, lbl]) => <div key={lbl} style={{ display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 10, height: 10, borderRadius: 3, background: col }} /><span style={{ fontSize: 11, color: colors.textMuted, fontFamily: FONT }}>{lbl}</span></div>)}
        </div>
      </Card>
      <SectionTitle>Por categoría — último mes</SectionTitle>
      <Card>
        {pieData.length === 0 ? <p style={{ color: colors.textMuted, textAlign: "center", padding: 20, fontFamily: FONT }}>Sin datos aún</p> :
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" outerRadius={80} dataKey="value" labelLine={false} label={renderCustomLabel}>
                {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
              <Tooltip formatter={v => fmt(v)} contentStyle={{ background: colors.card, border: "none", borderRadius: 12, fontFamily: FONT }} />
            </PieChart>
          </ResponsiveContainer>}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6, justifyContent: "center" }}>
          {pieData.map(p => <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 4 }}><div style={{ width: 8, height: 8, borderRadius: 2, background: p.color }} /><span style={{ fontSize: 11, color: colors.textMuted, fontFamily: FONT }}>{p.name}</span></div>)}
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
  const [authUser, setAuthUser]       = useState(undefined);
  const [userProfile, setUserProfile] = useState(null);
  const [initializing, setInitializing] = useState(true);
  const [account, setAccount]         = useState(null);
  const [members, setMembers]         = useState([]);
  const [expenses, setExpenses]       = useState([]);
  const [customCategories, setCustomCategories] = useState([]);
  const [fixedExpenses, setFixedExpenses]       = useState([]);
  const [settlements, setSettlements]           = useState([]);
  const [tab, setTab]                 = useState("home");
  const [showAdd, setShowAdd]         = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [showNotifs, setShowNotifs]   = useState(false);
  const [showMenu, setShowMenu]       = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState(null);
  const [userAccounts, setUserAccounts] = useState([]);
  const [showWelcome, setShowWelcome] = useState(true);
  const [pendingInviteId, setPendingInviteId] = useState(null);
  const [claimData, setClaimData]     = useState(null);
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
        const labels = accountData.memberLabels || [];
        const unlinked = labels.filter(l => !l.linkedUid);
        if (unlinked.length > 0) {
          setClaimData({ inviteId: pendingInviteId, accountId, accountData, memberLabels: unlinked });
          setPendingInviteId(null);
          return;
        }
        await finishJoinAccount({ inviteId: pendingInviteId, accountId, accountData, claimedLabelId: null });
        setPendingInviteId(null);
      } catch (err) { console.error("Error procesando invitación:", err); }
    };
    processInvite();
  }, [pendingInviteId, authUser]);

  const finishJoinAccount = async ({ inviteId, accountId, accountData, claimedLabelId }) => {
    try {
      const memberIds = accountData.memberIds || [];
      if (!memberIds.includes(authUser.uid)) await updateDoc(doc(db, "accounts", accountId), { memberIds: arrayUnion(authUser.uid) });
      if (claimedLabelId) {
        const updatedLabels = (accountData.memberLabels || []).map(l => l.id === claimedLabelId ? { ...l, linkedUid: authUser.uid } : l);
        await updateDoc(doc(db, "accounts", accountId), { memberLabels: updatedLabels });
        const labelName = (accountData.memberLabels || []).find(l => l.id === claimedLabelId)?.name;
        if (labelName) await setDoc(doc(db, "users", authUser.uid), { name: labelName }, { merge: true });
      }
      const userSnap = await getDoc(doc(db, "users", authUser.uid));
      const existingIds = userSnap.exists() ? (userSnap.data().accountIds || []) : [];
      if (!existingIds.includes(accountId)) await setDoc(doc(db, "users", authUser.uid), { accountIds: [...existingIds, accountId] }, { merge: true });
      await updateDoc(doc(db, "invites", inviteId), { used: true });
      setClaimData(null);
      setSelectedAccountId(accountId);
    } catch (err) { console.error("Error al unirse:", err); }
  };

  useEffect(() => {
    return onAuthStateChanged(auth, user => {
      // Resetear TODO el estado antes de cargar el nuevo usuario
      // Esto evita que se vean datos de una sesión anterior durante la transición
      setUserProfile(null);
      setAccount(null);
      setMembers([]);
      setUserAccounts([]);
      setAccountIds([]);
      setSelectedAccountId(null);

      setAuthUser(user || null);

      if (!user) {
        // Sin usuario — nada más que esperar
        setInitializing(false);
        setShowWelcome(true);
      } else {
        // Hay usuario — volver a initializing hasta que cargue su perfil
        setInitializing(true);
      }
    });
  }, []);

  // ── Un solo listener sobre users/{uid} — evita el doble-listener anterior ──
  const [accountIds, setAccountIds] = useState([]);
  useEffect(() => {
    if (!authUser) return;
    return onSnapshot(doc(db, "users", authUser.uid), snap => {
      const data = snap.data();
      setUserProfile(data || null);
      // Leer accountIds del mismo snapshot — sin segundo listener
      setAccountIds(data?.accountIds || (data?.accountId ? [data.accountId] : [authUser.uid]));
      // userProfile cargó — si no tiene cuentas aún alcanza para dejar de mostrar el spinner
      setInitializing(false);
    });
  }, [authUser]);

  // ── Listeners de cuentas reactivos a accountIds ──
  useEffect(() => {
    if (!accountIds.length) return;
    const unsubs = accountIds.map(id =>
      onSnapshot(doc(db, "accounts", id), aSnap => {
        if (aSnap.exists()) {
          setUserAccounts(prev => {
            const filtered = prev.filter(a => a.id !== id);
            return [...filtered, { id: aSnap.id, ...aSnap.data() }];
          });
        }
      })
    );
    return () => unsubs.forEach(u => u()); // cleanup correcto — fuera del callback
  }, [accountIds]);

  useEffect(() => {
    if (!selectedAccountId || userAccounts.length === 0) return;
    const acc = userAccounts.find(a => a.id === selectedAccountId);
    if (acc) { setAccount(acc); setMembers([]); }
  }, [selectedAccountId, userAccounts]);

  useEffect(() => {
    if (!account?.memberIds) return;
    setMembers([]);
    const ids = [...account.memberIds];
    const unsubs = ids.map(uid => onSnapshot(doc(db, "users", uid), snap => {
      if (snap.exists()) setMembers(prev => [...prev.filter(m => m.uid !== uid), { uid, ...snap.data() }]);
    }));
    return () => unsubs.forEach(u => u());
  }, [account?.memberIds?.join(",")]);

  // ── Expenses filtrados por cuenta — evita descargar toda la colección ──
  useEffect(() => {
    if (!account?.id) return;
    const q = query(
      collection(db, "expenses"),
      where("accountId", "==", account.id),
      orderBy("date", "desc")
    );
    return onSnapshot(q, snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setExpenses(data);
    });
  }, [account?.id]);

  useEffect(() => { if (!account?.id) return; return onSnapshot(collection(db, "accounts", account.id, "categories"), snap => { setCustomCategories(snap.docs.map(d => ({ id: d.id, ...d.data() }))); }); }, [account?.id]);
  useEffect(() => { if (!account?.id) return; return onSnapshot(collection(db, "accounts", account.id, "fixedExpenses"), snap => { setFixedExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() }))); }); }, [account?.id]);
  useEffect(() => { if (!account?.id) return; return onSnapshot(query(collection(db, "accounts", account.id, "settlements"), orderBy("date", "desc")), snap => { setSettlements(snap.docs.map(d => ({ id: d.id, ...d.data() }))); }); }, [account?.id]);


  // El query ya filtra por accountId — no se necesita filtrar en cliente
  // (retrocompatibilidad: gastos sin accountId ya no deberían existir con el nuevo ConfigScreen)

  const memberLabels = account?.memberLabels || [];
  const allMembers = [
    ...members,
    // Solo incluir labels que: (1) no están vinculados a un uid real, y
    // (2) ese uid real no está ya en members (evita duplicar al owner u otros miembros reales)
    ...memberLabels
      .filter(l => !l.linkedUid && !members.some(m => m.uid === l.id))
      .map(l => ({ uid: l.id, name: l.name, color: l.color, _isLabel: true })),
  ];

  const [deleteWarning, setDeleteWarning] = useState(null);

  const { sendNotification } = useNotif();

  const { addExpense, handleEditSave, deleteExpense, doDeleteExpense, markFixedPaid } = useExpenses({
    authUser, account, members, expenses,
    currentMonth, setExpenses, setEditingExpense,
    setDeleteWarning, sendNotification,
  });


  const [upgradeError, setUpgradeError] = useState("");
  const [upgrading, setUpgrading] = useState(false);

  const upgradeAnonymous = async () => {
    setUpgrading(true);
    setUpgradeError("");
    try {
      const result = await linkWithPopup(auth.currentUser, googleProvider);
      // Actualizar el perfil en Firestore con los datos de Google
      await setDoc(doc(db, "users", result.user.uid), {
        email: result.user.email,
        photo: result.user.photoURL || null,
        isAnonymous: false,
        // Preservar nombre solo si no tenía uno real aún
        ...(userProfile?.name ? {} : { name: result.user.displayName?.split(" ")[0] || "" }),
      }, { merge: true });
    } catch (err) {
      if (err.code === "auth/credential-already-in-use") {
        setUpgradeError("Esta cuenta de Google ya está en uso en otra sesión.");
      } else {
        setUpgradeError("No se pudo vincular la cuenta. Intentá de nuevo.");
      }
    } finally {
      setUpgrading(false);
    }
  };

  const handleSignOut = async () => { await signOut(auth); setUserProfile(null); setAccount(null); setMembers([]); setShowWelcome(true); };

  // ── Fix: tab redirect — debe estar antes de los returns condicionales ──
  useEffect(() => {
    if (account?.type === "personal" && tab === "saldos") {
      setTab("home");
    }
  }, [account?.type, tab]);

  if (initializing) return <Spinner text="Cargando..." />;
  if (authUser === undefined) return <Spinner text="Iniciando X-penses..." />;
  if (showWelcome) return <WelcomeScreen onEnter={() => setShowWelcome(false)} />;
  if (!authUser) return <AuthScreen />;
  if (!userProfile?.setupDone) return <ConfigScreen user={authUser} onDone={() => {}} />;
  if (!selectedAccountId) return <AccountSelectorScreen user={authUser} accounts={userAccounts} onSelect={setSelectedAccountId} onCreated={setSelectedAccountId} />;

  // Con el query filtrado por accountId, todos los expenses ya son de esta cuenta
  const accountExpenses = expenses;
  const isPersonal = account?.type === "personal";

  const NAV_LEFT = isPersonal
    ? [{ id: "home", label: "Inicio" }, { id: "graficos", label: "Gráficos" }]
    : [{ id: "home", label: "Inicio" }, { id: "saldos", label: "Saldos" }];
  const NAV_RIGHT = isPersonal
    ? [{ id: "ajustes", label: "Ajustes" }]
    : [{ id: "graficos", label: "Gráficos" }, { id: "ajustes", label: "Ajustes" }];

  return (
    <div style={{ width: "100%", maxWidth: 500, margin: "0 auto", background: colors.bg, minHeight: "100dvh", position: "relative", fontFamily: FONT, paddingLeft: "env(safe-area-inset-left)", paddingRight: "env(safe-area-inset-right)", boxSizing: "border-box", overflowX: "hidden" }}>
      <style>{`
        ${FONT_IMPORT}
        *, *::before, *::after { box-sizing: border-box; }
        html, body, #root { width: 100%; min-height: 100dvh; margin: 0; padding: 0; font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif; }
        body { -webkit-font-smoothing: antialiased; }
        input, button, select, textarea { font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif; }
        ::-webkit-scrollbar { display: none; }
      `}</style>

      <AppHeader account={account} onMenuOpen={() => setShowMenu(true)} onNotifsOpen={() => setShowNotifs(true)} unreadCount={unreadCount} colors={colors} />

      <div style={{ paddingBottom: NAV_HEIGHT + 20, minHeight: "100dvh" }}>
        {tab === "home"     && <HomeScreen expenses={accountExpenses} currentUser={authUser} allMembers={allMembers} account={account} currentMonth={currentMonth} customCategories={customCategories} fixedExpenses={fixedExpenses} onEdit={setEditingExpense} onDelete={deleteExpense} onMarkFixedPaid={markFixedPaid} settlements={settlements} />}
        {tab === "saldos"   && <SaldosScreen expenses={accountExpenses} fixedExpenses={fixedExpenses} members={members} account={account} currentMonth={currentMonth} currentUser={authUser} onAddExpense={addExpense} settlements={settlements} />}
        {tab === "graficos" && <GraficosScreen expenses={accountExpenses} account={account} customCategories={customCategories} />}
        {tab === "ajustes"  && <SettingsScreen currentUser={authUser} userProfile={userProfile} account={account} members={members} allMembers={allMembers} onSignOut={handleSignOut} onSwitchAccount={() => setSelectedAccountId(null)} />}
      </div>

      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, width: "100%", maxWidth: 500, margin: "0 auto", zIndex: 40 }}>
        <div style={{ position: "absolute", top: -28, left: "50%", transform: "translateX(-50%)", zIndex: 41 }}>
          <button onClick={() => setShowAdd(true)} style={{ width: 64, height: 64, borderRadius: 32, background: "linear-gradient(135deg,#4F7FFA,#3a6ae8)", border: "4px solid " + colors.navBg, color: "#fff", fontSize: 30, cursor: "pointer", boxShadow: "0 6px 24px #4F7FFA88", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
        </div>
        <div style={{ background: colors.navBg, borderTop: `1px solid ${colors.navBorder}`, display: "flex", alignItems: "center", padding: `10px 0 calc(16px + env(safe-area-inset-bottom))`, boxShadow: "0 -4px 20px rgba(0,0,0,0.08)" }}>
          {NAV_LEFT.map(n => (
            <button key={n.id} onClick={() => setTab(n.id)} style={{ flex: 1, background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, fontFamily: FONT, padding: "2px 0" }}>
              <NavIcon id={n.id} active={tab === n.id} color="#4F7FFA" />
              <span style={{ fontSize: 9, fontWeight: tab === n.id ? 700 : 500, letterSpacing: 0.2, color: tab === n.id ? "#4F7FFA" : colors.textSubtle, textTransform: "uppercase", fontFamily: FONT }}>{n.label}</span>
            </button>
          ))}
          <div style={{ flex: 1 }} />
          {NAV_RIGHT.map(n => (
            <button key={n.id} onClick={() => setTab(n.id)} style={{ flex: 1, background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, fontFamily: FONT, padding: "2px 0" }}>
              <NavIcon id={n.id} active={tab === n.id} color="#4F7FFA" />
              <span style={{ fontSize: 9, fontWeight: tab === n.id ? 700 : 500, letterSpacing: 0.2, color: tab === n.id ? "#4F7FFA" : colors.textSubtle, textTransform: "uppercase", fontFamily: FONT }}>{n.label}</span>
            </button>
          ))}
        </div>
      </div>

      {authUser?.isAnonymous && (
        <div style={{ position: "fixed", bottom: NAV_HEIGHT + 12, left: "50%", transform: "translateX(-50%)", width: "calc(100% - 32px)", maxWidth: 460, background: "linear-gradient(135deg,#1a1a2e,#0f3460)", borderRadius: 16, padding: "12px 16px", zIndex: 50, display: "flex", alignItems: "center", gap: 12, boxShadow: "0 4px 20px rgba(0,0,0,0.3)", border: "1px solid rgba(79,127,250,0.3)" }}>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#fff", fontFamily: FONT }}>Estás como invitado</p>
            <p style={{ margin: "2px 0 0", fontSize: 11, color: "#ffffff77", fontFamily: FONT }}>Vinculá tu cuenta de Google para no perder tus datos</p>
            {upgradeError && <p style={{ margin: "4px 0 0", fontSize: 11, color: "#FA4F7F", fontFamily: FONT }}>{upgradeError}</p>}
          </div>
          <button onClick={upgradeAnonymous} disabled={upgrading}
            style={{ background: "#4F7FFA", border: "none", borderRadius: 10, padding: "8px 14px", color: "#fff", fontSize: 12, fontWeight: 700, cursor: upgrading ? "default" : "pointer", fontFamily: FONT, flexShrink: 0, opacity: upgrading ? 0.7 : 1 }}>
            {upgrading ? "..." : "Vincular Google"}
          </button>
        </div>
      )}

      {showAdd && <AddExpenseModal onClose={() => setShowAdd(false)} onAdd={addExpense} currentUser={authUser} allMembers={allMembers} currency={account?.currency || "ARS"} customCategories={customCategories} isPersonal={isPersonal} />}
      {editingExpense && <EditExpenseModal expense={editingExpense} members={allMembers} customCategories={customCategories} currentUser={authUser} onClose={() => setEditingExpense(null)} onSave={handleEditSave} />}
      {showNotifs && <NotifCenter onClose={() => setShowNotifs(false)} />}
      {showMenu && <MenuPanel onClose={() => setShowMenu(false)} currentUser={authUser} userProfile={userProfile} members={members} account={account} onSignOut={handleSignOut} onSwitchAccount={() => setSelectedAccountId(null)} isDark={isDark} onToggleTheme={toggleTheme} colors={colors} />}
      {deleteWarning && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 300, display: "flex", alignItems: "flex-end" }}>
          <div style={{ background: colors.card, borderRadius: "24px 24px 0 0", width: "100%", padding: "24px 20px calc(40px + env(safe-area-inset-bottom))", fontFamily: FONT }}>
            <div style={{ width: 36, height: 4, background: colors.divider, borderRadius: 2, margin: "0 auto 20px" }} />
            <p style={{ fontSize: 18, fontWeight: 700, color: colors.text, margin: "0 0 8px", fontFamily: FONT }}>⚠️ Hay settlements registrados</p>
            <p style={{ fontSize: 14, color: colors.textMuted, margin: "0 0 6px", fontFamily: FONT, lineHeight: 1.5 }}>
              Este gasto afecta saldos que ya fueron saldados parcialmente este mes.
            </p>
            <div style={{ background: colors.pill, borderRadius: 12, padding: "10px 14px", marginBottom: 20 }}>
              <p style={{ margin: 0, fontSize: 13, color: colors.text, fontFamily: FONT, fontWeight: 600 }}>
                🗑️ {deleteWarning.expense.concept} — {formatAmount(deleteWarning.expense.amount, account?.currency || "ARS")}
              </p>
            </div>
            <button onClick={() => doDeleteExpense(deleteWarning.expense, true)}
              style={{ width: "100%", padding: 15, borderRadius: 14, background: "#e74c3c", color: "#fff", border: "none", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: FONT, marginBottom: 8 }}>
              🗑️ Eliminar y ajustar saldos automáticamente
            </button>
            <button onClick={() => doDeleteExpense(deleteWarning.expense, false)}
              style={{ width: "100%", padding: 14, borderRadius: 14, background: colors.pill, color: colors.text, border: "none", fontSize: 14, cursor: "pointer", fontFamily: FONT, marginBottom: 8 }}>
              Eliminar sin ajustar settlements
            </button>
            <button onClick={() => setDeleteWarning(null)}
              style={{ width: "100%", padding: 14, borderRadius: 14, background: "none", color: colors.textMuted, border: "none", fontSize: 14, cursor: "pointer", fontFamily: FONT }}>
              Cancelar
            </button>
          </div>
        </div>
      )}
      {claimData && (
        <ClaimIdentityModal claimData={claimData} colors={colors}
          onClaim={(labelId) => finishJoinAccount({ inviteId: claimData.inviteId, accountId: claimData.accountId, accountData: claimData.accountData, claimedLabelId: labelId })}
          onSkip={() => finishJoinAccount({ inviteId: claimData.inviteId, accountId: claimData.accountId, accountData: claimData.accountData, claimedLabelId: null })} />
      )}
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
