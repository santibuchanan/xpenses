/**
 * CreateAccountScreen.jsx
 * Pantalla unificada de creación de cuenta.
 *
 * mode="setup" → setup inicial (ConfigScreen): sin integrantes, writeBatch, guarda setupDone
 * mode="add"   → cuenta adicional (desde AccountSelectorScreen): con integrantes, guarda accountIds[]
 *
 * Reemplaza:
 *   - La lógica de creación embebida en ConfigScreen.jsx
 *   - El step "create" de AccountSelectorScreen.jsx
 */

import { useState } from "react";
import { doc, setDoc, addDoc, collection, writeBatch } from "firebase/firestore";
import { db } from "./firebase.js";
import { useTheme, CURRENCIES as CURRENCIES_MAP } from "./theme.jsx";
import { ALL_CATEGORIES, DEFAULT_CATEGORIES } from "./constants/categories.js";

const FONT = `'DM Sans', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif`;
const SF_PRO = `-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', sans-serif`;

const EMOJI_OPTIONS = [
  "👩🏼‍❤️‍👨🏼","🏠","🚙","🏟️","🍔","💃🏾","🏝️","🛫","🏥","🐶",
  "🐱","🍣","🎂","🍺","🍾","⚽️","🏋🏽‍♂️","🏂","⛷️","💻",
  "🚁","🥊","🧳","🎓",
];

const DIVISION_SYSTEMS = [
  { id: "proportional", label: "Proporcional al ingreso", icon: "📊", desc: "Ideal para parejas que conviven. Cada uno aporta según su sueldo." },
  { id: "50_50",        label: "Partes iguales",          icon: "⚖️", desc: "Cada uno paga exactamente la mitad." },
  { id: "pozo",         label: "Pozo Común",              icon: "🪣", desc: "Registrá gastos de un fondo común. Sin saldos entre miembros." },
];

const MEMBER_COLORS = ["#4F7FFA","#FA4F7F","#2ecc71","#f39c12","#9b59b6","#1abc9c"];
const CURRENCIES = Object.values(CURRENCIES_MAP).map(c => ({ code: c.code, label: c.name, symbol: c.symbol }));

// ── Subcomponentes de UI ──────────────────────────────────────────────────────

function Card({ children, style = {}, colors }) {
  return (
    <div style={{
      background: colors.card, borderRadius: 20, padding: 18, marginBottom: 12,
      boxShadow: colors.shadow, border: `1px solid ${colors.cardBorder}`, ...style,
    }}>
      {children}
    </div>
  );
}

function SectionLabel({ children, colors, error = false }) {
  return (
    <p style={{
      fontSize: 11, fontWeight: 700,
      color: error ? "#ff6b6b" : colors.textMuted,
      marginBottom: 10, letterSpacing: 0.6, textTransform: "uppercase", fontFamily: FONT,
    }}>
      {children}
    </p>
  );
}

// ── Modales reutilizables ─────────────────────────────────────────────────────

