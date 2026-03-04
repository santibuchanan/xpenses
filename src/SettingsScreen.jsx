import { useState, useEffect } from "react";
import { doc, setDoc, updateDoc, collection, addDoc, deleteDoc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";
import { useTheme } from "./theme.jsx";

const FONT = `'DM Sans', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif`;
const CURRENCIES = ["ARS", "USD", "EUR"];
const CURRENCY_SYMBOLS = { ARS: "$", USD: "U$S", EUR: "€" };
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
const EMOJI_OPTIONS = ["🛒","🍕","💡","🚗","💊","👗","🏠","📦","🐶","✈️","🏋️","📚","📱","🎮","🍺","☕","🎁","💈","🎵","🏥","🌮","🧴","🎬","🏖️","🎓","💻","🛵","🧹","🪴","🐱"];

// Tamaños de letra para gastos
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
        <p style={{ color: colors.textMuted, fontSize: 14, margin: "0 0 24px", fontFamily: FONT }}>Invitá a otros a usar la app para llevar sus propios gastos</p>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <img src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(appUrl)}`} style={{ borderRadius: 16, width: 160, height: 160 }} alt="QR" />
          <p style={{ color: colors.textMuted, fontSize: 12, margin: "8px 0 0", fontFamily: FONT }}>Escaneá para abrir la app</p>
        </div>
        <div style={{ background: colors.pill, borderRadius: 16, padding: 16, marginBottom: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: colors.text, margin: "0 0 10px", fontFamily: FONT }}>📲 Cómo instalarla en el celu</p>
          {[["1","iPhone","Abrí Safari → tocá el botón compartir → \"Agregar a pantalla de inicio\""],["2","Android","Abrí Chrome → tocá los 3 puntos → \"Instalar app\" o \"Agregar a pantalla de inicio\""]].map(([n,os,desc]) => (
            <div key={n} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 8 }}>
              <div style={{ width: 22, height: 22, borderRadius: 11, background: "#4F7FFA", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                <span style={{ color: "#fff", fontSize: 11, fontWeight: 700, fontFamily: FONT }}>{n}</span>
              </div>
              <div><p style={{ margin: "0 0 1px", fontSize: 12, fontWeight: 700, color: colors.text, fontFamily: FONT }}>{os}</p><p style={{ margin: 0, fontSize: 12, color: colors.textMuted, fontFamily: FONT }}>{desc}</p></div>
            </div>
          ))}
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
  const [icon, setIcon] = useState(category.icon);
  const inputStyle = { width: "100%", padding: "13px 14px", borderRadius: 14, border: `2px solid ${colors.inputBorder}`, fontSize: 15, marginBottom: 16, fontFamily: FONT, outline: "none", boxSizing: "border-box", color: colors.inputText, background: colors.input };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 200, display: "flex", alignItems: "flex-end" }}>
      <div style={{ background: colors.card, borderRadius: "24px 24px 0 0", width: "100%", padding: "24px 20px 44px", fontFamily: FONT, maxHeight: "85vh", overflowY: "auto" }}>
        <div style={{ width: 36, height: 4, background: colors.divider, borderRadius: 2, margin: "0 auto 20px" }} />
        <p style={{ fontSize: 18, fontWeight: 700, color: colors.text, margin: "0 0 20px", fontFamily: FONT }}>Editar categoría</p>
        <p style={{ fontSize: 11, fontWeight: 600, color: colors.textMuted, marginBottom: 6, letterSpacing: 0.6, textTransform: "uppercase", fontFamily: FONT }}>Nombre</p>
        <input value={label} onChange={e => setLabel(e.target.value)} style={inputStyle} />
        <p style={{ fontSize: 11, fontWeight: 600, color: colors.textMuted, marginBottom: 10, letterSpacing: 0.6, textTransform: "uppercase", fontFamily: FONT }}>Ícono</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
          {EMOJI_OPTIONS.map(e => (
            <button key={e} onClick={() => setIcon(e)} style={{ width: 44, height: 44, borderRadius: 12, border: "2px solid", fontSize: 22, cursor: "pointer", borderColor: icon === e ? "#4F7FFA" : colors.inputBorder, background: icon === e ? "#4F7FFA11" : colors.input }}>{e}</button>
          ))}
        </div>
        <button onClick={() => onSave({ ...category, label, icon })} style={{ width: "100%", padding: 14, borderRadius: 14, background: "linear-gradient(135deg,#4F7FFA,#3a6ae8)", color: "#fff", border: "none", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: FONT, marginBottom: 8 }}>Guardar</button>
        {!isDefault && <button onClick={() => onDelete(category.id)} style={{ width: "100%", padding: 14, borderRadius: 14, background: colors.dangerBg, color: colors.danger, border: "none", fontSize: 15, cursor: "pointer", fontFamily: FONT, marginBottom: 8 }}>🗑️ Eliminar</button>}
        <button onClick={onClose} style={{ width: "100%", padding: 14, borderRadius: 14, background: colors.pill, color: colors.textMuted, border: "none", fontSize: 15, cursor: "pointer", fontFamily: FONT }}>Cancelar</button>
      </div>
    </div>
  );
}

function FixedExpenseModal({ expense, onSave, onClose, colors }) {
  const [form, setForm] = useState(expense || { name: "", amount: "", category: "servicios", dueDay: "", shared: true });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const inputStyle = { width: "100%", padding: "13px 14px", borderRadius: 14, border: `2px solid ${colors.inputBorder}`, fontSize: 15, marginBottom: 14, fontFamily: FONT, outline: "none", boxSizing: "border-box", color: colors.inputText, background: colors.input };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 200, display: "flex", alignItems: "flex-end" }}>
      <div style={{ background: colors.card, borderRadius: "24px 24px 0 0", width: "100%", padding: "24px 20px 44px", fontFamily: FONT }}>
        <div style={{ width: 36, height: 4, background: colors.divider, borderRadius: 2, margin: "0 auto 20px" }} />
        <p style={{ fontSize: 18, fontWeight: 700, color: colors.text, margin: "0 0 20px", fontFamily: FONT }}>{expense?.id ? "Editar gasto fijo" : "Nuevo gasto fijo"}</p>
        <p style={{ fontSize: 11, fontWeight: 600, color: colors.textMuted, marginBottom: 6, letterSpacing: 0.6, textTransform: "uppercase", fontFamily: FONT }}>Nombre</p>
        <input value={form.name} onChange={e => set("name", e.target.value)} placeholder="Ej: Expensas, Netflix, Gym..." style={inputStyle} />
        <p style={{ fontSize: 11, fontWeight: 600, color: colors.textMuted, marginBottom: 6, letterSpacing: 0.6, textTransform: "uppercase", fontFamily: FONT }}>Monto</p>
        <input type="number" value={form.amount} onChange={e => set("amount", e.target.value)} placeholder="0" style={inputStyle} />
        <p style={{ fontSize: 11, fontWeight: 600, color: colors.textMuted, marginBottom: 6, letterSpacing: 0.6, textTransform: "uppercase", fontFamily: FONT }}>Día de vencimiento (opcional)</p>
        <input type="number" value={form.dueDay} onChange={e => set("dueDay", e.target.value)} placeholder="Ej: 10" min="1" max="31" style={inputStyle} />
        <p style={{ fontSize: 11, fontWeight: 600, color: colors.textMuted, marginBottom: 8, letterSpacing: 0.6, textTransform: "uppercase", fontFamily: FONT }}>Tipo</p>
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {[[true,"🏠 Hogar"],[false,"👤 Personal"]].map(([val, lbl]) => (
            <button key={String(val)} onClick={() => set("shared", val)} style={{ flex: 1, padding: 12, borderRadius: 12, border: "2px solid", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: FONT, borderColor: form.shared === val ? "#4F7FFA" : colors.inputBorder, background: form.shared === val ? "#4F7FFA11" : colors.input, color: form.shared === val ? "#4F7FFA" : colors.textMuted }}>{lbl}</button>
          ))}
        </div>
        <button onClick={() => onSave({ ...form, amount: parseFloat(form.amount) || 0, dueDay: parseInt(form.dueDay) || null })}
          style={{ width: "100%", padding: 14, borderRadius: 14, background: "linear-gradient(135deg,#4F7FFA,#3a6ae8)", color: "#fff", border: "none", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: FONT, marginBottom: 8 }}>
          Guardar
        </button>
        <button onClick={onClose} style={{ width: "100%", padding: 14, borderRadius: 14, background: colors.pill, color: colors.textMuted, border: "none", fontSize: 15, cursor: "pointer", fontFamily: FONT }}>Cancelar</button>
      </div>
    </div>
  );
}

export default function SettingsScreen({ currentUser, userProfile, account, members, onSignOut, onSwitchAccount }) {
  const { colors } = useTheme();
  const [showShareApp, setShowShareApp] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [customCategories, setCustomCategories] = useState([]);
  const [fixedExpenses, setFixedExpenses] = useState([]);
  const [editingFixed, setEditingFixed] = useState(null);
  const [showNewFixed, setShowNewFixed] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [myName, setMyName] = useState(userProfile?.name || "");
  const [mySalary, setMySalary] = useState(userProfile?.salary?.toString() || "");
  const [selectedCurrency, setSelectedCurrency] = useState(account?.currency || "ARS");
  const [editingProfile, setEditingProfile] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteLink, setInviteLink] = useState("");

  // Tamaño de letra — guardado en localStorage como preferencia local
  const [expenseFontSize, setExpenseFontSize] = useState(() => {
    return localStorage.getItem("expenseFontSize") || "medium";
  });

  const handleFontSizeChange = (sizeId) => {
    setExpenseFontSize(sizeId);
    localStorage.setItem("expenseFontSize", sizeId);
    // Despachar evento para que otros componentes puedan reaccionar
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
    if (data.id) {
      await setDoc(doc(db, "accounts", account.id, "fixedExpenses", data.id), data, { merge: true });
    } else {
      await addDoc(collection(db, "accounts", account.id, "fixedExpenses"), { ...data, createdAt: new Date().toISOString() });
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

  const sharedFixed = fixedExpenses.filter(f => f.shared);
  const personalFixed = fixedExpenses.filter(f => !f.shared);

  return (
    <div style={{ padding: "16px 20px", paddingTop: 90, fontFamily: FONT, background: colors.bg, minHeight: "100vh" }}>

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
            <p style={{ fontSize: 11, fontWeight: 600, color: colors.textMuted, marginBottom: 6, letterSpacing: 0.6, textTransform: "uppercase", fontFamily: FONT }}>Salario mensual</p>
            <input type="number" value={mySalary} onChange={e => setMySalary(e.target.value)} style={inputStyle} />
            <button onClick={saveProfile} disabled={savingProfile} style={{ width: "100%", padding: 12, borderRadius: 12, background: savingProfile ? "#aaa" : "#4F7FFA", color: "#fff", border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>
              {savingProfile ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        )}
      </div>

      {/* CONFIGURACIÓN DE CUENTA */}
      <SectionHeader title="Configuración de Cuenta" colors={colors} />
      <div style={cardStyle}>
        <p style={{ margin: "0 0 4px", fontWeight: 700, fontSize: 15, color: colors.text, fontFamily: FONT }}>{account?.name || "Sin cuenta"}</p>
        <p style={{ margin: "0 0 14px", fontSize: 12, color: colors.textMuted, fontFamily: FONT }}>{account?.type === "shared" ? "Compartida" : "Personal"} · {account?.memberIds?.length || 1} miembro{(account?.memberIds?.length || 1) !== 1 ? "s" : ""}</p>
        <p style={{ fontSize: 11, fontWeight: 600, color: colors.textMuted, marginBottom: 8, letterSpacing: 0.6, textTransform: "uppercase", fontFamily: FONT }}>Moneda</p>
        <div style={{ display: "flex", gap: 8 }}>
          {CURRENCIES.map(c => (
            <button key={c} onClick={() => saveCurrency(c)} style={{ flex: 1, padding: "10px 0", borderRadius: 12, border: "2px solid", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: FONT, borderColor: selectedCurrency === c ? "#4F7FFA" : colors.inputBorder, background: selectedCurrency === c ? "#4F7FFA" : colors.input, color: selectedCurrency === c ? "#fff" : colors.textMuted }}>
              {CURRENCY_SYMBOLS[c]} {c}
            </button>
          ))}
        </div>
      </div>

      {/* ── TAMAÑO DE LETRA PARA GASTOS ── */}
      <SectionHeader title="Apariencia" colors={colors} />
      <div style={cardStyle}>
        <p style={{ margin: "0 0 4px", fontWeight: 700, fontSize: 14, color: colors.text, fontFamily: FONT }}>Tamaño de letra — Gastos</p>
        <p style={{ margin: "0 0 14px", fontSize: 12, color: colors.textMuted, fontFamily: FONT }}>Elegí el tamaño que mejor se lea para vos</p>
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
        {/* Preview */}
        <div style={{ marginTop: 14, background: colors.pill, borderRadius: 12, padding: "12px 14px" }}>
          <p style={{ margin: "0 0 2px", fontWeight: 600, fontSize: FONT_SIZES.find(s => s.id === expenseFontSize)?.baseSize || 14, color: colors.text, fontFamily: FONT }}>Supermercado</p>
          <p style={{ margin: 0, fontSize: (FONT_SIZES.find(s => s.id === expenseFontSize)?.baseSize || 14) - 2, color: colors.textMuted, fontFamily: FONT }}>2025-03-04 · $12.500</p>
        </div>
      </div>

      {/* MIEMBROS */}
      <SectionHeader title="Miembros" colors={colors} />
      {members?.map(m => (
        <div key={m.uid} style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 12 }}>
          {m.photo ? <img src={m.photo} style={{ width: 40, height: 40, borderRadius: 20 }} alt="" /> : <div style={{ width: 40, height: 40, borderRadius: 20, background: (m.color || "#4F7FFA") + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>👤</div>}
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: colors.text, fontFamily: FONT }}>{m.name} {m.uid === currentUser.uid && <span style={{ fontSize: 11, color: colors.textMuted }}>(vos)</span>}</p>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: colors.textMuted, fontFamily: FONT }}>${(m.salary || 0).toLocaleString("es-AR")}/mes</p>
          </div>
        </div>
      ))}
      <SettingRow colors={colors} icon="🔗" label="Invitar a la cuenta" value="Compartí un link para que se unan" onPress={generateInvite} />

      {/* GASTOS FIJOS */}
      {account?.type === "personal" ? (
        <>
          <SectionHeader title="Mis Gastos Fijos" colors={colors} />
          <p style={{ fontSize: 12, color: colors.textMuted, margin: "-4px 0 10px", fontFamily: FONT }}>Gastos que se repiten cada mes</p>
          {fixedExpenses.length === 0 && (
            <div style={{ ...cardStyle, textAlign: "center", color: colors.textMuted, padding: 24 }}>
              <p style={{ fontSize: 28, margin: "0 0 6px" }}>📋</p>
              <p style={{ margin: 0, fontSize: 13, fontFamily: FONT }}>Sin gastos fijos</p>
            </div>
          )}
          {fixedExpenses.map(f => (
            <div key={f.id} style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 14, background: "#4F7FFA14", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>📋</div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: colors.text, fontFamily: FONT }}>{f.name}</p>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: colors.textMuted, fontFamily: FONT }}>${(f.amount || 0).toLocaleString("es-AR")}{f.dueDay ? ` · Vence día ${f.dueDay}` : ""}</p>
              </div>
              <button onClick={() => setEditingFixed(f)} style={{ background: "#4F7FFA11", border: "none", borderRadius: 10, padding: "6px 10px", fontSize: 12, color: "#4F7FFA", cursor: "pointer", fontFamily: FONT }}>✏️</button>
              <button onClick={() => handleDeleteFixed(f.id)} style={{ background: colors.dangerBg, border: "none", borderRadius: 10, padding: "6px 10px", fontSize: 12, color: colors.danger, cursor: "pointer", fontFamily: FONT }}>✕</button>
            </div>
          ))}
          <button onClick={() => setShowNewFixed("personal")} style={{ width: "100%", padding: 14, borderRadius: 14, background: colors.pill, border: `2px dashed #4F7FFA`, color: "#4F7FFA", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: FONT, marginBottom: 8 }}>
            + Agregar gasto fijo
          </button>
        </>
      ) : (
        <>
          <SectionHeader title="Gastos Fijos del Hogar" colors={colors} />
          <p style={{ fontSize: 12, color: colors.textMuted, margin: "-4px 0 10px", fontFamily: FONT }}>Expensas, servicios, alquiler y todo lo que se repite cada mes</p>
          {sharedFixed.length === 0 && (
            <div style={{ ...cardStyle, textAlign: "center", color: colors.textMuted, padding: 24 }}>
              <p style={{ fontSize: 28, margin: "0 0 6px" }}>🏠</p>
              <p style={{ margin: 0, fontSize: 13, fontFamily: FONT }}>Sin gastos fijos del hogar</p>
            </div>
          )}
          {sharedFixed.map(f => (
            <div key={f.id} style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 14, background: "#4F7FFA14", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>🏠</div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: colors.text, fontFamily: FONT }}>{f.name}</p>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: colors.textMuted, fontFamily: FONT }}>${(f.amount || 0).toLocaleString("es-AR")}{f.dueDay ? ` · Vence día ${f.dueDay}` : ""}</p>
              </div>
              <button onClick={() => setEditingFixed(f)} style={{ background: "#4F7FFA11", border: "none", borderRadius: 10, padding: "6px 10px", fontSize: 12, color: "#4F7FFA", cursor: "pointer", fontFamily: FONT }}>✏️</button>
              <button onClick={() => handleDeleteFixed(f.id)} style={{ background: colors.dangerBg, border: "none", borderRadius: 10, padding: "6px 10px", fontSize: 12, color: colors.danger, cursor: "pointer", fontFamily: FONT }}>✕</button>
            </div>
          ))}
          <button onClick={() => setShowNewFixed("hogar")} style={{ width: "100%", padding: 14, borderRadius: 14, background: colors.pill, border: `2px dashed #4F7FFA`, color: "#4F7FFA", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: FONT, marginBottom: 8 }}>
            + Agregar gasto fijo del hogar
          </button>

          <SectionHeader title="Mis Gastos Fijos" colors={colors} />
          <p style={{ fontSize: 12, color: colors.textMuted, margin: "-4px 0 10px", fontFamily: FONT }}>Agrega tus gastos fijos personales</p>
          {personalFixed.length === 0 && (
            <div style={{ ...cardStyle, textAlign: "center", color: colors.textMuted, padding: 24 }}>
              <p style={{ fontSize: 28, margin: "0 0 6px" }}>👤</p>
              <p style={{ margin: 0, fontSize: 13, fontFamily: FONT }}>Sin gastos fijos personales</p>
            </div>
          )}
          {personalFixed.map(f => (
            <div key={f.id} style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 14, background: "#FA4F7F14", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>👤</div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: colors.text, fontFamily: FONT }}>{f.name}</p>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: colors.textMuted, fontFamily: FONT }}>${(f.amount || 0).toLocaleString("es-AR")}{f.dueDay ? ` · Vence día ${f.dueDay}` : ""}</p>
              </div>
              <button onClick={() => setEditingFixed(f)} style={{ background: "#4F7FFA11", border: "none", borderRadius: 10, padding: "6px 10px", fontSize: 12, color: "#4F7FFA", cursor: "pointer", fontFamily: FONT }}>✏️</button>
              <button onClick={() => handleDeleteFixed(f.id)} style={{ background: colors.dangerBg, border: "none", borderRadius: 10, padding: "6px 10px", fontSize: 12, color: colors.danger, cursor: "pointer", fontFamily: FONT }}>✕</button>
            </div>
          ))}
          <button onClick={() => setShowNewFixed("personal")} style={{ width: "100%", padding: 14, borderRadius: 14, background: colors.pill, border: `2px dashed #FA4F7F`, color: "#FA4F7F", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: FONT, marginBottom: 8 }}>
            + Agregar gasto fijo personal
          </button>
        </>
      )}

      {/* CATEGORÍAS */}
      <SectionHeader title="Categorías" colors={colors} />
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

      {/* COMPARTIR */}
      <SectionHeader title="Compartir" colors={colors} />
      <SettingRow colors={colors} icon="📤" label="Compartir X-penses" value="Invitá a otros a usar la app" onPress={() => setShowShareApp(true)} />

      {/* CUENTAS */}
      <SectionHeader title="Cuentas" colors={colors} />
      <SettingRow colors={colors} icon="🔀" label="Cambiar de cuenta" value="Crear o seleccionar otra cuenta" onPress={onSwitchAccount} />

      {/* SESIÓN */}
      <SectionHeader title="Sesión" colors={colors} />
      <SettingRow colors={colors} icon="🚪" label="Cerrar sesión" danger onPress={onSignOut} />

      <div style={{ height: 100 }} />

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
            <button onClick={() => { navigator.share ? navigator.share({ title: `Unirte a ${account?.name}`, url: inviteLink }) : navigator.clipboard.writeText(inviteLink); }} style={{ width: "100%", padding: 14, borderRadius: 14, background: "linear-gradient(135deg,#4F7FFA,#3a6ae8)", color: "#fff", border: "none", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: FONT, marginBottom: 8 }}>
              📤 Compartir link
            </button>
            <button onClick={() => setShowInvite(false)} style={{ width: "100%", padding: 14, borderRadius: 14, background: colors.pill, color: colors.textMuted, border: "none", fontSize: 15, cursor: "pointer", fontFamily: FONT }}>Cerrar</button>
          </div>
        </div>
      )}

      {(editingFixed || showNewFixed) && (
        <FixedExpenseModal
          colors={colors}
          expense={editingFixed ? editingFixed : { shared: showNewFixed === "hogar" }}
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
    </div>
  );
}
