import { useState, useRef } from "react";
import { collection, addDoc, doc, setDoc, deleteDoc } from "firebase/firestore";
import { db } from "./firebase";
import { useTheme, CURRENCIES as CURRENCIES_MAP } from "./theme.jsx";
import { useNotif, SwipeableNotifRow } from "./notifications.jsx";
import { DEFAULT_CATEGORIES } from "./constants/categories.js";

const FONT = `'DM Sans', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif`;

const DIVISION_SYSTEMS = [
  { id: "proportional", label: "Proporcional al ingreso", icon: "📊", desc: "Ideal para parejas que conviven. Cada uno aporta según su sueldo." },
  { id: "50_50",        label: "Partes iguales",          icon: "⚖️", desc: "Cada uno paga exactamente la mitad." },
  { id: "informativo",  label: "Gastos en común",         icon: "🤝", desc: "Registrá y gestioná gastos sin calcular quién le debe a quién." },
];

const MEMBER_COLORS = ["#4F7FFA","#FA4F7F","#2ecc71","#f39c12","#9b59b6","#1abc9c"];

// Derivado de CURRENCIES_MAP (fuente única en theme.jsx)
const CURRENCIES = Object.values(CURRENCIES_MAP).map(c => ({
  code: c.code, label: c.name, symbol: c.symbol,
}));

function MenuIcon({ color = "#ffffffcc" }) {
  return (
    <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
      <rect x="1.5" y="1.5" width="27" height="27" rx="7.5" stroke={color} strokeWidth="2"/>
      <line x1="8" y1="10" x2="22" y2="10" stroke={color} strokeWidth="2" strokeLinecap="round"/>
      <line x1="8" y1="15" x2="22" y2="15" stroke={color} strokeWidth="2" strokeLinecap="round"/>
      <line x1="8" y1="20" x2="22" y2="20" stroke={color} strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

function SwipeableAccountRow({ acc, onSelect, onDeleteRequest, colors }) {
  const [swipeX, setSwipeX]  = useState(0);
  const [swiped, setSwiped]  = useState(false);
  const startX               = useRef(null);
  const isDragging           = useRef(false);
  const DELETE_THRESHOLD     = 80;

  const onTouchStart = (e) => {
    startX.current     = e.touches[0].clientX;
    isDragging.current = true;
  };
  const onTouchMove = (e) => {
    if (!isDragging.current || startX.current === null) return;
    const diff = startX.current - e.touches[0].clientX;
    if (diff > 0) setSwipeX(Math.min(diff, DELETE_THRESHOLD + 20));
    else if (diff < -10) { setSwipeX(0); setSwiped(false); }
  };
  const onTouchEnd = () => {
    isDragging.current = false;
    if (swipeX > DELETE_THRESHOLD / 2) { setSwipeX(DELETE_THRESHOLD); setSwiped(true); }
    else { setSwipeX(0); setSwiped(false); }
    startX.current = null;
  };

  // FIX: contador de miembros incluye labels no vinculados
  const memberLabels = acc.memberLabels || [];
  const unlinkedCount = memberLabels.filter(l => !l.linkedUid).length;
  const totalMembers = (acc.memberIds?.length || 1) + unlinkedCount;

  return (
    <div style={{ position: "relative", marginBottom: 12, borderRadius: 20, overflow: "hidden" }}>
      {/* Botón eliminar detrás */}
      <div style={{
        position: "absolute", right: 0, top: 0, bottom: 0, width: DELETE_THRESHOLD,
        background: "#e74c3c", display: "flex", alignItems: "center", justifyContent: "center",
        borderRadius: "0 20px 20px 0",
      }}>
        <button
          onClick={(e) => { e.stopPropagation(); onDeleteRequest(acc.id); }}
          style={{ background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: 0 }}>
          <span style={{ fontSize: 20 }}>🗑️</span>
          <span style={{ fontSize: 10, color: "#fff", fontWeight: 700, fontFamily: FONT }}>Eliminar</span>
        </button>
      </div>

      {/* Fila deslizable */}
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={() => { if (swiped) { setSwipeX(0); setSwiped(false); } else { onSelect(acc.id); } }}
        style={{
          transform: `translateX(-${swipeX}px)`,
          transition: isDragging.current ? "none" : "transform 0.3s ease",
          background: colors.card, borderRadius: 20, padding: "18px 20px",
          border: `1px solid ${colors.cardBorder}`, boxShadow: colors.shadow,
          display: "flex", alignItems: "center", gap: 14,
          cursor: "pointer", position: "relative", zIndex: 1,
        }}>
        <div style={{
          width: 48, height: 48, borderRadius: 16,
          background: acc.type === "shared" ? "#4F7FFA18" : "#2ecc7118",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0,
        }}>
          {acc.emoji || (acc.type === "shared" ? "👥" : "👤")}
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ margin: "0 0 4px", fontWeight: 700, fontSize: 16, color: colors.text, fontFamily: FONT }}>{acc.name}</p>
          <p style={{ margin: 0, fontSize: 12, color: colors.textMuted, fontFamily: FONT }}>
            {acc.type === "shared" ? "Compartida" : "Personal"} · {totalMembers} miembro{totalMembers !== 1 ? "s" : ""}
          </p>
        </div>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 18l6-6-6-6"/>
        </svg>
      </div>
    </div>
  );
}