function EmojiSheet({ selected, onSelect, onClose, colors }) {
  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 200, display: "flex", alignItems: "flex-end" }}
      onClick={onClose}
      onTouchMove={e => e.preventDefault()}
    >
      <div
        style={{ background: colors.card, borderRadius: "24px 24px 0 0", width: "100%", padding: "24px 20px calc(40px + env(safe-area-inset-bottom))", fontFamily: FONT }}
        onClick={e => e.stopPropagation()}
        onTouchMove={e => e.stopPropagation()}
      >
        <div style={{ width: 36, height: 4, background: colors.divider, borderRadius: 2, margin: "0 auto 20px" }} />
        <p style={{ fontSize: 17, fontWeight: 700, color: colors.text, margin: "0 0 16px", fontFamily: FONT }}>Elegí un ícono</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          {EMOJI_OPTIONS.map(e => (
            <button type="button" key={e} onClick={() => { onSelect(e); onClose(); }}
              style={{ width: 52, height: 52, borderRadius: 14, border: "2px solid", fontSize: 26, cursor: "pointer",
                borderColor: selected === e ? "#4F7FFA" : colors.inputBorder,
                background: selected === e ? "#4F7FFA11" : colors.input }}>
              {e}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function CurrencySheet({ selected, onSelect, onClose, colors }) {
  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 200, display: "flex", alignItems: "flex-end" }}
      onClick={onClose}
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
          <button key={c.code} onClick={() => { onSelect(c.code); onClose(); }}
            style={{ width: "100%", padding: "14px 16px", borderRadius: 14, marginBottom: 8, cursor: "pointer",
              border: `2px solid ${selected === c.code ? "#4F7FFA" : colors.inputBorder}`,
              background: selected === c.code ? "#4F7FFA11" : colors.input,
              display: "flex", alignItems: "center", justifyContent: "space-between", fontFamily: FONT }}>
            <div>
              <span style={{ fontSize: 14, fontWeight: 700, color: colors.text, fontFamily: FONT }}>{c.symbol} {c.code}</span>
              <span style={{ fontSize: 13, color: colors.textMuted, fontFamily: FONT }}> — {c.label}</span>
            </div>
            {selected === c.code && <span style={{ color: "#4F7FFA", fontSize: 18 }}>✓</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

function NewCategoryModal({ onAdd, onClose, colors }) {
  const [label, setLabel] = useState("");
  const [icon, setIcon]   = useState("📦");

  const handleAdd = () => {
    const trimmed = label.trim();
    if (!trimmed) return;
    onAdd({ id: `custom_${Date.now()}`, label: trimmed, icon });
    onClose();
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 200, display: "flex", alignItems: "flex-end" }}>
      <div style={{ background: colors.card, borderRadius: "24px 24px 0 0", width: "100%", padding: "24px 20px 44px", fontFamily: FONT, maxHeight: "85vh", overflowY: "auto" }}>
        <div style={{ width: 36, height: 4, background: colors.divider, borderRadius: 2, margin: "0 auto 20px" }} />
        <p style={{ fontSize: 18, fontWeight: 700, color: colors.text, margin: "0 0 20px", fontFamily: FONT }}>Nueva categoría</p>

        <p style={{ fontSize: 11, fontWeight: 600, color: colors.textMuted, marginBottom: 6, letterSpacing: 0.6, textTransform: "uppercase", fontFamily: FONT }}>Nombre</p>
        <input
          value={label} onChange={e => setLabel(e.target.value)}
          placeholder="Ej: Mascotas" autoFocus
          style={{ width: "100%", padding: "13px 14px", borderRadius: 14, border: `2px solid ${colors.inputBorder}`, fontSize: 15, marginBottom: 16, fontFamily: FONT, outline: "none", boxSizing: "border-box", color: colors.inputText, background: colors.input }}
        />

        <p style={{ fontSize: 11, fontWeight: 600, color: colors.textMuted, marginBottom: 10, letterSpacing: 0.6, textTransform: "uppercase", fontFamily: FONT }}>Icono</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
          {EMOJI_OPTIONS.map(e => (
            <button type="button" key={e} onClick={() => setIcon(e)}
              style={{ width: 44, height: 44, borderRadius: 12, border: "2px solid", fontSize: 22, cursor: "pointer",
                borderColor: icon === e ? "#4F7FFA" : colors.inputBorder,
                background: icon === e ? "#4F7FFA11" : colors.input }}>
              {e}
            </button>
          ))}
        </div>

        <button type="button" onClick={handleAdd} disabled={!label.trim()}
          style={{ width: "100%", padding: 14, borderRadius: 14, border: "none", fontSize: 15, fontWeight: 600, fontFamily: FONT, marginBottom: 8, cursor: label.trim() ? "pointer" : "default",
            background: label.trim() ? "linear-gradient(135deg,#4F7FFA,#3a6ae8)" : "#ccc", color: "#fff" }}>
          Guardar
        </button>
        <button type="button" onClick={onClose}
          style={{ width: "100%", padding: 14, borderRadius: 14, background: colors.pill, color: colors.textMuted, border: "none", fontSize: 15, cursor: "pointer", fontFamily: FONT }}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

/**
 * @param {object}   props
 * @param {"setup"|"add"} props.mode
 * @param {object}   props.user           - Firebase Auth user
 * @param {object}   [props.userProfile]  - Perfil de Firestore (solo mode="add")
 * @param {object[]} [props.existingAccounts] - Cuentas existentes (solo mode="add")
 * @param {function} props.onDone         - mode="setup": () => void
 * @param {function} props.onCreated      - mode="add": (accountId) => void
 * @param {function} [props.onCancel]     - mode="add": () => void (volver a la lista)
 */
export default function CreateAccountScreen({
  mode = "setup",
  user,
  userProfile,
  existingAccounts = [],
  onDone,
  onCreated,
  onCancel,
}) {
  const isSetup = mode === "setup";
  const { colors } = useTheme();

  // En setup, usamos fondo claro fijo (igual que ConfigScreen original)
  const bg      = isSetup ? "#f7f8fc" : colors.bg;
  const cardBg  = isSetup ? "#fff"    : colors.card;
  const cardBorder = isSetup ? "none" : `1px solid ${colors.cardBorder}`;
  const textMain   = isSetup ? "#1a1a2e" : colors.text;
  const textMuted  = isSetup ? "#aaa"    : colors.textMuted;
  const inputBg    = isSetup ? "#fafafa" : colors.input;
  const inputBorder = isSetup ? "#e8e8e8" : colors.inputBorder;
  const inputText   = isSetup ? "#1a1a2e" : colors.inputText;
  const divider     = isSetup ? "#e8e8e8" : colors.divider;
  const pill        = isSetup ? "#f0f0f0" : colors.pill;

  // Colores unificados para subcomponentes que usan el theme object
  const themeColors = {
    card: cardBg, cardBorder: isSetup ? "#e8e8e8" : colors.cardBorder,
    shadow: isSetup ? "0 2px 12px rgba(0,0,0,0.05)" : colors.shadow,
    text: textMain, textMuted, input: inputBg, inputBorder, inputText, divider, pill,
    danger: colors.danger, dangerBg: colors.dangerBg,
  };

  // ── State ──
  const [accountType,         setAccountType]        = useState("shared");
  const [divisionSystem,      setDivisionSystem]     = useState("proportional");
  const [accountName,         setAccountName]        = useState(isSetup ? "Nuestro Hogar" : "");
  const [selectedEmoji,       setSelectedEmoji]      = useState("🏠");
  const [selectedCurrency,    setSelectedCurrency]   = useState("ARS");
  const [selectedCategories,  setSelectedCategories] = useState([]);
  const [customCats,          setCustomCats]         = useState([]);
  const [catError,            setCatError]           = useState(false);
  const [emojiError,          setEmojiError]         = useState(false);
  const [saving,              setSaving]             = useState(false);

  // Sheets / modals
  const [showEmojiSheet,    setShowEmojiSheet]    = useState(false);
  const [showCurrencySheet, setShowCurrencySheet] = useState(false);
  const [showNewCatModal,   setShowNewCatModal]   = useState(false);

  // Setup-only: nombre y salario del creador
  const [myName,  setMyName]  = useState(user.displayName?.split(" ")[0] || "");
  const [salary,  setSalary]  = useState("");

  // Add-only: integrantes
  const ownerDisplayName = userProfile?.alias || userProfile?.name || user.displayName?.split(" ")[0] || "";
  const [members,       setMembers]       = useState([{ name: ownerDisplayName, color: MEMBER_COLORS[0] }]);
  const [newMemberName, setNewMemberName] = useState("");
  const [memberSalaries, setMemberSalaries] = useState({ 0: "" });

  // ── Helpers integrantes (solo mode="add") ──
  const addMember = () => {
    const trimmed = newMemberName.trim();
    if (!trimmed) return;
    const color = MEMBER_COLORS[members.length % MEMBER_COLORS.length];
    setMembers(prev => [...prev, { name: trimmed, color }]);
    setNewMemberName("");
  };
  const removeMember     = (idx) => setMembers(prev => prev.filter((_, i) => i !== idx));
  const updateMemberName = (idx, val) => setMembers(prev => prev.map((m, i) => i === idx ? { ...m, name: val } : m));

  // ── Categorías ──
  const toggleCategory = (id) => {
    setSelectedCategories(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
    setCatError(false);
  };
  const handleAddCustomCat = (cat) => {
    setCustomCats(prev => [...prev, cat]);
    setSelectedCategories(prev => [...prev, cat.id]);
    setCatError(false);
  };

  const allCatsForDisplay = isSetup
    ? [...ALL_CATEGORIES, ...customCats]
    : [...DEFAULT_CATEGORIES, ...customCats];

  // ── Save — setup ──
  const handleSaveSetup = async () => {
    if (selectedCategories.length === 0) { setCatError(true); return; }
    if (!myName) return;
    setSaving(true);
    try {
      const accountRef = doc(collection(db, "accounts"));
      const accountId  = accountRef.id;
      const defaultIds = DEFAULT_CATEGORIES.map(c => c.id);
      const allCats    = [...ALL_CATEGORIES, ...customCats];
      const extraCats  = allCats.filter(c => selectedCategories.includes(c.id) && !defaultIds.includes(c.id));

      const batch = writeBatch(db);
      batch.set(accountRef, {
        id: accountId, name: accountName, emoji: selectedEmoji, type: divisionSystem === "pozo" ? "pozo" : accountType,
        divisionSystem, ownerId: user.uid, memberIds: [user.uid], currency: selectedCurrency,
        createdAt: new Date().toISOString(),
        disabledCategories: DEFAULT_CATEGORIES.filter(c => !selectedCategories.includes(c.id)).map(c => c.id),
      });
      batch.set(doc(db, "users", user.uid), {
        uid: user.uid, name: myName, email: user.email || null, photo: user.photoURL || null,
        salary: parseFloat(salary) || 0, color: "#4F7FFA", accountId, accountIds: [accountId],
        isAnonymous: user.isAnonymous || false, setupDone: true,
      }, { merge: true });
      await batch.commit();

      if (extraCats.length > 0) {
        await Promise.all(extraCats.map(cat =>
          addDoc(collection(db, "accounts", accountId, "categories"), { label: cat.label, icon: cat.icon })
        ));
      }
      onDone();
    } catch (err) {
      console.error("Error en setup inicial:", err);
    } finally {
      setSaving(false);
    }
  };

  // ── Save — add ──
  const handleSaveAdd = async () => {
    if (!selectedEmoji) { setEmojiError(true); return; }
    if (selectedCategories.length === 0) { setCatError(true); return; }
    if (!accountName.trim()) return;
    setSaving(true);

    const ownerName    = members[0]?.name?.trim() || ownerDisplayName;
    const otherMembers = members.slice(1).filter(m => m.name.trim());

    const ownerLabel = {
      id: "label_owner",
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
    }))];

    const ref = await addDoc(collection(db, "accounts"), {
      name: accountName, emoji: selectedEmoji, type: divisionSystem === "pozo" ? "pozo" : accountType,
      divisionSystem, ownerId: user.uid, memberIds: [user.uid],
      memberLabels, currency: selectedCurrency,
      disabledCategories: DEFAULT_CATEGORIES.filter(c => !selectedCategories.includes(c.id)).map(c => c.id),
      createdAt: new Date().toISOString(),
    });

    const ownerUpdate = { name: ownerName || undefined };
    if (divisionSystem === "proportional" && memberSalaries[0]) {
      ownerUpdate.salary = parseFloat(memberSalaries[0].replace(/\./g, "").replace(",", ".")) || 0;
    }
    if (ownerName) await setDoc(doc(db, "users", user.uid), ownerUpdate, { merge: true });

    await setDoc(doc(db, "users", user.uid), {
      accountIds: [...existingAccounts.map(a => a.id), ref.id],
    }, { merge: true });

    if (customCats.length > 0) {
      await Promise.all(customCats.map(cat =>
        addDoc(collection(db, "accounts", ref.id, "categories"), { label: cat.label, icon: cat.icon })
      ));
    }

    setSaving(false);
    onCreated(ref.id);
  };

  const handleSave = isSetup ? handleSaveSetup : handleSaveAdd;
  const canSave = isSetup
    ? (!saving && !!myName)
    : (!saving && !!accountName.trim());

  // ── Render ──
  return (
    <div style={{ minHeight: "100dvh", background: bg, fontFamily: isSetup ? SF_PRO : FONT }}>
      <style>{`* { box-sizing: border-box; }`}</style>

      {/* Header */}
      {isSetup ? (
        <div style={{ background: "linear-gradient(140deg, #1a1a2e, #0f3460)", padding: "52px 20px 28px" }}>
          <p style={{ color: "#ffffff44", fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", margin: "0 0 8px" }}>X-penses</p>
          <p style={{ fontSize: 28, fontWeight: 700, color: "#fff", margin: 0 }}>Configuración inicial</p>
          <p style={{ color: "#ffffff66", fontSize: 14, margin: "6px 0 0" }}>Vamos a dejar todo listo para vos</p>
        </div>
      ) : (
        <div style={{
          position: "sticky", top: 0, zIndex: 50, background: colors.headerBg,
          paddingTop: "calc(env(safe-area-inset-top) + 16px)",
          paddingBottom: 16, paddingLeft: 20, paddingRight: 20,
        }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <button type="button" onClick={onCancel}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#4F7FFA", fontSize: 15, fontWeight: 600, fontFamily: FONT, padding: 0 }}>
              Cancelar
            </button>
            <p style={{ flex: 1, textAlign: "center", fontSize: 16, fontWeight: 700, color: "#fff", margin: 0, fontFamily: FONT }}>Nueva cuenta</p>
            <div style={{ width: 60 }} />
          </div>
        </div>
      )}

      <div style={{ padding: "20px", paddingBottom: isSetup ? 0 : 40 }}>

        {/* ── Tipo de cuenta ── */}
        <Card colors={themeColors}>
          <p style={{ fontSize: 17, fontWeight: 600, margin: "0 0 4px", color: textMain }}>¿Qué tipo de cuenta querés?</p>
          <p style={{ color: textMuted, fontSize: 13, margin: "0 0 16px" }}>Podés cambiarlo después en ajustes</p>
          <div style={{ display: "flex", gap: 10 }}>
            {[["personal","👤","Personal","Solo para vos"],["shared","👥","Compartida","Con tu pareja o compañeros"]].map(([val,icon,lbl,desc]) => (
              <button type="button" key={val} onClick={() => setAccountType(val)}
                style={{ flex: 1, padding: 16, borderRadius: 16, border: "2px solid", cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                  borderColor: accountType === val ? "#4F7FFA" : inputBorder,
                  background: accountType === val ? "#4F7FFA11" : inputBg }}>
                <p style={{ fontSize: 24, margin: "0 0 6px" }}>{icon}</p>
                <p style={{ margin: "0 0 4px", fontWeight: 600, fontSize: 14, color: accountType === val ? "#4F7FFA" : textMain }}>{lbl}</p>
                <p style={{ margin: 0, fontSize: 12, color: textMuted }}>{desc}</p>
              </button>
            ))}
          </div>
        </Card>

        {/* ── Nombre + Emoji ── */}
        <Card colors={themeColors}>
          <SectionLabel colors={themeColors}>Nombre de la cuenta</SectionLabel>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{ position: "relative", flexShrink: 0 }}>
              <button type="button" onClick={() => { setEmojiError(false); setShowEmojiSheet(true); }}
                style={{ width: 52, height: 52, borderRadius: 14, fontSize: 26, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: emojiError ? "#ff6b6b11" : inputBg,
                  border: `2px solid ${emojiError ? "#ff6b6b" : inputBorder}` }}>
                {selectedEmoji}
              </button>
              {emojiError && !selectedEmoji && (
                <p style={{ position: "absolute", top: 54, left: 0, margin: 0, fontSize: 10, color: "#ff6b6b", fontFamily: FONT, whiteSpace: "nowrap" }}>Obligatorio</p>
              )}
            </div>
            <input
              value={accountName} onChange={e => setAccountName(e.target.value)}
              placeholder={isSetup ? "Ej: Nuestro Hogar" : "Ej: Casa, Vacaciones..."}
              autoFocus={!isSetup}
              style={{ flex: 1, padding: "13px 14px", borderRadius: 14, border: `2px solid ${inputBorder}`, fontSize: 15, fontFamily: "inherit", outline: "none", boxSizing: "border-box", color: inputText, background: inputBg }}
            />
          </div>
        </Card>

        {/* ── Perfil del creador (solo setup) ── */}
        {isSetup && (
          <Card colors={themeColors}>
            <p style={{ fontSize: 17, fontWeight: 600, margin: "0 0 16px", color: textMain }}>Tu perfil</p>
            {user.photoURL && (
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <img src={user.photoURL} style={{ width: 48, height: 48, borderRadius: 24 }} alt="foto" />
                <p style={{ margin: 0, color: textMuted, fontSize: 13 }}>{user.email}</p>
              </div>
            )}
            <p style={{ fontSize: 11, fontWeight: 600, color: textMuted, marginBottom: 6, letterSpacing: 0.6, textTransform: "uppercase" }}>¿Cómo te llamamos?</p>
            <input value={myName} onChange={e => setMyName(e.target.value)}
              placeholder="Tu nombre"
              style={{ width: "100%", padding: "13px 14px", borderRadius: 14, border: `2px solid ${inputBorder}`, fontSize: 15, marginBottom: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box", color: inputText, background: inputBg }}
            />
            {divisionSystem === "proportional" && (
              <>
                <p style={{ fontSize: 11, fontWeight: 600, color: textMuted, marginBottom: 6, letterSpacing: 0.6, textTransform: "uppercase" }}>Salario mensual</p>
                <input type="number" value={salary} onChange={e => setSalary(e.target.value)}
                  placeholder="0"
                  style={{ width: "100%", padding: "13px 14px", borderRadius: 14, border: `2px solid ${inputBorder}`, fontSize: 15, marginBottom: 0, fontFamily: "inherit", outline: "none", boxSizing: "border-box", color: inputText, background: inputBg }}
                />
              </>
            )}
          </Card>
        )}

        {/* ── Divisa ── */}
        <Card colors={themeColors}>
          <SectionLabel colors={themeColors}>Divisa</SectionLabel>
          <button type="button" onClick={() => setShowCurrencySheet(true)}
            style={{ width: "100%", padding: "12px 14px", borderRadius: 14, border: `2px solid ${inputBorder}`, background: inputBg, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", fontFamily: "inherit" }}>
            <div style={{ textAlign: "left" }}>
              {!isSetup && <p style={{ margin: "0 0 2px", fontSize: 11, color: textMuted, fontWeight: 600, letterSpacing: 0.4, textTransform: "uppercase", fontFamily: FONT }}>Divisa</p>}
              <p style={{ margin: 0, fontSize: 14, color: textMain, fontWeight: 600, fontFamily: FONT }}>
                {CURRENCIES.find(c => c.code === selectedCurrency)?.symbol} {selectedCurrency} — {CURRENCIES.find(c => c.code === selectedCurrency)?.label}
              </p>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={textMuted} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
          </button>
        </Card>

        {/* ── División (solo shared) ── */}
        {accountType === "shared" && (
          <Card colors={themeColors}>
            <p style={{ fontSize: 17, fontWeight: 600, margin: "0 0 4px", color: textMain }}>¿Cómo dividir los gastos?</p>
            <p style={{ color: textMuted, fontSize: 13, margin: "0 0 16px" }}>Podés cambiarlo después</p>
            {DIVISION_SYSTEMS.map(s => (
              <button type="button" key={s.id} onClick={() => setDivisionSystem(s.id)}
                style={{ width: "100%", padding: "14px 16px", borderRadius: 14, border: "2px solid", cursor: "pointer", fontFamily: "inherit", textAlign: "left", marginBottom: 8, display: "flex", alignItems: "center", gap: 12,
                  borderColor: divisionSystem === s.id ? "#4F7FFA" : inputBorder,
                  background: divisionSystem === s.id ? "#4F7FFA11" : inputBg }}>
                <span style={{ fontSize: 22 }}>{s.icon}</span>
                <div>
                  <p style={{ margin: "0 0 2px", fontWeight: 600, fontSize: 14, color: divisionSystem === s.id ? "#4F7FFA" : textMain }}>{s.label}</p>
                  <p style={{ margin: 0, fontSize: 12, color: textMuted }}>{s.desc}</p>
                </div>
                {divisionSystem === s.id && <span style={{ marginLeft: "auto", color: "#4F7FFA", fontSize: 18 }}>✓</span>}
              </button>
            ))}
          </Card>
        )}

        {/* ── Categorías ── */}
        <Card colors={themeColors} style={{ border: catError && selectedCategories.length === 0 ? "2px solid #ff6b6b" : cardBorder }}>
          <p style={{ fontSize: isSetup ? 17 : 11, fontWeight: isSetup ? 600 : 700,
            color: catError && selectedCategories.length === 0 ? "#ff6b6b" : (isSetup ? textMain : textMuted),
            margin: isSetup ? "0 0 4px" : "0 0 10px", letterSpacing: isSetup ? 0 : 0.6,
            textTransform: isSetup ? "none" : "uppercase", fontFamily: FONT }}>
            {isSetup ? "¿Qué categorías usás?" : "Categorías"}
          </p>
          {catError && selectedCategories.length === 0 && (
            <p style={{ fontSize: 12, color: "#ff6b6b", margin: "0 0 10px", fontFamily: FONT }}>Seleccioná al menos una categoría</p>
          )}
          <p style={{ color: textMuted, fontSize: 13, margin: "0 0 12px", fontFamily: FONT }}>Elegí las que vas a usar en esta cuenta.</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {allCatsForDisplay.map(c => {
              const sel = selectedCategories.includes(c.id);
              return (
                <button type="button" key={c.id} onClick={() => toggleCategory(c.id)}
                  style={{ padding: "9px 14px", borderRadius: 20, border: "2px solid", fontSize: 13, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6,
                    borderColor: sel ? "#4F7FFA" : inputBorder,
                    background: sel ? "#4F7FFA" : inputBg,
                    color: sel ? "#fff" : textMuted, fontWeight: sel ? 600 : 400 }}>
                  {c.icon} {c.label}
                </button>
              );
            })}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
            <button type="button" onClick={() => setShowNewCatModal(true)}
              style={{ padding: "9px 14px", borderRadius: 20, border: "2px dashed #4F7FFA", fontSize: 13, cursor: "pointer", fontFamily: "inherit", color: "#4F7FFA", background: "#4F7FFA08", fontWeight: 600 }}>
              + Nueva
            </button>
          </div>
          <p style={{ color: textMuted, fontSize: 12, margin: "10px 0 0", textAlign: "center", fontFamily: FONT }}>
            {selectedCategories.length} seleccionada{selectedCategories.length !== 1 ? "s" : ""}
          </p>
        </Card>

        {/* ── Integrantes (solo add + shared) ── */}
        {!isSetup && accountType === "shared" && (
          <>
            <Card colors={themeColors}>
              <SectionLabel colors={themeColors}>Integrantes</SectionLabel>
              <p style={{ fontSize: 12, color: textMuted, margin: "0 0 14px", fontFamily: FONT }}>
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
                      style={{ flex: 1, padding: "10px 12px", borderRadius: 12, border: `2px solid ${inputBorder}`, fontSize: 14, fontFamily: FONT, outline: "none", color: inputText, background: inputBg, boxSizing: "border-box" }} />
                    {idx > 0 && (
                      <button type="button" onClick={() => removeMember(idx)}
                        style={{ background: colors.dangerBg, border: "none", borderRadius: 10, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 16, color: colors.danger, flexShrink: 0 }}>×</button>
                    )}
                  </div>
                  {divisionSystem === "proportional" && (
                    <div style={{ marginLeft: 46, marginTop: 6, position: "relative" }}>
                      <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: textMuted, fontWeight: 600, fontSize: 13, fontFamily: FONT }}>$</span>
                      <input type="number" inputMode="decimal"
                        value={memberSalaries[idx] || ""}
                        onChange={e => setMemberSalaries(prev => ({ ...prev, [idx]: e.target.value }))}
                        placeholder="Ingreso mensual (opcional)"
                        style={{ width: "100%", padding: "8px 12px 8px 26px", borderRadius: 12, border: `2px solid ${inputBorder}`, fontSize: 13, fontFamily: FONT, outline: "none", color: inputText, background: inputBg, boxSizing: "border-box" }} />
                    </div>
                  )}
                </div>
              ))}
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <input value={newMemberName} onChange={e => setNewMemberName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addMember()}
                  placeholder="Agregar integrante..."
                  style={{ flex: 1, padding: "10px 12px", borderRadius: 12, border: `2px dashed ${inputBorder}`, fontSize: 14, fontFamily: FONT, outline: "none", color: inputText, background: inputBg, boxSizing: "border-box" }} />
                <button type="button" onClick={addMember}
                  style={{ background: "#4F7FFA", border: "none", borderRadius: 12, width: 42, height: 42, fontSize: 22, color: "#fff", cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
              </div>
            </Card>

            <div style={{ background: "#4F7FFA11", borderRadius: 14, padding: "12px 14px", marginBottom: 16, display: "flex", gap: 10 }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>💡</span>
              <p style={{ margin: 0, fontSize: 12, color: textMuted, fontFamily: FONT, lineHeight: 1.5 }}>
                Después podés invitar a cada integrante desde Ajustes. Al aceptar, vincularán su cuenta.
              </p>
            </div>
          </>
        )}

        {/* ── Botón guardar ── */}
        <button type="button" onClick={handleSave} disabled={!canSave}
          style={{ width: "100%", padding: 16, borderRadius: 16, border: "none", fontSize: 16, fontWeight: 600, fontFamily: "inherit", marginTop: 8,
            background: canSave ? "linear-gradient(135deg,#4F7FFA,#3a6ae8)" : "#aaa",
            color: "#fff", cursor: canSave ? "pointer" : "default" }}>
          {saving ? (isSetup ? "Guardando..." : "Creando...") : (isSetup ? "Comenzar →" : "Crear cuenta →")}
        </button>
        <div style={{ height: 40 }} />
      </div>

      {/* ── Bottom sheets ── */}
      {showEmojiSheet && (
        <EmojiSheet
          selected={selectedEmoji}
          onSelect={setSelectedEmoji}
          onClose={() => setShowEmojiSheet(false)}
          colors={themeColors}
        />
      )}
      {showCurrencySheet && (
        <CurrencySheet
          selected={selectedCurrency}
          onSelect={setSelectedCurrency}
          onClose={() => setShowCurrencySheet(false)}
          colors={themeColors}
        />
      )}
      {showNewCatModal && (
        <NewCategoryModal
          onAdd={handleAddCustomCat}
          onClose={() => setShowNewCatModal(false)}
          colors={themeColors}
        />
      )}
    </div>
  );
}