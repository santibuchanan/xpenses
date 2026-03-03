import { useState, useEffect } from "react";
import { doc, setDoc, updateDoc, collection, addDoc, deleteDoc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";

const SF = `-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', sans-serif`;
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

function SectionHeader({ title }) {
  return <p style={{ fontSize: 11, fontWeight: 700, color: "#888", letterSpacing: 1.2, textTransform: "uppercase", margin: "24px 0 8px", fontFamily: SF }}>{title}</p>;
}

function SettingRow({ icon, label, value, onPress, danger }) {
  return (
    <button onClick={onPress} style={{ width: "100%", background: "#fff", border: "none", borderRadius: 16, padding: "14px 16px", marginBottom: 8, display: "flex", alignItems: "center", gap: 12, cursor: "pointer", fontFamily: SF, boxShadow: "0 1px 6px rgba(0,0,0,0.05)", textAlign: "left" }}>
      <span style={{ fontSize: 20, width: 28 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: danger ? "#e74c3c" : "#1a1a2e" }}>{label}</p>
        {value && <p style={{ margin: "2px 0 0", fontSize: 12, color: "#aaa" }}>{value}</p>}
      </div>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
    </button>
  );
}

function ShareAppModal({ onClose }) {
  const appUrl = "https://xpenses.vercel.app";
  const [copied, setCopied] = useState(false);
  const handleCopy = () => { navigator.clipboard.writeText(appUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  const handleShare = () => { if (navigator.share) { navigator.share({ title: "X-penses", text: "Usá X-penses para llevar tus gastos compartidos", url: appUrl }); } else { handleCopy(); } };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 200, display: "flex", alignItems: "flex-end" }}>
      <div style={{ background: "#fff", borderRadius: "24px 24px 0 0", width: "100%", padding: "24px 20px 44px", fontFamily: SF }}>
        <div style={{ width: 36, height: 4, background: "#eee", borderRadius: 2, margin: "0 auto 20px" }} />
        <p style={{ fontSize: 20, fontWeight: 700, color: "#1a1a2e", margin: "0 0 6px" }}>Compartir X-penses</p>
        <p style={{ color: "#aaa", fontSize: 14, margin: "0 0 24px" }}>Invitá a otros a usar la app para llevar sus propios gastos</p>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <img src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(appUrl)}`} style={{ borderRadius: 16, width: 160, height: 160 }} alt="QR" />
          <p style={{ color: "#aaa", fontSize: 12, margin: "8px 0 0" }}>Escaneá para abrir la app</p>
        </div>
        <div style={{ background: "#f7f8fc", borderRadius: 16, padding: 16, marginBottom: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#1a1a2e", margin: "0 0 10px" }}>📲 Cómo instalarla en el celu</p>
          {[["1","iPhone","Abrí Safari → tocá el botón compartir → \"Agregar a pantalla de inicio\""],["2","Android","Abrí Chrome → tocá los 3 puntos → \"Instalar app\" o \"Agregar a pantalla de inicio\""]].map(([n,os,desc]) => (
            <div key={n} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 8 }}>
              <div style={{ width: 22, height: 22, borderRadius: 11, background: "#4F7FFA", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                <span style={{ color: "#fff", fontSize: 11, fontWeight: 700 }}>{n}</span>
              </div>
              <div><p style={{ margin: "0 0 1px", fontSize: 12, fontWeight: 700, color: "#1a1a2e" }}>{os}</p><p style={{ margin: 0, fontSize: 12, color: "#888" }}>{desc}</p></div>
            </div>
          ))}
        </div>
        <div style={{ background: "#f0f4ff", borderRadius: 12, padding: "12px 14px", marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, color: "#4F7FFA", fontWeight: 600 }}>{appUrl}</span>
          <button onClick={handleCopy} style={{ background: copied ? "#2ecc71" : "#4F7FFA", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, color: "#fff", cursor: "pointer", fontFamily: SF, fontWeight: 600, flexShrink: 0, marginLeft: 8 }}>{copied ? "✓ Copiado" : "Copiar"}</button>
        </div>
        <button onClick={handleShare} style={{ width: "100%", padding: 14, borderRadius: 14, background: "linear-gradient(135deg,#4F7FFA,#3a6ae8)", color: "#fff", border: "none", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: SF, marginBottom: 8 }}>📤 Compartir</button>
        <button onClick={onClose} style={{ width: "100%", padding: 14, borderRadius: 14, background: "#f0f0f0", color: "#555", border: "none", fontSize: 15, cursor: "pointer", fontFamily: SF }}>Cerrar</button>
      </div>
    </div>
  );
}

function EditCategoryModal({ category, onSave, onClose, onDelete, isDefault }) {
  const [label, setLabel] = useState(category.label);
  const [icon, setIcon] = useState(category.icon);
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 200, display: "flex", alignItems: "flex-end" }}>
      <div style={{ background: "#fff", borderRadius: "24px 24px 0 0", width: "100%", padding: "24px 20px 44px", fontFamily: SF, maxHeight: "85vh", overflowY: "auto" }}>
        <div style={{ width: 36, height: 4, background: "#eee", borderRadius: 2, margin: "0 auto 20px" }} />
        <p style={{ fontSize: 18, fontWeight: 700, color: "#1a1a2e", margin: "0 0 20px" }}>Editar categoría</p>
        <p style={{ fontSize: 11, fontWeight: 600, color: "#888", marginBottom: 6, letterSpacing: 0.6, textTransform: "uppercase" }}>Nombre</p>
        <input value={label} onChange={e => setLabel(e.target.value)} style={{ width: "100%", padding: "13px 14px", borderRadius: 14, border: "2px solid #e8e8e8", fontSize: 15, marginBottom: 16, fontFamily: SF, outline: "none", boxSizing: "border-box", color: "#1a1a2e", background: "#fafafa" }} />
        <p style={{ fontSize: 11, fontWeight: 600, color: "#888", marginBottom: 10, letterSpacing: 0.6, textTransform: "uppercase" }}>Ícono</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
          {EMOJI_OPTIONS.map(e => (
            <button key={e} onClick={() => setIcon(e)} style={{ width: 44, height: 44, borderRadius: 12, border: "2px solid", fontSize: 22, cursor: "pointer", borderColor: icon === e ? "#4F7FFA" : "#e8e8e8", background: icon === e ? "#4F7FFA11" : "#fafafa" }}>{e}</button>
          ))}
        </div>
        <button onClick={() => onSave({ ...category, label, icon })} style={{ width: "100%", padding: 14, borderRadius: 14, background: "linear-gradient(135deg,#4F7FFA,#3a6ae8)", color: "#fff", border: "none", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: SF, marginBottom: 8 }}>Guardar</button>
        {!isDefault && <button onClick={() => onDelete(category.id)} style={{ width: "100%", padding: 14, borderRadius: 14, background: "#fee", color: "#e74c3c", border: "none", fontSize: 15, cursor: "pointer", fontFamily: SF, marginBottom: 8 }}>🗑️ Eliminar</button>}
        <button onClick={onClose} style={{ width: "100%", padding: 14, borderRadius: 14, background: "#f0f0f0", color: "#555", border: "none", fontSize: 15, cursor: "pointer", fontFamily: SF }}>Cancelar</button>
      </div>
    </div>
  );
}

function FixedExpenseModal({ expense, onSave, onClose }) {
  const [form, setForm] = useState(expense || { name: "", amount: "", category: "servicios", dueDay: "", shared: true });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 200, display: "flex", alignItems: "flex-end" }}>
      <div style={{ background: "#fff", borderRadius: "24px 24px 0 0", width: "100%", padding: "24px 20px 44px", fontFamily: SF }}>
        <div style={{ width: 36, height: 4, background: "#eee", borderRadius: 2, margin: "0 auto 20px" }} />
        <p style={{ fontSize: 18, fontWeight: 700, color: "#1a1a2e", margin: "0 0 20px" }}>{expense ? "Editar gasto fijo" : "Nuevo gasto fijo"}</p>
        <p style={{ fontSize: 11, fontWeight: 600, color: "#888", marginBottom: 6, letterSpacing: 0.6, textTransform: "uppercase" }}>Nombre</p>
        <input value={form.name} onChange={e => set("name", e.target.value)} placeholder="Ej: Expensas, Netflix, Gym..." style={{ width: "100%", padding: "13px 14px", borderRadius: 14, border: "2px solid #e8e8e8", fontSize: 15, marginBottom: 14, fontFamily: SF, outline: "none", boxSizing: "border-box", color: "#1a1a2e", background: "#fafafa" }} />
        <p style={{ fontSize: 11, fontWeight: 600, color: "#888", marginBottom: 6, letterSpacing: 0.6, textTransform: "uppercase" }}>Monto</p>
        <input type="number" value={form.amount} onChange={e => set("amount", e.target.value)} placeholder="0" style={{ width: "100%", padding: "13px 14px", borderRadius: 14, border: "2px solid #e8e8e8", fontSize: 15, marginBottom: 14, fontFamily: SF, outline: "none", boxSizing: "border-box", color: "#1a1a2e", background: "#fafafa" }} />
        <p style={{ fontSize: 11, fontWeight: 600, color: "#888", marginBottom: 6, letterSpacing: 0.6, textTransform: "uppercase" }}>Día de vencimiento (opcional)</p>
        <input type="number" value={form.dueDay} onChange={e => set("dueDay", e.target.value)} placeholder="Ej: 10" min="1" max="31" style={{ width: "100%", padding: "13px 14px", borderRadius: 14, border: "2px solid #e8e8e8", fontSize: 15, marginBottom: 14, fontFamily: SF, outline: "none", boxSizing: "border-box", color: "#1a1a2e", background: "#fafafa" }} />
        <p style={{ fontSize: 11, fontWeight: 600, color: "#888", marginBottom: 8, letterSpacing: 0.6, textTransform: "uppercase" }}>Tipo</p>
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {[[true,"🏠 Hogar"],[false,"👤 Personal"]].map(([val, lbl]) => (
            <button key={String(val)} onClick={() => set("shared", val)} style={{ flex: 1, padding: 12, borderRadius: 12, border: "2px solid", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: SF, borderColor: form.shared === val ? "#4F7FFA" : "#e8e8e8", background: form.shared === val ? "#4F7FFA11" : "#fafafa", color: form.shared === val ? "#4F7FFA" : "#555" }}>{lbl}</button>
          ))}
        </div>
        <button onClick={() => onSave({ ...form, amount: parseFloat(form.amount) || 0, dueDay: parseInt(form.dueDay) || null })}
          style={{ width: "100%", padding: 14, borderRadius: 14, background: "linear-gradient(135deg,#4F7FFA,#3a6ae8)", color: "#fff", border: "none", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: SF, marginBottom: 8 }}>
          Guardar
        </button>
        <button onClick={onClose} style={{ width: "100%", padding: 14, borderRadius: 14, background: "#f0f0f0", color: "#555", border: "none", fontSize: 15, cursor: "pointer", fontFamily: SF }}>Cancelar</button>
      </div>
    </div>
  );
}

export default function SettingsScreen({ currentUser, userProfile, account, members, onSignOut, onSwitchAccount }) {
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

  const cardStyle = { background: "#fff", borderRadius: 16, padding: "14px 16px", marginBottom: 8, boxShadow: "0 1px 6px rgba(0,0,0,0.05)" };
  const sharedFixed = fixedExpenses.filter(f => f.shared);
  const personalFixed = fixedExpenses.filter(f => !f.shared);

  return (
    <div style={{ padding: "16px 20px", fontFamily: SF, background: "#f7f8fc", minHeight: "100vh" }}>

      {/* MI PERFIL */}
      <SectionHeader title="Mi Perfil" />
      <div style={cardStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: editingProfile ? 16 : 0 }}>
          {currentUser.photoURL
            ? <img src={currentUser.photoURL} style={{ width: 52, height: 52, borderRadius: 26 }} alt="" />
            : <div style={{ width: 52, height: 52, borderRadius: 26, background: "#4F7FFA22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>👤</div>}
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 16, color: "#1a1a2e" }}>{userProfile?.name || currentUser.displayName}</p>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "#aaa" }}>{currentUser.email}</p>
          </div>
          <button onClick={() => setEditingProfile(!editingProfile)} style={{ background: "#4F7FFA11", border: "none", borderRadius: 10, padding: "6px 12px", fontSize: 12, color: "#4F7FFA", cursor: "pointer", fontFamily: SF, fontWeight: 600 }}>
            {editingProfile ? "Cancelar" : "Editar"}
          </button>
        </div>
        {editingProfile && (
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: "#888", marginBottom: 6, letterSpacing: 0.6, textTransform: "uppercase" }}>Nombre</p>
            <input value={myName} onChange={e => setMyName(e.target.value)} style={{ width: "100%", padding: "11px 13px", borderRadius: 12, border: "2px solid #e8e8e8", fontSize: 15, marginBottom: 12, fontFamily: SF, outline: "none", boxSizing: "border-box", color: "#1a1a2e", background: "#fafafa" }} />
            <p style={{ fontSize: 11, fontWeight: 600, color: "#888", marginBottom: 6, letterSpacing: 0.6, textTransform: "uppercase" }}>Salario mensual</p>
            <input type="number" value={mySalary} onChange={e => setMySalary(e.target.value)} style={{ width: "100%", padding: "11px 13px", borderRadius: 12, border: "2px solid #e8e8e8", fontSize: 15, marginBottom: 12, fontFamily: SF, outline: "none", boxSizing: "border-box", color: "#1a1a2e", background: "#fafafa" }} />
            <button onClick={saveProfile} disabled={savingProfile} style={{ width: "100%", padding: 12, borderRadius: 12, background: savingProfile ? "#aaa" : "#4F7FFA", color: "#fff", border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: SF }}>
              {savingProfile ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        )}
      </div>

      {/* CONFIGURACIÓN DE CUENTA */}
      <SectionHeader title="Configuración de Cuenta" />
      <div style={cardStyle}>
        <p style={{ margin: "0 0 4px", fontWeight: 700, fontSize: 15, color: "#1a1a2e" }}>{account?.name || "Sin cuenta"}</p>
        <p style={{ margin: "0 0 14px", fontSize: 12, color: "#aaa" }}>{account?.type === "shared" ? "Compartida" : "Personal"} · {account?.memberIds?.length || 1} miembro{(account?.memberIds?.length || 1) !== 1 ? "s" : ""}</p>
        <p style={{ fontSize: 11, fontWeight: 600, color: "#888", marginBottom: 8, letterSpacing: 0.6, textTransform: "uppercase" }}>Moneda</p>
        <div style={{ display: "flex", gap: 8 }}>
          {CURRENCIES.map(c => (
            <button key={c} onClick={() => saveCurrency(c)} style={{ flex: 1, padding: "10px 0", borderRadius: 12, border: "2px solid", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: SF, borderColor: selectedCurrency === c ? "#4F7FFA" : "#e8e8e8", background: selectedCurrency === c ? "#4F7FFA" : "#fafafa", color: selectedCurrency === c ? "#fff" : "#555" }}>
              {CURRENCY_SYMBOLS[c]} {c}
            </button>
          ))}
        </div>
      </div>

      {/* MIEMBROS */}
      <SectionHeader title="Miembros" />
      {members?.map(m => (
        <div key={m.uid} style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 12 }}>
          {m.photo ? <img src={m.photo} style={{ width: 40, height: 40, borderRadius: 20 }} alt="" /> : <div style={{ width: 40, height: 40, borderRadius: 20, background: (m.color || "#4F7FFA") + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>👤</div>}
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: "#1a1a2e" }}>{m.name} {m.uid === currentUser.uid && <span style={{ fontSize: 11, color: "#aaa" }}>(vos)</span>}</p>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "#aaa" }}>${(m.salary || 0).toLocaleString("es-AR")}/mes</p>
          </div>
        </div>
      ))}
      <SettingRow icon="🔗" label="Invitar a la cuenta" value="Compartí un link para que se unan" onPress={generateInvite} />

      {/* GASTOS FIJOS — HOGAR */}
      <SectionHeader title="Gastos Fijos del Hogar" />
      <p style={{ fontSize: 12, color: "#aaa", margin: "-4px 0 10px", fontFamily: SF }}>Expensas, servicios, alquiler y todo lo que se repite cada mes</p>
      {sharedFixed.length === 0 && (
        <div style={{ ...cardStyle, textAlign: "center", color: "#aaa", padding: 24 }}>
          <p style={{ fontSize: 28, margin: "0 0 6px" }}>🏠</p>
          <p style={{ margin: 0, fontSize: 13 }}>Sin gastos fijos del hogar</p>
        </div>
      )}
      {sharedFixed.map(f => (
        <div key={f.id} style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 14, background: "#4F7FFA14", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>🏠</div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: "#1a1a2e" }}>{f.name}</p>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "#aaa" }}>
              ${(f.amount || 0).toLocaleString("es-AR")}{f.dueDay ? ` · Vence día ${f.dueDay}` : ""}
            </p>
          </div>
          <button onClick={() => setEditingFixed(f)} style={{ background: "#4F7FFA11", border: "none", borderRadius: 10, padding: "6px 10px", fontSize: 12, color: "#4F7FFA", cursor: "pointer", fontFamily: SF }}>✏️</button>
          <button onClick={() => handleDeleteFixed(f.id)} style={{ background: "#fee", border: "none", borderRadius: 10, padding: "6px 10px", fontSize: 12, color: "#e74c3c", cursor: "pointer", fontFamily: SF }}>✕</button>
        </div>
      ))}
      <button onClick={() => setShowNewFixed("hogar")} style={{ width: "100%", padding: 14, borderRadius: 14, background: "#f0f4ff", border: "2px dashed #4F7FFA", color: "#4F7FFA", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: SF, marginBottom: 8 }}>
        + Agregar gasto fijo del hogar
      </button>

      {/* GASTOS FIJOS — PERSONALES */}
      <SectionHeader title="Mis Gastos Fijos" />
      <p style={{ fontSize: 12, color: "#aaa", margin: "-4px 0 10px", fontFamily: SF }}>Agrega tus gastos fijos personales</p>
      {personalFixed.length === 0 && (
        <div style={{ ...cardStyle, textAlign: "center", color: "#aaa", padding: 24 }}>
          <p style={{ fontSize: 28, margin: "0 0 6px" }}>👤</p>
          <p style={{ margin: 0, fontSize: 13 }}>Sin gastos fijos personales</p>
        </div>
      )}
      {personalFixed.map(f => (
        <div key={f.id} style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 14, background: "#FA4F7F14", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>👤</div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: "#1a1a2e" }}>{f.name}</p>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "#aaa" }}>
              ${(f.amount || 0).toLocaleString("es-AR")}{f.dueDay ? ` · Vence día ${f.dueDay}` : ""}
            </p>
          </div>
          <button onClick={() => setEditingFixed(f)} style={{ background: "#4F7FFA11", border: "none", borderRadius: 10, padding: "6px 10px", fontSize: 12, color: "#4F7FFA", cursor: "pointer", fontFamily: SF }}>✏️</button>
          <button onClick={() => handleDeleteFixed(f.id)} style={{ background: "#fee", border: "none", borderRadius: 10, padding: "6px 10px", fontSize: 12, color: "#e74c3c", cursor: "pointer", fontFamily: SF }}>✕</button>
        </div>
      ))}
      <button onClick={() => setShowNewFixed("personal")} style={{ width: "100%", padding: 14, borderRadius: 14, background: "#fff0f4", border: "2px dashed #FA4F7F", color: "#FA4F7F", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: SF, marginBottom: 8 }}>
        + Agregar gasto fijo personal
      </button>

      {/* CATEGORÍAS */}
      <SectionHeader title="Categorías" />
      <div style={{ background: "#fff", borderRadius: 16, padding: 14, marginBottom: 8, boxShadow: "0 1px 6px rgba(0,0,0,0.05)" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {allCategories.map(c => (
            <button key={c.id} onClick={() => setEditingCategory(c)} style={{ padding: "9px 14px", borderRadius: 20, border: "2px solid #e8e8e8", fontSize: 13, cursor: "pointer", fontFamily: SF, display: "flex", alignItems: "center", gap: 6, background: "#fafafa", color: "#555" }}>
              {c.icon} {c.label} <span style={{ fontSize: 10, color: "#bbb" }}>✏️</span>
            </button>
          ))}
          <button onClick={() => setEditingCategory({ id: null, label: "", icon: "📦", isNew: true })} style={{ padding: "9px 14px", borderRadius: 20, border: "2px dashed #4F7FFA", fontSize: 13, cursor: "pointer", fontFamily: SF, color: "#4F7FFA", background: "#4F7FFA08", fontWeight: 600 }}>
            + Nueva
          </button>
        </div>
      </div>

      {/* COMPARTIR */}
      <SectionHeader title="Compartir" />
      <SettingRow icon="📤" label="Compartir X-penses" value="Invitá a otros a usar la app" onPress={() => setShowShareApp(true)} />

      {/* CUENTAS */}
      <SectionHeader title="Cuentas" />
      <SettingRow icon="🔀" label="Cambiar de cuenta" value="Crear o seleccionar otra cuenta" onPress={onSwitchAccount} />

      {/* SESIÓN */}
      <SectionHeader title="Sesión" />
      <SettingRow icon="🚪" label="Cerrar sesión" danger onPress={onSignOut} />

      <div style={{ height: 100 }} />

      {/* MODALES */}
      {showShareApp && <ShareAppModal onClose={() => setShowShareApp(false)} />}

      {showInvite && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 200, display: "flex", alignItems: "flex-end" }}>
          <div style={{ background: "#fff", borderRadius: "24px 24px 0 0", width: "100%", padding: "24px 20px 44px", fontFamily: SF }}>
            <div style={{ width: 36, height: 4, background: "#eee", borderRadius: 2, margin: "0 auto 20px" }} />
            <p style={{ fontSize: 18, fontWeight: 700, color: "#1a1a2e", margin: "0 0 6px" }}>Invitar a {account?.name}</p>
            <p style={{ color: "#aaa", fontSize: 13, margin: "0 0 20px" }}>Compartí este link para que se unan a tu cuenta</p>
            <img src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(inviteLink)}`} style={{ display: "block", margin: "0 auto 16px", borderRadius: 12, width: 160, height: 160 }} alt="QR" />
            <div style={{ background: "#f0f4ff", borderRadius: 12, padding: "12px 14px", marginBottom: 12 }}>
              <span style={{ fontSize: 12, color: "#4F7FFA", fontWeight: 600, wordBreak: "break-all" }}>{inviteLink}</span>
            </div>
            <button onClick={() => { navigator.share ? navigator.share({ title: `Unirte a ${account?.name}`, url: inviteLink }) : navigator.clipboard.writeText(inviteLink); }} style={{ width: "100%", padding: 14, borderRadius: 14, background: "linear-gradient(135deg,#4F7FFA,#3a6ae8)", color: "#fff", border: "none", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: SF, marginBottom: 8 }}>
              📤 Compartir link
            </button>
            <button onClick={() => setShowInvite(false)} style={{ width: "100%", padding: 14, borderRadius: 14, background: "#f0f0f0", color: "#555", border: "none", fontSize: 15, cursor: "pointer", fontFamily: SF }}>Cerrar</button>
          </div>
        </div>
      )}

      {(editingFixed || showNewFixed) && (
        <FixedExpenseModal
          expense={editingFixed ? editingFixed : { shared: showNewFixed === "hogar" }}
          onSave={handleSaveFixed}
          onClose={() => { setEditingFixed(null); setShowNewFixed(false); }}
        />
      )}

      {editingCategory && (
        <EditCategoryModal
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