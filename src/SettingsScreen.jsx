import { useState, useEffect } from "react";
import { doc, setDoc, updateDoc, collection, addDoc, deleteDoc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";
import { useTheme } from "./theme.jsx";

const FONT = `'DM Sans', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif`;
const CURRENCIES = ["ARS", "USD", "EUR"];
const CURRENCY_SYMBOLS = { ARS: "$", USD: "U$S", EUR: "€" };
const MEMBER_COLORS = ["#4F7FFA","#FA4F7F","#2ecc71","#f39c12","#9b59b6","#1abc9c","#e74c3c","#3498db"];
const DEFAULT_CATEGORIES = [
  { id: "super",     label: "Supermercado",         icon: "🛒" },
  { id: "salidas",   label: "Salidas",               icon: "🍕" },
  { id: "servicios", label: "Impuestos y Servicios", icon: "💡" },
  { id: "transporte",label: "Transporte",            icon: "🚗" },
  { id: "salud",     label: "Salud",                 icon: "💊" },
  { id: "ropa",      label: "Ropa y Calzado",        icon: "👗" },
  { id: "hogar",     label: "Hogar",                 icon: "🏠" },
  { id: "otros",     label: "Otros",                 icon: "📦" },
];
const EMOJI_OPTIONS = ["🛒","🍕","💡","🚗","💊","👗","🏠","📦","🐶","✈️","🏋️","📚","📱","🎮","🍺","☕","🎁","💈","🎵","🏥","🌮","🧴","🎬","🏖️","🎓","💻","🛵","🧹","🪴","🐱"];
const FONT_SIZES = [
  { id: "small",  label: "Chica",   baseSize: 12 },
  { id: "medium", label: "Mediana", baseSize: 14 },
  { id: "large",  label: "Grande",  baseSize: 17 },
];

function SectionHeader({ title, colors }) {
  return <p style={{ fontSize: 11, fontWeight: 700, color: colors.textMuted, letterSpacing: 1.2, textTransform: "uppercase", margin: "24px 0 8px", fontFamily: FONT }}>{title}</p>;
}

function SettingRow({ icon, label, value, onPress, danger, colors }) {
  return (
    <button onClick={onPress} style={{ width: "100%", background: colors.card, border: "none", borderRadius: 16, padding: "14px 16px", marginBottom: 8, display: "flex", alignItems: "center", gap: 12, cursor: "pointer", fontFamily: FONT, boxShadow: colors.shadow, textAlign: "left" }}>
      <span style={{ fontSize: 20, width: 28 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: danger ? colors.danger : colors.text, fontFamily: FONT }}>{label}</p>
        {value && <p style={{ margin: "2px 0 0", fontSize: 12, color: colors.textMuted, fontFamily: FONT }}>{value}</p>}
      </div>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={colors.textMuted} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
    </button>
  );
}

function ShareAppModal({ onClose, colors }) {
  const appUrl = "https://xpenses.vercel.app";
  const [copied, setCopied] = useState(false);
  const handleCopy = () => { navigator.clipboard.writeText(appUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  const handleShare = () => { if (navigator.share) { navigator.share({ title: "X-penses", text: "Usá X-penses para llevar tus gastos compartidos", url: appUrl }); } else { handleCopy(); } };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 200, display: "flex", alignItems: "flex-end" }}>
      <div style={{ background: colors.card, borderRadius: "24px 24px 0 0", width: "100%", padding: "24px 20px 44px", fontFamily: FONT }}>
        <div style={{ width: 36, height: 4, background: colors.divider, borderRadius: 2, margin: "0 auto 20px" }} />
        <p style={{ fontSize: 20, fontWeight: 700, color: colors.text, margin: "0 0 6px", fontFamily: FONT }}>Compartir X-penses</p>
        <p style={{ color: colors.textMuted, fontSize: 14, margin: "0 0 24px", fontFamily: FONT }}>Invitá a otros a usar la app</p>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <img src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(appUrl)}`} style={{ borderRadius: 16, width: 160, height: 160 }} alt="QR" />
        </div>
        <div style={{ background: colors.pill, borderRadius: 12, padding: "12px 14px", marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, color: "#4F7FFA", fontWeight: 600, fontFamily: FONT }}>{appUrl}</span>
          <button onClick={handleCopy} style={{ background: copied ? "#2ecc71" : "#4F7FFA", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, color: "#fff", cursor: "pointer", fontFamily: FONT, fontWeight: 600, flexShrink: 0, marginLeft: 8 }}>{copied ? "✓ Copiado" : "Copiar"}</button>
        </div>
        <button onClick={handleShare} style={{ width: "100%", padding: 14, borderRadius: 14, background: "linear-gradient(135deg,#4F7FFA,#3a6ae8)", color: "#fff", border: "none", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: FONT, marginBottom: 8 }}>📤 Compartir</button>
        <button onClick={onClose} style={{ width: "100%", padding: 14, borderRadius: 14, background: colors.pill, color: colors.textMuted, border: "none", fontSize: 15, cursor: "pointer", fontFamily: FONT }}>Cerrar</button>
      </div>
    </div>
  );
}

function EditCategoryModal({ category, onSave, onClose, onDelete, isDefault, colors }) {
  const [label, setLabel] = useState(category.label);
  const [icon, setIcon]   = useState(category.icon);
  const inputStyle = { width: "100%", padding: "13px 14px", borderRadius: 14, border: `2px solid ${colors.inputBorder}`, fontSize: 15, marginBottom: 16, fontFamily: FONT, outline: "none", boxSizing: "border-box", color: colors.inputText, background: colors.input };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 200, display: "flex", alignItems: "flex-end" }}>
      <div style={{ background: colors.card, borderRadius: "24px 24px 0 0", width: "100%", padding: "24px 20px 44px", fontFamily: FONT, maxHeight: "85vh", overflowY: "auto" }}>
        <div style={{ width: 36, height: 4, background: colors.divider, borderRadius: 2, margin: "0 auto 20px" }} />
        <p style={{ fontSize: 18, fontWeight: 700, color: colors.text, margin: "0 0 20px", fontFamily: FONT }}>Editar categoría</p>
        <p style={{ fontSize: 11, fontWeight: 600, color: colors.textMuted, marginBottom: 6, letterSpacing: 0.6, textTransform: "uppercase", fontFamily: FONT }}>Nombre</p>
        <input value={label} onChange={e => setLabel(e.target.value)} style={inputStyle} />
        <p style={{ fontSize: 11, fontWeight: 600, color: colors.textMuted, marginBottom: 10, letterSpacing: 0.6, textTransform: "uppercase", fontFamily: FONT }}>Icono</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
          {EMOJI_OPTIONS.map(e => (
            <button key={e} onClick={() => setIcon(e)} style={{ width: 44, height: 44, borderRadius: 12, border: "2px solid", fontSize: 22, cursor: "pointer", borderColor: icon === e ? "#4F7FFA" : colors.inputBorder, background: icon === e ? "#4F7FFA11" : colors.input }}>{e}</button>
          ))}
        </div>
        <button onClick={() => onSave({ ...category, label, icon })} style={{ width: "100%", padding: 14, borderRadius: 14, background: "linear-gradient(135deg,#4F7FFA,#3a6ae8)", color: "#fff", border: "none", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: FONT, marginBottom: 8 }}>Guardar</button>
        {!isDefault && <button onClick={() => onDelete(category.id)} style={{ width: "100%", padding: 14, borderRadius: 14, background: colors.dangerBg, color: colors.danger, border: "none", fontSize: 15, cursor: "pointer", fontFamily: FONT, marginBottom: 8 }}>Eliminar</button>}
        <button onClick={onClose} style={{ width: "100%", padding: 14, borderRadius: 14, background: colors.pill, color: colors.textMuted, border: "none", fontSize: 15, cursor: "pointer", fontFamily: FONT }}>Cancelar</button>
      </div>
    </div>
  );
}

// ── MODAL GASTO FIJO ──
// shared: siempre presente en el form (Hogar o Personal)
// createdBy: uid del usuario que lo crea (para visibilidad de personales)
function FixedExpenseModal({ expense, onSave, onClose, colors, isPersonalAccount }) {
  const [form, setForm] = useState(
    expense || { name: "", amount: "", dueDay: "", shared: true }
  );
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const inputStyle = {
    width: "100%", padding: "13px 14px", borderRadius: 14,
    border: `2px solid ${colors.inputBorder}`, fontSize: 15, marginBottom: 14,
    fontFamily: FONT, outline: "none", boxSizing: "border-box",
    color: colors.inputText, background: colors.input,
  };
  const labelStyle = {
    fontSize: 11, fontWeight: 600, color: colors.textMuted,
    marginBottom: 6, letterSpacing: 0.6, textTransform: "uppercase", fontFamily: FONT,
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 200, display: "flex", alignItems: "flex-end" }}>
      <div style={{ background: colors.card, borderRadius: "24px 24px 0 0", width: "100%", padding: "24px 20px 44px", fontFamily: FONT, maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ width: 36, height: 4, background: colors.divider, borderRadius: 2, margin: "0 auto 20px" }} />
        <p style={{ fontSize: 18, fontWeight: 700, color: colors.text, margin: "0 0 20px", fontFamily: FONT }}>
          {expense?.id ? "Editar gasto fijo" : "Nuevo gasto fijo"}
        </p>

        <p style={labelStyle}>Nombre</p>
        <input value={form.name} onChange={e => set("name", e.target.value)} placeholder="Ej: Expensas, Netflix, Gym..." style={inputStyle} />

        <p style={labelStyle}>Monto</p>
        <input type="number" inputMode="decimal" value={form.amount} onChange={e => set("amount", e.target.value)} placeholder="0" style={inputStyle} />

        {/* Tipo: solo en cuentas compartidas */}
        {!isPersonalAccount && (
          <>
            <p style={labelStyle}>Tipo</p>
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              {[[true, "🏠 Hogar"], [false, "👤 Personal"]].map(([val, lbl]) => (
                <button key={String(val)} onClick={() => set("shared", val)}
                  style={{ flex: 1, padding: 12, borderRadius: 12, border: "2px solid", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: FONT,
                    borderColor: form.shared === val ? "#4F7FFA" : colors.inputBorder,
                    background: form.shared === val ? "#4F7FFA11" : colors.input,
                    color: form.shared === val ? "#4F7FFA" : colors.textMuted }}>
                  {lbl}
                </button>
              ))}
            </div>
          </>
        )}

        <p style={labelStyle}>Día de vencimiento (opcional)</p>
        <input
          type="number" inputMode="numeric"
          value={form.dueDay}
          onChange={e => set("dueDay", e.target.value)}
          placeholder="Ej: 10  (día del mes)"
          min="1" max="31"
          style={inputStyle}
        />
        {form.dueDay
          ? <p style={{ fontSize: 12, color: colors.textMuted, margin: "-10px 0 14px", fontFamily: FONT }}>Vence el día {form.dueDay} de cada mes</p>
          : null}

        <button
          onClick={() => onSave({ ...form, amount: parseFloat(form.amount) || 0, dueDay: parseInt(form.dueDay) || null })}
          style={{ width: "100%", padding: 14, borderRadius: 14, background: "linear-gradient(135deg,#4F7FFA,#3a6ae8)", color: "#fff", border: "none", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: FONT, marginBottom: 8 }}>
          Guardar
        </button>
        <button onClick={onClose} style={{ width: "100%", padding: 14, borderRadius: 14, background: colors.pill, color: colors.textMuted, border: "none", fontSize: 15, cursor: "pointer", fontFamily: FONT }}>Cancelar</button>
      </div>
    </div>
  );
}

// Modal para editar un miembro (label) de la cuenta
function EditMemberModal({ member, onSave, onClose, onDelete, colors }) {
  const [name, setName]   = useState(member.name || "");
  const [color, setColor] = useState(member.color || MEMBER_COLORS[0]);
  const inputStyle = { width: "100%", padding: "13px 14px", borderRadius: 14, border: `2px solid ${colors.inputBorder}`, fontSize: 15, marginBottom: 14, fontFamily: FONT, outline: "none", boxSizing: "border-box", color: colors.inputText, background: colors.input };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 200, display: "flex", alignItems: "flex-end" }}>
      <div style={{ background: colors.card, borderRadius: "24px 24px 0 0", width: "100%", padding: "24px 20px 44px", fontFamily: FONT }}>
        <div style={{ width: 36, height: 4, background: colors.divider, borderRadius: 2, margin: "0 auto 20px" }} />
        <p style={{ fontSize: 18, fontWeight: 700, color: colors.text, margin: "0 0 20px", fontFamily: FONT }}>{member.id ? "Editar miembro" : "Nuevo miembro"}</p>
        <p style={{ fontSize: 11, fontWeight: 600, color: colors.textMuted, marginBottom: 6, letterSpacing: 0.6, textTransform: "uppercase", fontFamily: FONT }}>Nombre</p>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Nombre del integrante" style={inputStyle} />
        <p style={{ fontSize: 11, fontWeight: 600, color: colors.textMuted, marginBottom: 10, letterSpacing: 0.6, textTransform: "uppercase", fontFamily: FONT }}>Color</p>
        <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
          {MEMBER_COLORS.map(c => (
            <button key={c} onClick={() => setColor(c)} style={{ width: 36, height: 36, borderRadius: 18, background: c, border: color === c ? "3px solid #fff" : "3px solid transparent", cursor: "pointer", boxShadow: color === c ? `0 0 0 2px ${c}` : "none" }} />
          ))}
        </div>
        <button onClick={() => onSave({ ...member, name: name.trim(), color })} disabled={!name.trim()}
          style={{ width: "100%", padding: 14, borderRadius: 14, background: !name.trim() ? "#aaa" : "linear-gradient(135deg,#4F7FFA,#3a6ae8)", color: "#fff", border: "none", fontSize: 15, fontWeight: 600, cursor: !name.trim() ? "default" : "pointer", fontFamily: FONT, marginBottom: 8 }}>
          Guardar
        </button>
        {member.id && !member.linkedUid && (
          <button onClick={() => onDelete(member.id)} style={{ width: "100%", padding: 14, borderRadius: 14, background: colors.dangerBg, color: colors.danger, border: "none", fontSize: 15, cursor: "pointer", fontFamily: FONT, marginBottom: 8 }}>
            Eliminar miembro
          </button>
        )}
        <button onClick={onClose} style={{ width: "100%", padding: 14, borderRadius: 14, background: colors.pill, color: colors.textMuted, border: "none", fontSize: 15, cursor: "pointer", fontFamily: FONT }}>Cancelar</button>
      </div>
    </div>
  );
}

// Fila de gasto fijo en Ajustes (con editar y eliminar)
function FixedRow({ f, colors, cardStyle, onEdit, onDelete }) {
  const isPaid = false; // en Ajustes no mostramos estado de pago, solo gestión
  return (
    <div style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ width: 40, height: 40, borderRadius: 14, background: f.shared ? "#4F7FFA14" : "#FA4F7F14", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
        {f.shared ? "🏠" : "👤"}
      </div>
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: colors.text, fontFamily: FONT }}>{f.name}</p>
        <p style={{ margin: "2px 0 0", fontSize: 12, color: colors.textMuted, fontFamily: FONT }}>
          ${(f.amount || 0).toLocaleString("es-AR")}{f.dueDay ? ` · Vence día ${f.dueDay}` : ""}
        </p>
      </div>
      <button onClick={() => onEdit(f)} style={{ background: "#4F7FFA11", border: "none", borderRadius: 10, padding: "6px 10px", fontSize: 12, color: "#4F7FFA", cursor: "pointer", fontFamily: FONT }}>✏️</button>
      <button onClick={() => onDelete(f.id)} style={{ background: colors.dangerBg, border: "none", borderRadius: 10, padding: "6px 10px", fontSize: 12, color: colors.danger, cursor: "pointer", fontFamily: FONT }}>✕</button>
    </div>
  );
}

export default function SettingsScreen({ currentUser, userProfile, account, members, allMembers, onSignOut, onSwitchAccount }) {
  const { colors } = useTheme();
  const isPersonal = account?.type === "personal";

  const [showShareApp,      setShowShareApp]      = useState(false);
  const [editingCategory,   setEditingCategory]   = useState(null);
  const [customCategories,  setCustomCategories]  = useState([]);
  const [fixedExpenses,     setFixedExpenses]     = useState([]);
  const [editingFixed,      setEditingFixed]      = useState(null);
  const [showNewFixed,      setShowNewFixed]      = useState(false);
  const [savingProfile,     setSavingProfile]     = useState(false);
  const [myName,            setMyName]            = useState(userProfile?.name || "");
  const [mySalary,          setMySalary]          = useState(userProfile?.salary?.toString() || "");
  const [selectedCurrency,  setSelectedCurrency]  = useState(account?.currency || "ARS");
  const [editingProfile,    setEditingProfile]    = useState(false);
  const [showInvite,        setShowInvite]        = useState(false);
  const [inviteLink,        setInviteLink]        = useState("");
  const [editingMember,     setEditingMember]     = useState(null);

  const [expenseFontSize, setExpenseFontSize] = useState(() => localStorage.getItem("expenseFontSize") || "medium");
  const handleFontSizeChange = (sizeId) => {
    setExpenseFontSize(sizeId);
    localStorage.setItem("expenseFontSize", sizeId);
    window.dispatchEvent(new CustomEvent("expenseFontSizeChange", { detail: sizeId }));
  };

  const cardStyle = { background: colors.card, borderRadius: 16, padding: "14px 16px", marginBottom: 8, boxShadow: colors.shadow, border: `1px solid ${colors.cardBorder}` };
  const inputStyle = { width: "100%", padding: "11px 13px", borderRadius: 12, border: `2px solid ${colors.inputBorder}`, fontSize: 15, marginBottom: 12, fontFamily: FONT, outline: "none", boxSizing: "border-box", color: colors.inputText, background: colors.input };

  useEffect(() => {
    if (!account?.id) return;
    const u1 = onSnapshot(collection(db, "accounts", account.id, "categories"), snap => {
      setCustomCategories(snap.docs.map(d => ({ id: d.id, ...d.data(), isCustom: true })));
    });
    const u2 = onSnapshot(collection(db, "accounts", account.id, "fixedExpenses"), snap => {
      setFixedExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => { u1(); u2(); };
  }, [account?.id]);

  const allCategories = [...DEFAULT_CATEGORIES.map(c => ({ ...c, isDefault: true })), ...customCategories];

  const saveProfile = async () => {
    setSavingProfile(true);
    await setDoc(doc(db, "users", currentUser.uid), { name: myName, salary: parseFloat(mySalary) || 0 }, { merge: true });
    setSavingProfile(false);
    setEditingProfile(false);
  };

  const saveCurrency = async (cur) => {
    setSelectedCurrency(cur);
    if (account?.id) await updateDoc(doc(db, "accounts", account.id), { currency: cur });
  };

  const handleSaveCategory = async (updated) => {
    if (updated.isDefault) {
      await setDoc(doc(db, "accounts", account.id, "categoryOverrides", updated.id), { label: updated.label, icon: updated.icon });
    } else {
      await setDoc(doc(db, "accounts", account.id, "categories", updated.id), { label: updated.label, icon: updated.icon }, { merge: true });
    }
    setEditingCategory(null);
  };

  const handleDeleteCategory = async (id) => {
    await deleteDoc(doc(db, "accounts", account.id, "categories", id));
    setEditingCategory(null);
  };

  const handleSaveFixed = async (data) => {
    const toSave = {
      ...data,
      // En cuentas personales siempre shared=false
      shared: isPersonal ? false : data.shared,
      // Guardar quién lo creó para filtrar visibilidad en "Personal"
      createdBy: currentUser.uid,
    };
    if (toSave.id) {
      const { id, ...rest } = toSave;
      await setDoc(doc(db, "accounts", account.id, "fixedExpenses", id), rest, { merge: true });
    } else {
      await addDoc(collection(db, "accounts", account.id, "fixedExpenses"), {
        ...toSave, createdAt: new Date().toISOString(),
      });
    }
    setEditingFixed(null);
    setShowNewFixed(false);
  };

  const handleDeleteFixed = async (id) => {
    await deleteDoc(doc(db, "accounts", account.id, "fixedExpenses", id));
  };

  const generateInvite = async () => {
    const ref = await addDoc(collection(db, "invites"), {
      accountId: account?.id, accountName: account?.name,
      createdBy: currentUser.uid, createdByName: userProfile?.name,
      createdAt: new Date().toISOString(), used: false,
    });
    const link = `${window.location.origin}?invite=${ref.id}`;
    setInviteLink(link);
    setShowInvite(true);
  };

  const handleSaveMember = async (updated) => {
    const currentLabels = account?.memberLabels || [];
    let newLabels;
    if (updated.id) {
      newLabels = currentLabels.map(l => l.id === updated.id ? { ...l, name: updated.name, color: updated.color } : l);
    } else {
      const newId = `label_${Date.now()}`;
      const color = MEMBER_COLORS[currentLabels.length % MEMBER_COLORS.length];
      newLabels = [...currentLabels, { id: newId, name: updated.name, color: updated.color || color, linkedUid: null }];
    }
    await updateDoc(doc(db, "accounts", account.id), { memberLabels: newLabels });
    setEditingMember(null);
  };

  const handleDeleteMember = async (labelId) => {
    const currentLabels = account?.memberLabels || [];
    const newLabels = currentLabels.filter(l => l.id !== labelId);
    await updateDoc(doc(db, "accounts", account.id), { memberLabels: newLabels });
    setEditingMember(null);
  };

  const memberLabels = account?.memberLabels || [];

  // Gastos fijos visibles para este usuario:
  // - Hogar (shared=true): todos los ven
  // - Personal (shared=false): solo el que lo creó
  const visibleFixed = fixedExpenses.filter(f =>
    f.shared || f.createdBy === currentUser.uid
  );
  const sharedFixed   = visibleFixed.filter(f => f.shared);
  const personalFixed = visibleFixed.filter(f => !f.shared);

  return (
    <div style={{ padding: "16px 20px", paddingTop: "calc(env(safe-area-inset-top) + 76px)", fontFamily: FONT, background: colors.bg, minHeight: "100vh" }}>

      {/* MI PERFIL */}
      <SectionHeader title="Mi Perfil" colors={colors} />
      <div style={cardStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: editingProfile ? 16 : 0 }}>
          {currentUser.photoURL
            ? <img src={currentUser.photoURL} style={{ width: 52, height: 52, borderRadius: 26 }} alt="" />
            : <div style={{ width: 52, height: 52, borderRadius: 26, background: "#4F7FFA22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>👤</div>}
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 16, color: colors.text, fontFamily: FONT }}>{userProfile?.name || currentUser.displayName}</p>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: colors.textMuted, fontFamily: FONT }}>{currentUser.email}</p>
          </div>
          <button onClick={() => setEditingProfile(!editingProfile)} style={{ background: "#4F7FFA11", border: "none", borderRadius: 10, padding: "6px 12px", fontSize: 12, color: "#4F7FFA", cursor: "pointer", fontFamily: FONT, fontWeight: 600 }}>
            {editingProfile ? "Cancelar" : "Editar"}
          </button>
        </div>
        {editingProfile && (
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: colors.textMuted, marginBottom: 6, letterSpacing: 0.6, textTransform: "uppercase", fontFamily: FONT }}>Nombre</p>
            <input value={myName} onChange={e => setMyName(e.target.value)} style={inputStyle} />
            {!isPersonal && (
              <>
                <p style={{ fontSize: 11, fontWeight: 600, color: colors.textMuted, marginBottom: 6, letterSpacing: 0.6, textTransform: "uppercase", fontFamily: FONT }}>Salario mensual</p>
                <input type="number" value={mySalary} onChange={e => setMySalary(e.target.value)} style={inputStyle} />
              </>
            )}
            <button onClick={saveProfile} disabled={savingProfile} style={{ width: "100%", padding: 12, borderRadius: 12, background: savingProfile ? "#aaa" : "#4F7FFA", color: "#fff", border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>
              {savingProfile ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        )}
      </div>

      {/* CONFIGURACIÓN DE CUENTA */}
      <SectionHeader title="Configuracion de Cuenta" colors={colors} />
      <div style={cardStyle}>
        <p style={{ margin: "0 0 4px", fontWeight: 700, fontSize: 15, color: colors.text, fontFamily: FONT }}>{account?.name || "Sin cuenta"}</p>
        <p style={{ margin: "0 0 14px", fontSize: 12, color: colors.textMuted, fontFamily: FONT }}>{isPersonal ? "Personal" : "Compartida"} · {account?.memberIds?.length || 1} miembro{(account?.memberIds?.length || 1) !== 1 ? "s" : ""}</p>
        <p style={{ fontSize: 11, fontWeight: 600, color: colors.textMuted, marginBottom: 8, letterSpacing: 0.6, textTransform: "uppercase", fontFamily: FONT }}>Moneda</p>
        <div style={{ display: "flex", gap: 8 }}>
          {CURRENCIES.map(c => (
            <button key={c} onClick={() => saveCurrency(c)} style={{ flex: 1, padding: "10px 0", borderRadius: 12, border: "2px solid", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: FONT, borderColor: selectedCurrency === c ? "#4F7FFA" : colors.inputBorder, background: selectedCurrency === c ? "#4F7FFA" : colors.input, color: selectedCurrency === c ? "#fff" : colors.textMuted }}>
              {CURRENCY_SYMBOLS[c]} {c}
            </button>
          ))}
        </div>
      </div>

      {/* APARIENCIA */}
      <SectionHeader title="Apariencia" colors={colors} />
      <div style={cardStyle}>
        <p style={{ margin: "0 0 14px", fontWeight: 700, fontSize: 14, color: colors.text, fontFamily: FONT }}>Tamano de letra</p>
        <div style={{ display: "flex", gap: 8 }}>
          {FONT_SIZES.map(s => (
            <button key={s.id} onClick={() => handleFontSizeChange(s.id)} style={{
              flex: 1, padding: "10px 0", borderRadius: 12, border: "2px solid", cursor: "pointer", fontFamily: FONT,
              borderColor: expenseFontSize === s.id ? "#4F7FFA" : colors.inputBorder,
              background: expenseFontSize === s.id ? "#4F7FFA" : colors.input,
              color: expenseFontSize === s.id ? "#fff" : colors.textMuted,
              display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
            }}>
              <span style={{ fontSize: s.baseSize, fontWeight: 700, lineHeight: 1 }}>Aa</span>
              <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}>{s.label}</span>
            </button>
          ))}
        </div>
        <div style={{ marginTop: 14, background: colors.pill, borderRadius: 12, padding: "12px 14px" }}>
          <p style={{ margin: "0 0 2px", fontWeight: 600, fontSize: FONT_SIZES.find(s => s.id === expenseFontSize)?.baseSize || 14, color: colors.text, fontFamily: FONT }}>Supermercado</p>
          <p style={{ margin: 0, fontSize: (FONT_SIZES.find(s => s.id === expenseFontSize)?.baseSize || 14) - 2, color: colors.textMuted, fontFamily: FONT }}>04-03-2025 · $12.500</p>
        </div>
      </div>

      {/* MIEMBROS */}
      <SectionHeader title="Miembros" colors={colors} />
      {members?.map(m => (
        <div key={m.uid} style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 12 }}>
          {m.photo
            ? <img src={m.photo} style={{ width: 40, height: 40, borderRadius: 20 }} alt="" />
            : <div style={{ width: 40, height: 40, borderRadius: 20, background: (m.color || "#4F7FFA") + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>👤</div>}
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: colors.text, fontFamily: FONT }}>
              {m.name} {m.uid === currentUser.uid && <span style={{ fontSize: 11, color: colors.textMuted }}>(vos)</span>}
            </p>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: colors.textMuted, fontFamily: FONT }}>
              {m.salary ? `$${(m.salary || 0).toLocaleString("es-AR")}/mes` : "Sin sueldo cargado"} · Vinculado ✓
            </p>
          </div>
        </div>
      ))}
      {!isPersonal && memberLabels.filter(l => !l.linkedUid).map(l => (
        <div key={l.id} style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 20, background: (l.color || "#4F7FFA") + "33", border: `2px solid ${l.color || "#4F7FFA"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: l.color || "#4F7FFA", fontFamily: FONT }}>{l.name[0]?.toUpperCase()}</span>
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: colors.text, fontFamily: FONT }}>{l.name}</p>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: colors.textMuted, fontFamily: FONT }}>Sin vincular · Pendiente de invitacion</p>
          </div>
          <button onClick={() => setEditingMember(l)} style={{ background: "#4F7FFA11", border: "none", borderRadius: 10, padding: "6px 10px", fontSize: 12, color: "#4F7FFA", cursor: "pointer", fontFamily: FONT }}>✏️</button>
        </div>
      ))}
      {!isPersonal && (
        <>
          <button onClick={() => setEditingMember({ name: "", color: MEMBER_COLORS[(memberLabels.length) % MEMBER_COLORS.length] })}
            style={{ width: "100%", padding: 14, borderRadius: 14, background: colors.pill, border: "2px dashed #4F7FFA", color: "#4F7FFA", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: FONT, marginBottom: 8 }}>
            + Agregar integrante
          </button>
          <SettingRow colors={colors} icon="🔗" label="Invitar a la cuenta" value="Compartí un link para que se unan" onPress={generateInvite} />
        </>
      )}

      {/* ── GASTOS FIJOS ── */}
      {/* En cuentas personales: lista única sin secciones */}
      {isPersonal ? (
        <>
          <SectionHeader title="Mis Gastos Fijos" colors={colors} />
          <p style={{ fontSize: 12, color: colors.textMuted, margin: "-4px 0 10px", fontFamily: FONT }}>Gastos que se repiten cada mes</p>
          {visibleFixed.length === 0 && (
            <div style={{ ...cardStyle, textAlign: "center", color: colors.textMuted, padding: 24 }}>
              <p style={{ fontSize: 28, margin: "0 0 6px" }}>📋</p>
              <p style={{ margin: 0, fontSize: 13, fontFamily: FONT }}>Sin gastos fijos</p>
            </div>
          )}
          {visibleFixed.map(f => (
            <FixedRow key={f.id} f={f} colors={colors} cardStyle={cardStyle} onEdit={setEditingFixed} onDelete={handleDeleteFixed} />
          ))}
          <button onClick={() => setShowNewFixed(true)} style={{ width: "100%", padding: 14, borderRadius: 14, background: colors.pill, border: "2px dashed #4F7FFA", color: "#4F7FFA", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: FONT, marginBottom: 8 }}>
            + Agregar gasto fijo
          </button>
        </>
      ) : (
        // En cuentas compartidas: sección única "Gastos Fijos" con lista unificada
        <>
          <SectionHeader title="Gastos Fijos" colors={colors} />
          <p style={{ fontSize: 12, color: colors.textMuted, margin: "-4px 0 10px", fontFamily: FONT }}>
            Gastos que se repiten cada mes. El tipo (Hogar o Personal) lo elegís al crear cada uno.
          </p>

          {visibleFixed.length === 0 && (
            <div style={{ ...cardStyle, textAlign: "center", color: colors.textMuted, padding: 24 }}>
              <p style={{ fontSize: 28, margin: "0 0 6px" }}>📋</p>
              <p style={{ margin: 0, fontSize: 13, fontFamily: FONT }}>Sin gastos fijos</p>
            </div>
          )}

          {/* Hogar */}
          {sharedFixed.length > 0 && (
            <>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#4F7FFA", letterSpacing: 0.8, textTransform: "uppercase", margin: "12px 0 6px", fontFamily: FONT }}>🏠 Hogar</p>
              {sharedFixed.map(f => (
                <FixedRow key={f.id} f={f} colors={colors} cardStyle={cardStyle} onEdit={setEditingFixed} onDelete={handleDeleteFixed} />
              ))}
            </>
          )}

          {/* Personal */}
          {personalFixed.length > 0 && (
            <>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#FA4F7F", letterSpacing: 0.8, textTransform: "uppercase", margin: "12px 0 6px", fontFamily: FONT }}>👤 Personal</p>
              {personalFixed.map(f => (
                <FixedRow key={f.id} f={f} colors={colors} cardStyle={cardStyle} onEdit={setEditingFixed} onDelete={handleDeleteFixed} />
              ))}
            </>
          )}

          <button onClick={() => setShowNewFixed(true)} style={{ width: "100%", padding: 14, borderRadius: 14, background: colors.pill, border: "2px dashed #4F7FFA", color: "#4F7FFA", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: FONT, marginBottom: 8 }}>
            + Agregar gasto fijo
          </button>
        </>
      )}

      {/* CATEGORÍAS */}
      <SectionHeader title="Categorias" colors={colors} />
      <div style={{ ...cardStyle, padding: 14 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {allCategories.map(c => (
            <button key={c.id} onClick={() => setEditingCategory(c)} style={{ padding: "9px 14px", borderRadius: 20, border: `2px solid ${colors.inputBorder}`, fontSize: 13, cursor: "pointer", fontFamily: FONT, display: "flex", alignItems: "center", gap: 6, background: colors.input, color: colors.text }}>
              {c.icon} {c.label} <span style={{ fontSize: 10, color: colors.textMuted }}>✏️</span>
            </button>
          ))}
          <button onClick={() => setEditingCategory({ id: null, label: "", icon: "📦", isNew: true })} style={{ padding: "9px 14px", borderRadius: 20, border: "2px dashed #4F7FFA", fontSize: 13, cursor: "pointer", fontFamily: FONT, color: "#4F7FFA", background: "#4F7FFA08", fontWeight: 600 }}>
            + Nueva
          </button>
        </div>
      </div>

      <div style={{ height: 100 }} />

      {/* MODALES */}
      {showShareApp && <ShareAppModal onClose={() => setShowShareApp(false)} colors={colors} />}

      {showInvite && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 200, display: "flex", alignItems: "flex-end" }}>
          <div style={{ background: colors.card, borderRadius: "24px 24px 0 0", width: "100%", padding: "24px 20px 44px", fontFamily: FONT }}>
            <div style={{ width: 36, height: 4, background: colors.divider, borderRadius: 2, margin: "0 auto 20px" }} />
            <p style={{ fontSize: 18, fontWeight: 700, color: colors.text, margin: "0 0 6px", fontFamily: FONT }}>Invitar a {account?.name}</p>
            <p style={{ color: colors.textMuted, fontSize: 13, margin: "0 0 20px", fontFamily: FONT }}>Compartí este link para que se unan a tu cuenta</p>
            <img src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(inviteLink)}`} style={{ display: "block", margin: "0 auto 16px", borderRadius: 12, width: 160, height: 160 }} alt="QR" />
            <div style={{ background: colors.pill, borderRadius: 12, padding: "12px 14px", marginBottom: 12 }}>
              <span style={{ fontSize: 12, color: "#4F7FFA", fontWeight: 600, wordBreak: "break-all", fontFamily: FONT }}>{inviteLink}</span>
            </div>
            <button onClick={() => { navigator.share ? navigator.share({ title: `Unirte a ${account?.name}`, url: inviteLink }) : navigator.clipboard.writeText(inviteLink); }}
              style={{ width: "100%", padding: 14, borderRadius: 14, background: "linear-gradient(135deg,#4F7FFA,#3a6ae8)", color: "#fff", border: "none", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: FONT, marginBottom: 8 }}>
              Compartir link
            </button>
            <button onClick={() => setShowInvite(false)} style={{ width: "100%", padding: 14, borderRadius: 14, background: colors.pill, color: colors.textMuted, border: "none", fontSize: 15, cursor: "pointer", fontFamily: FONT }}>Cerrar</button>
          </div>
        </div>
      )}

      {(editingFixed || showNewFixed) && (
        <FixedExpenseModal
          colors={colors}
          isPersonalAccount={isPersonal}
          expense={editingFixed || undefined}
          onSave={handleSaveFixed}
          onClose={() => { setEditingFixed(null); setShowNewFixed(false); }}
        />
      )}

      {editingCategory && (
        <EditCategoryModal
          colors={colors}
          category={editingCategory}
          isDefault={editingCategory.isDefault}
          onSave={editingCategory.isNew
            ? async (cat) => { await addDoc(collection(db, "accounts", account.id, "categories"), { label: cat.label, icon: cat.icon }); setEditingCategory(null); }
            : handleSaveCategory}
          onDelete={handleDeleteCategory}
          onClose={() => setEditingCategory(null)}
        />
      )}

      {editingMember && (
        <EditMemberModal
          colors={colors}
          member={editingMember}
          onSave={handleSaveMember}
          onDelete={handleDeleteMember}
          onClose={() => setEditingMember(null)}
        />
      )}
    </div>
  );
}