function ProfileTab({ user, userProfile, onSignOut, onDeleteAccount, colors }) {
  const { setManualTheme } = useTheme();
  const [editingField, setEditingField] = useState(null);
  const [fieldValue,   setFieldValue]   = useState("");
  const [saving,       setSaving]       = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const currentTheme = localStorage.getItem("xpenses-theme") || "auto";
  const currentLang  = localStorage.getItem("xpenses-lang")  || "es";

  const displayName = userProfile?.name  || user.displayName || "Usuario";
  const alias       = userProfile?.alias || "";

  const openEdit = (field, current) => { setEditingField(field); setFieldValue(current || ""); };

  const saveField = async () => {
    setSaving(true);
    if (editingField === "name" || editingField === "alias") {
      await setDoc(doc(db, "users", user.uid), { [editingField]: fieldValue.trim() }, { merge: true });
    } else if (editingField === "theme") {
      if (fieldValue === "auto") { setManualTheme(null); localStorage.removeItem("xpenses-theme"); }
      else { setManualTheme(fieldValue); localStorage.setItem("xpenses-theme", fieldValue); }
      await setDoc(doc(db, "users", user.uid), { theme: fieldValue }, { merge: true });
    } else if (editingField === "language") {
      localStorage.setItem("xpenses-lang", fieldValue);
      await setDoc(doc(db, "users", user.uid), { language: fieldValue }, { merge: true });
    }
    setSaving(false);
    setEditingField(null);
  };

  const themeLabels = { auto: "Automático", dark: "Oscuro", light: "Claro" };
  const langLabels  = { es: "Español", en: "English" };

  const fieldRow = (key, label, value, currentVal) => (
    <button key={key} onClick={() => openEdit(key, currentVal)}
      style={{ width: "100%", background: colors.card, border: `1px solid ${colors.cardBorder}`, borderRadius: 16, padding: "14px 16px", marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", fontFamily: FONT, boxShadow: colors.shadow }}>
      <div style={{ textAlign: "left" }}>
        <p style={{ margin: 0, fontSize: 11, color: colors.textMuted, fontWeight: 600, letterSpacing: 0.4, textTransform: "uppercase", fontFamily: FONT }}>{label}</p>
        <p style={{ margin: "3px 0 0", fontSize: 15, color: colors.text, fontWeight: 600, fontFamily: FONT }}>{value}</p>
      </div>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={colors.textMuted} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
    </button>
  );

  return (
    <div style={{ paddingTop: 8 }}>
      {/* Foto + nombre */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 16, paddingBottom: 24 }}>
        {user.photoURL
          ? <img src={user.photoURL} style={{ width: 80, height: 80, borderRadius: 40, border: "3px solid #4F7FFA44", marginBottom: 12 }} alt="" />
          : <div style={{ width: 80, height: 80, borderRadius: 40, background: "#4F7FFA22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, marginBottom: 12 }}>👤</div>}
        <p style={{ margin: 0, fontWeight: 700, fontSize: 20, color: colors.text, fontFamily: FONT }}>{displayName}</p>
        {alias && <p style={{ margin: "2px 0 0", fontSize: 13, color: colors.textMuted, fontFamily: FONT }}>@{alias}</p>}
        <p style={{ margin: "4px 0 0", fontSize: 12, color: colors.textMuted, fontFamily: FONT }}>{user.email}</p>
      </div>

      <p style={{ fontSize: 11, fontWeight: 700, color: colors.textMuted, letterSpacing: 1.2, textTransform: "uppercase", margin: "0 0 8px", fontFamily: FONT }}>Mi cuenta</p>
      {fieldRow("name",  "Nombre completo", displayName,                     displayName)}
      {fieldRow("alias", "Alias",           alias || "Sin alias",             alias)}

      <p style={{ fontSize: 11, fontWeight: 700, color: colors.textMuted, letterSpacing: 1.2, textTransform: "uppercase", margin: "20px 0 8px", fontFamily: FONT }}>Preferencias</p>
      {fieldRow("theme",    "Modo oscuro", themeLabels[currentTheme] || "Automático", currentTheme)}
      {fieldRow("language", "Idioma",      langLabels[currentLang]   || "Español",    currentLang)}

      <button onClick={onSignOut}
        style={{ width: "100%", marginTop: 24, padding: 14, borderRadius: 14, background: "#ff6b6b18", border: "2px solid #ff6b6b44", color: "#ff6b6b", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}>
        Cerrar sesión
      </button>
      <button onClick={() => setShowDeleteConfirm(true)}
        style={{ background: "none", border: "none", cursor: "pointer", marginTop: 16, color: colors.textMuted, fontSize: 12, fontFamily: FONT, textDecoration: "underline", display: "block", width: "100%", textAlign: "center" }}>
        Eliminar mi cuenta
      </button>
      <div style={{ height: 40 }} />

      {showDeleteConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ background: colors.card, borderRadius: 24, padding: 24, width: "100%", maxWidth: 340, fontFamily: FONT, border: `1px solid ${colors.cardBorder}` }}>
            <p style={{ fontSize: 36, textAlign: "center", margin: "0 0 12px" }}>⚠️</p>
            <p style={{ fontSize: 18, fontWeight: 700, color: colors.text, margin: "0 0 8px", textAlign: "center", fontFamily: FONT }}>¿Eliminar tu cuenta?</p>
            <p style={{ fontSize: 13, color: colors.textMuted, margin: "0 0 24px", textAlign: "center", lineHeight: 1.5, fontFamily: FONT }}>
              Se eliminará tu perfil. En cuentas compartidas, tu usuario quedará desvinculado pero el integrante seguirá en la cuenta. Esta acción no se puede deshacer.
            </p>
            <button onClick={async () => { setDeleting(true); await onDeleteAccount(); setDeleting(false); }}
              disabled={deleting}
              style={{ width: "100%", padding: 14, borderRadius: 14, background: "#e74c3c", color: "#fff", border: "none", fontSize: 15, fontWeight: 600, cursor: deleting ? "default" : "pointer", fontFamily: FONT, marginBottom: 8, opacity: deleting ? 0.7 : 1 }}>
              {deleting ? "Eliminando..." : "Sí, eliminar"}
            </button>
            <button onClick={() => setShowDeleteConfirm(false)} style={{ width: "100%", padding: 14, borderRadius: 14, background: colors.pill, color: colors.textMuted, border: "none", fontSize: 15, cursor: "pointer", fontFamily: FONT }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Bottom sheet edición */}
      {editingField && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 200, display: "flex", alignItems: "flex-end" }}
          onClick={() => setEditingField(null)}>
          <div style={{ background: colors.card, borderRadius: "24px 24px 0 0", width: "100%", padding: "24px 20px calc(40px + env(safe-area-inset-bottom))", fontFamily: FONT }}
            onClick={e => e.stopPropagation()}>
            <div style={{ width: 36, height: 4, background: colors.divider, borderRadius: 2, margin: "0 auto 20px" }} />

            {(editingField === "name" || editingField === "alias") && (
              <>
                <p style={{ fontSize: 17, fontWeight: 700, color: colors.text, margin: "0 0 16px", fontFamily: FONT }}>
                  {editingField === "name" ? "Nombre completo" : "Alias"}
                </p>
                <input autoFocus value={fieldValue} onChange={e => setFieldValue(e.target.value)}
                  placeholder={editingField === "name" ? "Tu nombre" : "Tu alias"}
                  style={{ width: "100%", padding: "13px 14px", borderRadius: 14, border: `2px solid ${colors.inputBorder}`, fontSize: 15, fontFamily: FONT, outline: "none", boxSizing: "border-box", color: colors.inputText, background: colors.input, marginBottom: 16 }} />
                <button onClick={saveField} disabled={saving || !fieldValue.trim()}
                  style={{ width: "100%", padding: 14, borderRadius: 14, background: saving || !fieldValue.trim() ? "#aaa" : "linear-gradient(135deg,#4F7FFA,#3a6ae8)", color: "#fff", border: "none", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>
                  {saving ? "Guardando..." : "Guardar"}
                </button>
              </>
            )}

            {editingField === "theme" && (
              <>
                <p style={{ fontSize: 17, fontWeight: 700, color: colors.text, margin: "0 0 16px", fontFamily: FONT }}>Modo oscuro</p>
                {[["auto","Automático","Sigue la configuración del sistema"],["dark","Oscuro","Siempre oscuro"],["light","Claro","Siempre claro"]].map(([val, lbl, sub]) => (
                  <button key={val} onClick={() => setFieldValue(val)}
                    style={{ width: "100%", padding: "14px 16px", borderRadius: 14, border: `2px solid ${fieldValue === val ? "#4F7FFA" : colors.inputBorder}`, background: fieldValue === val ? "#4F7FFA11" : colors.input, marginBottom: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", fontFamily: FONT }}>
                    <div>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: colors.text, fontFamily: FONT }}>{lbl}</p>
                      <p style={{ margin: 0, fontSize: 12, color: colors.textMuted, fontFamily: FONT }}>{sub}</p>
                    </div>
                    {fieldValue === val && <span style={{ color: "#4F7FFA", fontSize: 18 }}>✓</span>}
                  </button>
                ))}
                <button onClick={saveField} disabled={saving}
                  style={{ width: "100%", marginTop: 8, padding: 14, borderRadius: 14, background: "linear-gradient(135deg,#4F7FFA,#3a6ae8)", color: "#fff", border: "none", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>
                  {saving ? "Guardando..." : "Guardar"}
                </button>
              </>
            )}

            {editingField === "language" && (
              <>
                <p style={{ fontSize: 17, fontWeight: 700, color: colors.text, margin: "0 0 16px", fontFamily: FONT }}>Idioma</p>
                {[["es","Español",""],["en","English","Próximamente"]].map(([val, lbl, badge]) => (
                  <button key={val} onClick={() => val === "es" && setFieldValue(val)}
                    style={{ width: "100%", padding: "14px 16px", borderRadius: 14, border: `2px solid ${fieldValue === val ? "#4F7FFA" : colors.inputBorder}`, background: fieldValue === val ? "#4F7FFA11" : colors.input, marginBottom: 8, cursor: val === "en" ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", fontFamily: FONT, opacity: val === "en" ? 0.5 : 1 }}>
                    <div>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: colors.text, fontFamily: FONT }}>
                        {lbl} {badge && <span style={{ fontSize: 10, color: "#4F7FFA", fontWeight: 700 }}>{badge}</span>}
                      </p>
                    </div>
                    {fieldValue === val && <span style={{ color: "#4F7FFA", fontSize: 18 }}>✓</span>}
                  </button>
                ))}
                <button onClick={saveField} disabled={saving}
                  style={{ width: "100%", marginTop: 8, padding: 14, borderRadius: 14, background: "linear-gradient(135deg,#4F7FFA,#3a6ae8)", color: "#fff", border: "none", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>
                  {saving ? "Guardando..." : "Guardar"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AccountSelectorScreen({ user, userProfile, accounts, onSelect, onCreated, onSignOut }) {
  const { colors } = useTheme();
  const { notifications, unreadCount, markRead, markAllRead, deleteNotif } = useNotif();

  const [step,           setStep]          = useState("list");
  const [activeTab,      setActiveTab]     = useState("cuentas");
  const [accountName,    setAccountName]   = useState("");
  const [accountType,    setAccountType]   = useState("shared");
  const [divisionSystem, setDivisionSystem]= useState("proportional");
  const [saving,         setSaving]        = useState(false);
  const [confirmDelete,  setConfirmDelete] = useState(null);
  const [deletedIds,     setDeletedIds]    = useState([]);

  const [selectedEmoji,      setSelectedEmoji]      = useState("");
  const [selectedCurrency,   setSelectedCurrency]   = useState("ARS");
  const [memberSalaries,     setMemberSalaries]     = useState({ 0: "" });
  // FIX: ninguna categoría seleccionada por default — mínimo 1 obligatoria
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [catError,           setCatError]           = useState(false);
  const [emojiError,         setEmojiError]         = useState(false);
  const [showCurrencySheet,  setShowCurrencySheet]  = useState(false);

  const emojiInputRef = useRef(null);

  const visibleAccounts = accounts.filter(a => !deletedIds.includes(a.id));

  // FIX: creador autogenerado como integrante 0
  const ownerDisplayName = userProfile?.alias || userProfile?.name || user.displayName?.split(" ")[0] || "";
  const [members, setMembers] = useState([{ name: ownerDisplayName, color: MEMBER_COLORS[0] }]);
  const [newMemberName, setNewMemberName] = useState("");

  const addMember = () => {
    const trimmed = newMemberName.trim();
    if (!trimmed) return;
    const color = MEMBER_COLORS[members.length % MEMBER_COLORS.length];
    setMembers(prev => [...prev, { name: trimmed, color }]);
    setNewMemberName("");
  };
  const removeMember     = (idx) => setMembers(prev => prev.filter((_, i) => i !== idx));
  const updateMemberName = (idx, val) => setMembers(prev => prev.map((m, i) => i === idx ? { ...m, name: val } : m));

  // FIX: todo en una sola página — handleCreate directo sin step "members"
  const handleCreate = async () => {
    // Validar emoji obligatorio
    if (!selectedEmoji) {
      setEmojiError(true);
      return;
    }
    // Validar categoría mínima
    if (selectedCategories.length === 0) {
      setCatError(true);
      return;
    }
    if (!accountName.trim()) return;
    setSaving(true);

    const ownerName = members[0]?.name?.trim() || ownerDisplayName;
    const otherMembers = members.slice(1).filter(m => m.name.trim());

    const ownerLabel = {
      id: `label_owner`,
      name: ownerName || user.displayName || "Yo",
      color: MEMBER_COLORS[0],
      linkedUid: user.uid,
      ...(divisionSystem === "proportional" && memberSalaries[0]
        ? { salary: parseFloat(memberSalaries[0].replace(/\./g, "").replace(",", ".")) || 0 }
        : {}),
    };

    const memberLabels = [ownerLabel, ...otherMembers.map((m, i) => ({
      id: `label_${i}`,
      name: m.name.trim(),
      color: m.color,
      linkedUid: null,
      ...(divisionSystem === "proportional" && memberSalaries[i + 1]
        ? { salary: parseFloat(memberSalaries[i + 1].replace(/\./g, "").replace(",", ".")) || 0 }
        : {}),
    }));

    const ref = await addDoc(collection(db, "accounts"), {
      name: accountName,
      emoji: selectedEmoji,
      type: accountType,
      divisionSystem,
      ownerId: user.uid,
      memberIds: [user.uid],
      memberLabels,
      currency: selectedCurrency,
      disabledCategories: DEFAULT_CATEGORIES.filter(c => !selectedCategories.includes(c.id)).map(c => c.id),
      createdAt: new Date().toISOString(),
    });

    const ownerUpdate = { name: ownerName || undefined };
    if (divisionSystem === "proportional" && memberSalaries[0]) {
      ownerUpdate.salary = parseFloat(memberSalaries[0].replace(/\./g, "").replace(",", ".")) || 0;
    }
    if (ownerName) await setDoc(doc(db, "users", user.uid), ownerUpdate, { merge: true });

    await setDoc(doc(db, "users", user.uid), {
      accountIds: [...accounts.map(a => a.id), ref.id],
    }, { merge: true });

    setSaving(false);
    // FIX: navegar a tab "home" al crear cuenta
    onCreated(ref.id, "home");
  };

  const handleDeleteConfirmed = async () => {
    if (!confirmDelete) return;
    const idToDelete = confirmDelete;
    setConfirmDelete(null);
    setDeletedIds(prev => [...prev, idToDelete]);
    try {
      await deleteDoc(doc(db, "accounts", idToDelete));
      await setDoc(doc(db, "users", user.uid), {
        accountIds: accounts.filter(a => a.id !== idToDelete).map(a => a.id),
      }, { merge: true });
    } catch (err) {
      console.error("Error eliminando cuenta:", err);
      setDeletedIds(prev => prev.filter(id => id !== idToDelete));
    }
  };

  const inputStyle = {
    width: "100%", padding: "13px 14px", borderRadius: 14,
    border: `2px solid ${colors.inputBorder}`, fontSize: 15, marginBottom: 14,
    fontFamily: FONT, outline: "none", boxSizing: "border-box",
    color: colors.inputText, background: colors.input,
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: colors.bg, fontFamily: FONT,
      overflowY: "auto",
      paddingBottom: "env(safe-area-inset-bottom)",
      paddingLeft:   "env(safe-area-inset-left)",
      paddingRight:  "env(safe-area-inset-right)",
      boxSizing: "border-box",
    }}>
      <style>{`* { box-sizing: border-box; }`}</style>

      {/* HEADER */}
      <div style={{
        position: "sticky", top: 0, zIndex: 50, background: colors.headerBg,
        paddingTop: "calc(env(safe-area-inset-top) + 16px)",
        paddingBottom: 16, paddingLeft: 20, paddingRight: 20,
      }}>
        {step !== "list" ? (
          <div style={{ display: "flex", alignItems: "center" }}>
            <button onClick={() => setStep("list")} style={{ background: "none", border: "none", cursor: "pointer", color: "#4F7FFA", fontSize: 15, fontWeight: 600, fontFamily: FONT, padding: 0 }}>
              Cancelar
            </button>
            <p style={{ flex: 1, textAlign: "center", fontSize: 16, fontWeight: 700, color: "#fff", margin: 0, fontFamily: FONT }}>Nueva cuenta</p>
            <div style={{ width: 60 }} />
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <img src="/logo.png" style={{ width: 38, height: 38, borderRadius: 10 }} alt="" onError={e => { e.target.style.display = "none"; }} />
            <p style={{ fontSize: 17, fontWeight: 800, color: "#fff", margin: 0, fontFamily: FONT, letterSpacing: -0.5 }}>X-penses</p>
          </div>
        )}
      </div>

      <div style={{ padding: 20, paddingBottom: step === "list" ? 100 : 40 }}>

        {/* ── NOTIFICACIONES TAB ── */}
        {step === "list" && activeTab === "notificaciones" && (() => {
          const groups = [];
          const seen = {};
          notifications.forEach(n => {
            const key = n.accountId || "__sin_cuenta__";
            if (!seen[key]) {
              seen[key] = true;
              const acc = accounts.find(a => a.id === key);
              groups.push({ accountId: key, accountName: acc?.name || "Cuenta eliminada", accountEmoji: acc?.emoji || "📂", items: [] });
            }
            groups.find(g => g.accountId === key).items.push(n);
          });

          return (
            <div style={{ paddingTop: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 18, fontWeight: 700, color: colors.text, fontFamily: FONT }}>Notificaciones</span>
                  {unreadCount > 0 && (
                    <span style={{ background: "#4F7FFA", color: "#fff", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 12, fontFamily: FONT }}>{unreadCount}</span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button onClick={markAllRead}
                    style={{ background: "none", border: "none", fontSize: 12, color: "#4F7FFA", fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>
                    Marcar todo leído
                  </button>
                )}
              </div>

              {notifications.length === 0 ? (
                <div style={{ textAlign: "center", padding: "60px 20px", color: colors.textMuted }}>
                  <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.4 }}>🔔</div>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: colors.textMuted, fontFamily: FONT }}>Sin notificaciones</p>
                  <p style={{ margin: "4px 0 0", fontSize: 13, color: colors.textMuted, fontFamily: FONT }}>Acá vas a ver las novedades de tus cuentas</p>
                </div>
              ) : (
                groups.map(group => (
                  <div key={group.accountId} style={{ marginBottom: 20 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, paddingBottom: 8, borderBottom: `2px solid ${colors.divider}` }}>
                      <span style={{ fontSize: 16 }}>{group.accountEmoji}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: colors.textMuted, letterSpacing: 0.4, textTransform: "uppercase", fontFamily: FONT }}>
                        {group.accountName}
                      </span>
                      {group.items.filter(n => !n.read).length > 0 && (
                        <span style={{ background: "#4F7FFA22", color: "#4F7FFA", fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 10, fontFamily: FONT, marginLeft: "auto" }}>
                          {group.items.filter(n => !n.read).length} nueva{group.items.filter(n => !n.read).length > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                    <div style={{ background: colors.card, borderRadius: 16, overflow: "hidden", border: `1px solid ${colors.cardBorder}` }}>
                      {group.items.map(n => (
                        <SwipeableNotifRow key={n.id} n={n} colors={colors} onMarkRead={markRead} onDelete={deleteNotif} />
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          );
        })()}

        {/* ── PERFIL TAB ── */}
        {step === "list" && activeTab === "perfil" && (
          <ProfileTab user={user} userProfile={userProfile} onSignOut={onSignOut} onDeleteAccount={async () => {
            // Desvincular uid de todos los memberLabels en cuentas donde participa
            try {
              const { deleteUser } = await import("firebase/auth");
              const { getAuth }    = await import("firebase/auth");
              const { writeBatch, getDocs, query, where, collectionGroup } = await import("firebase/firestore");
              // Eliminar doc de usuario en Firestore
              await import("firebase/firestore").then(async ({ doc: docFn, deleteDoc: deleteFn }) => {
                await deleteFn(docFn(db, "users", user.uid));
              });
              // Desvincular uid de memberLabels en todas las cuentas donde está vinculado
              for (const acc of accounts) {
                const labels = acc.memberLabels || [];
                const hasLinked = labels.some(l => l.linkedUid === user.uid);
                if (hasLinked) {
                  const { updateDoc, doc: docFn } = await import("firebase/firestore");
                  await updateDoc(docFn(db, "accounts", acc.id), {
                    memberLabels: labels.map(l => l.linkedUid === user.uid ? { ...l, linkedUid: null } : l),
                    memberIds: (acc.memberIds || []).filter(id => id !== user.uid),
                  });
                }
              }
              // Eliminar usuario de Firebase Auth
              const auth = getAuth();
              if (auth.currentUser) await deleteUser(auth.currentUser);
            } catch (err) {
              console.error("Error eliminando cuenta:", err);
            }
          }} colors={colors} />
        )}

        {/* ── LISTA ── */}
        {step === "list" && activeTab === "cuentas" && (
          <>
            {visibleAccounts.length === 0 && (
              <div style={{ textAlign: "center", padding: "40px 20px", color: colors.textMuted }}>
                <p style={{ fontSize: 48, margin: "0 0 12px" }}>📂</p>
                <p style={{ fontSize: 16, fontWeight: 600, color: colors.text, margin: "0 0 6px", fontFamily: FONT }}>No tenés cuentas todavía</p>
                <p style={{ fontSize: 14, margin: 0, fontFamily: FONT }}>Creá tu primera cuenta para empezar</p>
              </div>
            )}

            {visibleAccounts.map(acc => (
              <SwipeableAccountRow
                key={acc.id}
                acc={acc}
                colors={colors}
                onSelect={onSelect}
                onDeleteRequest={(id) => setConfirmDelete(id)}
              />
            ))}

            {/* FIX: botón flotante siempre visible */}
            <div style={{ height: 20 }} />
          </>
        )}

        {/* ── CREAR — todo en una sola página ── */}
        {step === "create" && (
          <>
            {/* Emoji + Nombre */}
            <div style={{ background: colors.card, borderRadius: 20, padding: 18, marginBottom: 12, boxShadow: colors.shadow, border: `1px solid ${colors.cardBorder}` }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: colors.textMuted, marginBottom: 10, letterSpacing: 0.6, textTransform: "uppercase", fontFamily: FONT }}>Título</p>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                {/* FIX: emoji obligatorio — sin default, abre teclado nativo, muestra error si vacío */}
                <div style={{ position: "relative", flexShrink: 0 }}>
                  <button
                    onClick={() => { setEmojiError(false); emojiInputRef.current?.focus(); emojiInputRef.current?.click(); }}
                    style={{
                      width: 52, height: 52, borderRadius: 14,
                      background: selectedEmoji ? colors.pill : (emojiError ? "#ff6b6b11" : colors.pill),
                      border: `2px solid ${emojiError ? "#ff6b6b" : (selectedEmoji ? colors.inputBorder : "#4F7FFA")}`,
                      fontSize: selectedEmoji ? 26 : 20, cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: selectedEmoji ? undefined : (emojiError ? "#ff6b6b" : "#4F7FFA"),
                    }}>
                    {selectedEmoji || "＋"}
                  </button>
                  {emojiError && !selectedEmoji && (
                    <p style={{ position: "absolute", top: 54, left: 0, margin: 0, fontSize: 10, color: "#ff6b6b", fontFamily: FONT, whiteSpace: "nowrap" }}>Obligatorio</p>
                  )}
                  <input
                    ref={emojiInputRef}
                    type="text"
                    inputMode="text"
                    style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer", fontSize: 26 }}
                    onFocus={e => { e.target.value = ""; }}
                    onInput={e => {
                      const val = e.target.value;
                      if (val) {
                        const chars = [...val];
                        setSelectedEmoji(chars[chars.length - 1]);
                        setEmojiError(false);
                        e.target.value = "";
                      }
                    }}
                  />
                </div>
                <input value={accountName} onChange={e => setAccountName(e.target.value)}
                  placeholder="Ej: Casa, Vacaciones..."
                  style={{ ...inputStyle, marginBottom: 0, flex: 1 }} autoFocus />
              </div>
            </div>

            {/* Tipo + División */}
            <div style={{ background: colors.card, borderRadius: 20, padding: 18, marginBottom: 12, boxShadow: colors.shadow, border: `1px solid ${colors.cardBorder}` }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: colors.textMuted, marginBottom: 10, letterSpacing: 0.6, textTransform: "uppercase", fontFamily: FONT }}>Tipo de cuenta</p>
              <div style={{ display: "flex", gap: 10, marginBottom: accountType === "shared" ? 16 : 0 }}>
                {[["personal","👤","Personal","Solo para vos"],["shared","👥","Compartida","Con otros"]].map(([val,icon,lbl,desc]) => (
                  <button key={val} onClick={() => setAccountType(val)} style={{ flex: 1, padding: 14, borderRadius: 14, border: "2px solid", cursor: "pointer", fontFamily: FONT, textAlign: "left", borderColor: accountType === val ? "#4F7FFA" : colors.inputBorder, background: accountType === val ? "#4F7FFA11" : colors.input }}>
                    <p style={{ fontSize: 22, margin: "0 0 4px" }}>{icon}</p>
                    <p style={{ margin: "0 0 2px", fontWeight: 600, fontSize: 13, color: accountType === val ? "#4F7FFA" : colors.text, fontFamily: FONT }}>{lbl}</p>
                    <p style={{ margin: 0, fontSize: 11, color: colors.textMuted, fontFamily: FONT }}>{desc}</p>
                  </button>
                ))}
              </div>
              {accountType === "shared" && (
                <>
                  <p style={{ fontSize: 11, fontWeight: 700, color: colors.textMuted, marginBottom: 10, letterSpacing: 0.6, textTransform: "uppercase", fontFamily: FONT }}>División de gastos</p>
                  {DIVISION_SYSTEMS.map(s => (
                    <button key={s.id} onClick={() => setDivisionSystem(s.id)} style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "2px solid", cursor: "pointer", fontFamily: FONT, textAlign: "left", marginBottom: 8, display: "flex", alignItems: "center", gap: 10, borderColor: divisionSystem === s.id ? "#4F7FFA" : colors.inputBorder, background: divisionSystem === s.id ? "#4F7FFA11" : colors.input }}>
                      <span style={{ fontSize: 20 }}>{s.icon}</span>
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: divisionSystem === s.id ? "#4F7FFA" : colors.text, fontFamily: FONT }}>{s.label}</p>
                        <p style={{ margin: "2px 0 0", fontSize: 11, color: colors.textMuted, fontFamily: FONT }}>{s.desc}</p>
                      </div>
                      {divisionSystem === s.id && <span style={{ color: "#4F7FFA", fontSize: 18 }}>✓</span>}
                    </button>
                  ))}
                </>
              )}
            </div>

            {/* Opciones — Divisa */}
            <div style={{ background: colors.card, borderRadius: 20, padding: 18, marginBottom: 12, boxShadow: colors.shadow, border: `1px solid ${colors.cardBorder}` }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: colors.textMuted, marginBottom: 10, letterSpacing: 0.6, textTransform: "uppercase", fontFamily: FONT }}>Opciones</p>
              <button onClick={() => setShowCurrencySheet(true)}
                style={{ width: "100%", padding: "12px 14px", borderRadius: 14, border: `2px solid ${colors.inputBorder}`, background: colors.input, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", fontFamily: FONT }}>
                <div style={{ textAlign: "left" }}>
                  <p style={{ margin: 0, fontSize: 11, color: colors.textMuted, fontWeight: 600, letterSpacing: 0.4, textTransform: "uppercase", fontFamily: FONT }}>Divisa</p>
                  <p style={{ margin: "2px 0 0", fontSize: 14, color: colors.text, fontWeight: 600, fontFamily: FONT }}>
                    {CURRENCIES.find(c => c.code === selectedCurrency)?.symbol} {selectedCurrency} — {CURRENCIES.find(c => c.code === selectedCurrency)?.label}
                  </p>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={colors.textMuted} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
              </button>
            </div>

            {/* Categorías — FIX: ninguna por default, mínimo 1 */}
            <div style={{ background: colors.card, borderRadius: 20, padding: 18, marginBottom: 12, boxShadow: colors.shadow, border: `2px solid ${catError && selectedCategories.length === 0 ? "#ff6b6b" : colors.cardBorder}` }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: catError && selectedCategories.length === 0 ? "#ff6b6b" : colors.textMuted, marginBottom: 4, letterSpacing: 0.6, textTransform: "uppercase", fontFamily: FONT }}>Categorías</p>
              {catError && selectedCategories.length === 0 && (
                <p style={{ fontSize: 12, color: "#ff6b6b", fontFamily: FONT, margin: "0 0 10px" }}>Seleccioná al menos una categoría</p>
              )}
              <p style={{ fontSize: 12, color: colors.textMuted, margin: "0 0 12px", fontFamily: FONT }}>Elegí las que vas a usar en esta cuenta</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {DEFAULT_CATEGORIES.map(c => {
                  const selected = selectedCategories.includes(c.id);
                  return (
                    <button key={c.id} onClick={() => {
                      setSelectedCategories(prev => selected ? prev.filter(id => id !== c.id) : [...prev, c.id]);
                      setCatError(false);
                    }} style={{ padding: "8px 14px", borderRadius: 20, border: "2px solid", cursor: "pointer", fontFamily: FONT, fontSize: 13, fontWeight: 600,
                      borderColor: selected ? "#4F7FFA" : colors.inputBorder,
                      background: selected ? "#4F7FFA" : colors.input,
                      color: selected ? "#fff" : colors.textMuted }}>
                      {c.icon} {c.label}
                    </button>
                  );
                })}
              </div>
              <p style={{ color: colors.textMuted, fontSize: 12, margin: "10px 0 0", fontFamily: FONT }}>
                {selectedCategories.length} seleccionada{selectedCategories.length !== 1 ? "s" : ""}
              </p>
            </div>

            {/* FIX: integrantes inline (sin step "members") — creador autogenerado */}
            {accountType === "shared" && (
              <div style={{ background: colors.card, borderRadius: 20, padding: 18, marginBottom: 12, boxShadow: colors.shadow, border: `1px solid ${colors.cardBorder}` }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: colors.textMuted, marginBottom: 10, letterSpacing: 0.6, textTransform: "uppercase", fontFamily: FONT }}>Integrantes</p>
                <p style={{ fontSize: 12, color: colors.textMuted, margin: "0 0 14px", fontFamily: FONT }}>
                  Cada uno podrá vincular su cuenta cuando acepte la invitación.
                </p>
                {members.map((m, idx) => (
                  <div key={idx} style={{ marginBottom: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 18, background: m.color + "33", border: `2px solid ${m.color}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: m.color, fontFamily: FONT }}>{m.name ? m.name[0].toUpperCase() : "?"}</span>
                      </div>
                      <input value={m.name} onChange={e => updateMemberName(idx, e.target.value)}
                        placeholder={idx === 0 ? "Tu nombre (vos)" : `Integrante ${idx + 1}`}
                        style={{ flex: 1, padding: "10px 12px", borderRadius: 12, border: `2px solid ${colors.inputBorder}`, fontSize: 14, fontFamily: FONT, outline: "none", color: colors.inputText, background: colors.input, boxSizing: "border-box" }} />
                      {idx > 0 && (
                        <button onClick={() => removeMember(idx)} style={{ background: colors.dangerBg, border: "none", borderRadius: 10, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 16, color: colors.danger, flexShrink: 0 }}>×</button>
                      )}
                    </div>
                    {/* FIX: salario solo si proporcional */}
                    {divisionSystem === "proportional" && (
                      <div style={{ marginLeft: 46, marginTop: 6, position: "relative" }}>
                        <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: colors.textMuted, fontWeight: 600, fontSize: 13, fontFamily: FONT }}>$</span>
                        <input
                          type="number" inputMode="decimal"
                          value={memberSalaries[idx] || ""}
                          onChange={e => setMemberSalaries(prev => ({ ...prev, [idx]: e.target.value }))}
                          placeholder="Ingreso mensual (opcional)"
                          style={{ width: "100%", padding: "8px 12px 8px 26px", borderRadius: 12, border: `2px solid ${colors.inputBorder}`, fontSize: 13, fontFamily: FONT, outline: "none", color: colors.inputText, background: colors.input, boxSizing: "border-box" }} />
                      </div>
                    )}
                  </div>
                ))}
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <input value={newMemberName} onChange={e => setNewMemberName(e.target.value)} onKeyDown={e => e.key === "Enter" && addMember()}
                    placeholder="Agregar integrante..."
                    style={{ flex: 1, padding: "10px 12px", borderRadius: 12, border: `2px dashed ${colors.inputBorder}`, fontSize: 14, fontFamily: FONT, outline: "none", color: colors.inputText, background: colors.input, boxSizing: "border-box" }} />
                  <button onClick={addMember} style={{ background: "#4F7FFA", border: "none", borderRadius: 12, width: 42, height: 42, fontSize: 22, color: "#fff", cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                </div>
              </div>
            )}

            <div style={{ background: "#4F7FFA11", borderRadius: 14, padding: "12px 14px", marginBottom: 16, display: "flex", gap: 10 }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>💡</span>
              <p style={{ margin: 0, fontSize: 12, color: colors.textMuted, fontFamily: FONT, lineHeight: 1.5 }}>
                Después podés invitar a cada integrante desde Ajustes. Al aceptar, vincularán su cuenta.
              </p>
            </div>

            <button onClick={handleCreate} disabled={saving || !accountName.trim()}
              style={{ width: "100%", padding: 16, borderRadius: 16, background: saving || !accountName.trim() ? "#aaa" : "linear-gradient(135deg,#4F7FFA,#3a6ae8)", color: "#fff", border: "none", fontSize: 16, fontWeight: 600, cursor: saving || !accountName.trim() ? "default" : "pointer", fontFamily: FONT, marginBottom: 40 }}>
              {saving ? "Creando..." : "Crear cuenta →"}
            </button>
          </>
        )}

        {/* ── BOTTOM SHEETS — FIX: scroll lock en fondo ── */}
        {showCurrencySheet && (
          <div
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 200, display: "flex", alignItems: "flex-end" }}
            onClick={() => setShowCurrencySheet(false)}
            onTouchMove={e => e.preventDefault()}
          >
            <div
              style={{ background: colors.card, borderRadius: "24px 24px 0 0", width: "100%", padding: "24px 20px calc(40px + env(safe-area-inset-bottom))", fontFamily: FONT, maxHeight: "70vh", overflowY: "auto" }}
              onClick={e => e.stopPropagation()}
              onTouchMove={e => e.stopPropagation()}
            >
              <div style={{ width: 36, height: 4, background: colors.divider, borderRadius: 2, margin: "0 auto 20px" }} />
              <p style={{ fontSize: 17, fontWeight: 700, color: colors.text, margin: "0 0 16px", fontFamily: FONT }}>Divisa</p>
              {CURRENCIES.map(c => (
                <button key={c.code} onClick={() => { setSelectedCurrency(c.code); setShowCurrencySheet(false); }}
                  style={{ width: "100%", padding: "14px 16px", borderRadius: 14, border: `2px solid ${selectedCurrency === c.code ? "#4F7FFA" : colors.inputBorder}`, background: selectedCurrency === c.code ? "#4F7FFA11" : colors.input, marginBottom: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", fontFamily: FONT }}>
                  <div>
                    <span style={{ fontSize: 14, fontWeight: 700, color: colors.text, fontFamily: FONT }}>{c.symbol} {c.code}</span>
                    <span style={{ fontSize: 13, color: colors.textMuted, fontFamily: FONT }}> — {c.label}</span>
                  </div>
                  {selectedCurrency === c.code && <span style={{ color: "#4F7FFA", fontSize: 18 }}>✓</span>}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── BOTTOM NAV ── */}
      {step === "list" && (
        <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 60,
          background: colors.headerBg,
          borderTop: "1px solid rgba(255,255,255,0.10)",
          paddingBottom: "env(safe-area-inset-bottom)",
          display: "flex",
        }}>
          {[
            { id: "cuentas", label: "Mis Cuentas", badge: 0, icon: (active) => (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "#4F7FFA" : "#ffffff66"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="3"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></svg>
            )},
            { id: "notificaciones", label: "Notificaciones", badge: unreadCount, icon: (active) => (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "#4F7FFA" : "#ffffff66"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
            )},
            { id: "perfil", label: "Perfil", badge: 0, icon: (active) => (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "#4F7FFA" : "#ffffff66"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            )},
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "12px 0", background: "none", border: "none", cursor: "pointer", position: "relative" }}>
              <div style={{ position: "relative" }}>
                {tab.icon(activeTab === tab.id)}
                {tab.badge > 0 && (
                  <div style={{ position: "absolute", top: -4, right: -6, background: "#4F7FFA", borderRadius: 10, minWidth: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px" }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: "#fff", fontFamily: FONT }}>{tab.badge}</span>
                  </div>
                )}
              </div>
              <span style={{ fontSize: 10, fontWeight: 600, color: activeTab === tab.id ? "#4F7FFA" : "#ffffff66", fontFamily: FONT, letterSpacing: 0.3 }}>{tab.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* FIX: botón flotante "+ Nueva cuenta" siempre visible en lista */}
      {step === "list" && activeTab === "cuentas" && (
        <div style={{
          position: "fixed", bottom: "calc(env(safe-area-inset-bottom) + 72px)", left: 20, right: 20, zIndex: 55,
        }}>
          <button onClick={() => setStep("create")}
            style={{ width: "100%", padding: 16, borderRadius: 16, background: "linear-gradient(135deg,#4F7FFA,#3a6ae8)", color: "#fff", border: "none", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: FONT, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "0 4px 20px rgba(79,127,250,0.5)" }}>
            <span style={{ fontSize: 20 }}>+</span> Nueva cuenta
          </button>
        </div>
      )}

      {/* Modal confirmar eliminación */}
      {confirmDelete && (() => {
        const acc = visibleAccounts.find(a => a.id === confirmDelete) || accounts.find(a => a.id === confirmDelete);
        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
            <div style={{ background: colors.card, borderRadius: 24, padding: 24, width: "100%", maxWidth: 340, fontFamily: FONT, border: `1px solid ${colors.cardBorder}` }}>
              <p style={{ fontSize: 40, textAlign: "center", margin: "0 0 12px" }}>🗑️</p>
              <p style={{ fontSize: 18, fontWeight: 700, color: colors.text, margin: "0 0 6px", textAlign: "center", fontFamily: FONT }}>¿Eliminar cuenta?</p>
              {acc?.name && <p style={{ fontSize: 15, fontWeight: 700, color: "#4F7FFA", margin: "0 0 8px", textAlign: "center", fontFamily: FONT }}>{acc.name}</p>}
              <p style={{ fontSize: 13, color: colors.textMuted, margin: "0 0 24px", textAlign: "center", lineHeight: 1.5, fontFamily: FONT }}>Se van a borrar todos los datos. Esta acción no se puede deshacer.</p>
              <button onClick={handleDeleteConfirmed} style={{ width: "100%", padding: 14, borderRadius: 14, background: "#e74c3c", color: "#fff", border: "none", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: FONT, marginBottom: 8 }}>Sí, eliminar</button>
              <button onClick={() => setConfirmDelete(null)} style={{ width: "100%", padding: 14, borderRadius: 14, background: colors.pill, color: colors.textMuted, border: "none", fontSize: 15, cursor: "pointer", fontFamily: FONT }}>Cancelar</button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}