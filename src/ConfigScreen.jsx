import { useState } from "react";
import { doc, setDoc, addDoc, collection, writeBatch } from "firebase/firestore";
import { db } from "./firebase";
import { CURRENCIES } from "./theme.jsx";

const SF_PRO = `-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', sans-serif`;

const EMOJI_OPTIONS = ["👩🏼‍❤️‍👨🏼","🏠","🚙","🏟️","🍔","💃🏾","🏝️","🛫","🏥","🐶","🐱","🍣","🎂","🍺","🍾","⚽️","🏋🏽‍♂️","🏂","⛷️","💻"];

const DIVISION_SYSTEMS = [
  { id: "proportional", label: "Proporcional al ingreso", desc: "Ideal para parejas que conviven. Cada uno aporta según su sueldo.", icon: "📊" },
  { id: "50_50",        label: "Partes iguales",          desc: "Cada uno paga exactamente la mitad.", icon: "⚖️" },
  { id: "informativo",  label: "Gastos en común",         desc: "Registrá y gestioná gastos sin calcular quién le debe a quién.", icon: "🤝" },
];

// FIX: tamaño de letra ELIMINADO de ConfigScreen — se movió a MenuPanel (localStorage global)

import { ALL_CATEGORIES, DEFAULT_CATEGORIES } from "./constants/categories.js";

const labelStyle = { fontSize: 11, fontWeight: 600, color: "#888", marginBottom: 6, letterSpacing: 0.6, textTransform: "uppercase" };
const inputStyle = { width: "100%", padding: "13px 14px", borderRadius: 14, border: "2px solid #e8e8e8", fontSize: 15, marginBottom: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box", color: "#1a1a2e", background: "#fafafa" };
function Card({ children, style = {} }) { return <div style={{ background: "#fff", borderRadius: 20, padding: 18, marginBottom: 12, boxShadow: "0 2px 12px rgba(0,0,0,0.05)", ...style }}>{children}</div>; }

const MEMBER_COLORS = ["#4F7FFA","#FA4F7F","#2ecc71","#f39c12","#9b59b6","#1abc9c"];

export default function ConfigScreen({ user, onDone }) {
  const [accountType,         setAccountType]        = useState("shared");
  const [divisionSystem,      setDivisionSystem]     = useState("proportional");
  const [accountName,         setAccountName]        = useState("Nuestro Hogar");
  const [selectedEmoji,       setSelectedEmoji]      = useState("🏠");
  const [showEmojiSheet,      setShowEmojiSheet]     = useState(false);
  const [selectedCurrency,    setSelectedCurrency]   = useState("ARS");
  const [showCurrencySheet,   setShowCurrencySheet]  = useState(false);
  const [showNewCatModal,     setShowNewCatModal]    = useState(false);
  const [myName,              setMyName]             = useState(user.displayName?.split(" ")[0] || (user.isAnonymous ? "" : ""));
  const [salary,              setSalary]             = useState("");
  const [selectedCategories,  setSelectedCategories] = useState([]);
  const [catError,            setCatError]           = useState(false);
  const [saving,              setSaving]             = useState(false);
  const [newCatLabel,         setNewCatLabel]        = useState("");
  const [newCatIcon,          setNewCatIcon]         = useState("📦");
  const [customCats,          setCustomCats]         = useState([]);

  const currencyList = Object.values(CURRENCIES);

  const toggleCategory = (id) => {
    setSelectedCategories(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
    setCatError(false);
  };

  const addCustomCat = () => {
    const label = newCatLabel.trim();
    if (!label) return;
    const id = `custom_${Date.now()}`;
    const newCat = { id, label, icon: newCatIcon };
    setCustomCats(prev => [...prev, newCat]);
    setSelectedCategories(prev => [...prev, id]);
    setNewCatLabel("");
    setNewCatIcon("📦");
    setCatError(false);
  };

  const handleSave = async () => {
    if (selectedCategories.length === 0) { setCatError(true); return; }
    if (!myName) return;
    setSaving(true);
    try {
      const accountRef = doc(collection(db, "accounts"));
      const accountId = accountRef.id;
      const defaultIds = DEFAULT_CATEGORIES.map(c => c.id);
      const allCats = [...ALL_CATEGORIES, ...customCats];
      const extraCats = allCats.filter(c => selectedCategories.includes(c.id) && !defaultIds.includes(c.id));
      const batch = writeBatch(db);
      batch.set(accountRef, {
        id: accountId, name: accountName, emoji: selectedEmoji, type: accountType,
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

  return (
    <div style={{ minHeight: "100vh", background: "#f7f8fc", fontFamily: SF_PRO }}>
      <style>{`* { box-sizing: border-box; }`}</style>

      <div style={{ background: "linear-gradient(140deg, #1a1a2e, #0f3460)", padding: "52px 20px 28px" }}>
        <p style={{ color: "#ffffff44", fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", margin: "0 0 8px" }}>X-penses</p>
        <p style={{ fontSize: 28, fontWeight: 700, color: "#fff", margin: 0 }}>Configuración inicial</p>
        <p style={{ color: "#ffffff66", fontSize: 14, margin: "6px 0 0" }}>Vamos a dejar todo listo para vos</p>
      </div>

      <div style={{ padding: "20px" }}>

        {/* Tipo de cuenta */}
        <Card>
          <p style={{ fontSize: 17, fontWeight: 600, margin: "0 0 4px", color: "#1a1a2e" }}>¿Qué tipo de cuenta querés?</p>
          <p style={{ color: "#aaa", fontSize: 13, margin: "0 0 16px" }}>Podés cambiarlo después en ajustes</p>
          <div style={{ display: "flex", gap: 10 }}>
            {[["personal","👤","Personal","Solo para vos"],["shared","👥","Compartida","Con tu pareja o compañeros"]].map(([val,icon,lbl,desc]) => (
              <button type="button" key={val} onClick={() => setAccountType(val)} style={{ flex: 1, padding: 16, borderRadius: 16, border: "2px solid", cursor: "pointer", fontFamily: "inherit", textAlign: "left", borderColor: accountType === val ? "#4F7FFA" : "#e8e8e8", background: accountType === val ? "#4F7FFA11" : "#fafafa" }}>
                <p style={{ fontSize: 24, margin: "0 0 6px" }}>{icon}</p>
                <p style={{ margin: "0 0 4px", fontWeight: 600, fontSize: 14, color: accountType === val ? "#4F7FFA" : "#1a1a2e" }}>{lbl}</p>
                <p style={{ margin: 0, fontSize: 12, color: "#aaa" }}>{desc}</p>
              </button>
            ))}
          </div>
        </Card>

        {/* Nombre + Emoji */}
        <Card>
          <p style={labelStyle}>Nombre de la cuenta</p>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 0 }}>
            {/* F3: emoji abre bottom sheet — SIN input oculto, SIN teclado nativo */}
            <button
              type="button"
              style={{ width: 52, height: 52, borderRadius: 14, background: "#f0f0f0", border: "2px solid #e8e8e8", fontSize: 26, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowEmojiSheet(true); }}>
              {selectedEmoji}
            </button>
            <input value={accountName} onChange={e => setAccountName(e.target.value)}
              style={{ ...inputStyle, marginBottom: 0, flex: 1 }} placeholder="Ej: Nuestro Hogar" />
          </div>
        </Card>

        {/* Perfil — creador */}
        <Card>
          <p style={{ fontSize: 17, fontWeight: 600, margin: "0 0 16px", color: "#1a1a2e" }}>Tu perfil</p>
          {user.photoURL && (
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <img src={user.photoURL} style={{ width: 48, height: 48, borderRadius: 24 }} alt="foto" />
              <p style={{ margin: 0, color: "#888", fontSize: 13 }}>{user.email}</p>
            </div>
          )}
          <p style={labelStyle}>¿Cómo te llamamos?</p>
          <input value={myName} onChange={e => setMyName(e.target.value)} style={inputStyle} placeholder="Tu nombre" />
          {divisionSystem === "proportional" && (
            <>
              <p style={labelStyle}>Salario mensual (ARS $)</p>
              <input type="number" value={salary} onChange={e => setSalary(e.target.value)} style={{ ...inputStyle, marginBottom: 0 }} placeholder="0" />
            </>
          )}
        </Card>

        {/* Divisa */}
        <Card>
          <p style={labelStyle}>Divisa</p>
          <button type="button" onClick={() => setShowCurrencySheet(true)}
            style={{ width: "100%", padding: "12px 14px", borderRadius: 14, border: "2px solid #e8e8e8", background: "#fafafa", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", fontFamily: "inherit" }}>
            <span style={{ fontSize: 14, color: "#1a1a2e", fontWeight: 600 }}>
              {CURRENCIES[selectedCurrency]?.symbol} {selectedCurrency} — {CURRENCIES[selectedCurrency]?.name}
            </span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
          </button>
        </Card>

        {/* División (solo shared) */}
        {accountType === "shared" && (
          <Card>
            <p style={{ fontSize: 17, fontWeight: 600, margin: "0 0 4px", color: "#1a1a2e" }}>¿Cómo dividir los gastos?</p>
            <p style={{ color: "#aaa", fontSize: 13, margin: "0 0 16px" }}>Podés cambiarlo después</p>
            {DIVISION_SYSTEMS.map(s => (
              <button type="button" key={s.id} onClick={() => setDivisionSystem(s.id)} style={{ width: "100%", padding: "14px 16px", borderRadius: 14, border: "2px solid", cursor: "pointer", fontFamily: "inherit", textAlign: "left", marginBottom: 8, display: "flex", alignItems: "center", gap: 12, borderColor: divisionSystem === s.id ? "#4F7FFA" : "#e8e8e8", background: divisionSystem === s.id ? "#4F7FFA11" : "#fafafa" }}>
                <span style={{ fontSize: 22 }}>{s.icon}</span>
                <div>
                  <p style={{ margin: "0 0 2px", fontWeight: 600, fontSize: 14, color: divisionSystem === s.id ? "#4F7FFA" : "#1a1a2e" }}>{s.label}</p>
                  <p style={{ margin: 0, fontSize: 12, color: "#aaa" }}>{s.desc}</p>
                </div>
                {divisionSystem === s.id && <span style={{ marginLeft: "auto", color: "#4F7FFA", fontSize: 18 }}>✓</span>}
              </button>
            ))}
          </Card>
        )}

        {/* Categorías */}
        <Card style={{ border: catError && selectedCategories.length === 0 ? "2px solid #ff6b6b" : "none" }}>
          <p style={{ fontSize: 17, fontWeight: 600, margin: "0 0 4px", color: catError && selectedCategories.length === 0 ? "#ff6b6b" : "#1a1a2e" }}>¿Qué categorías usás?</p>
          {catError && selectedCategories.length === 0 && (
            <p style={{ fontSize: 12, color: "#ff6b6b", margin: "0 0 8px" }}>Seleccioná al menos una categoría</p>
          )}
          <p style={{ color: "#aaa", fontSize: 13, margin: "0 0 16px" }}>Elegí las que vas a usar en tu cuenta.</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {[...ALL_CATEGORIES, ...customCats].map(c => {
              const selected = selectedCategories.includes(c.id);
              return (
                <button type="button" key={c.id} onClick={() => toggleCategory(c.id)} style={{ padding: "9px 14px", borderRadius: 20, border: "2px solid", fontSize: 13, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6, borderColor: selected ? "#4F7FFA" : "#e8e8e8", background: selected ? "#4F7FFA" : "#fafafa", color: selected ? "#fff" : "#555", fontWeight: selected ? 600 : 400 }}>
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
          <p style={{ color: "#aaa", fontSize: 12, margin: "10px 0 0", textAlign: "center" }}>
            {selectedCategories.length} seleccionada{selectedCategories.length !== 1 ? "s" : ""}
          </p>
        </Card>

        <button type="button" onClick={handleSave} disabled={saving || !myName} style={{ width: "100%", padding: 16, borderRadius: 16, background: saving || !myName ? "#aaa" : "linear-gradient(135deg,#4F7FFA,#3a6ae8)", color: "#fff", border: "none", fontSize: 16, fontWeight: 600, cursor: saving || !myName ? "default" : "pointer", fontFamily: "inherit", marginTop: 8 }}>
          {saving ? "Guardando..." : "Comenzar →"}
        </button>
        <div style={{ height: 40 }} />
      </div>

      {/* Currency bottom sheet */}
      {showCurrencySheet && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 200, display: "flex", alignItems: "flex-end" }}
          onClick={() => setShowCurrencySheet(false)} onTouchMove={e => e.preventDefault()}>
          <div style={{ background: "#fff", borderRadius: "24px 24px 0 0", width: "100%", padding: "24px 20px calc(40px + env(safe-area-inset-bottom))", fontFamily: SF_PRO, maxHeight: "70vh", overflowY: "auto" }}
            onClick={e => e.stopPropagation()} onTouchMove={e => e.stopPropagation()}>
            <div style={{ width: 36, height: 4, background: "#e8e8e8", borderRadius: 2, margin: "0 auto 20px" }} />
            <p style={{ fontSize: 17, fontWeight: 700, color: "#1a1a2e", margin: "0 0 16px" }}>Divisa</p>
            {currencyList.map(c => (
              <button type="button" key={c.code} onClick={() => { setSelectedCurrency(c.code); setShowCurrencySheet(false); }}
                style={{ width: "100%", padding: "14px 16px", borderRadius: 14, border: `2px solid ${selectedCurrency === c.code ? "#4F7FFA" : "#e8e8e8"}`, background: selectedCurrency === c.code ? "#4F7FFA11" : "#fafafa", marginBottom: 8, cursor: "pointer", display: "flex", alignItems: "center", gap: 12, fontFamily: SF_PRO }}>
                <span style={{ fontSize: 20, minWidth: 28 }}>{c.symbol}</span>
                <div style={{ textAlign: "left" }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#1a1a2e" }}>{c.code}</p>
                  <p style={{ margin: 0, fontSize: 12, color: "#888" }}>{c.name}</p>
                </div>
                {selectedCurrency === c.code && <span style={{ marginLeft: "auto", color: "#4F7FFA", fontSize: 18 }}>✓</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* F3: Emoji picker bottom sheet — SIN teclado nativo */}
      {showEmojiSheet && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 200, display: "flex", alignItems: "flex-end" }}
          onClick={() => setShowEmojiSheet(false)} onTouchMove={e => e.preventDefault()}>
          <div style={{ background: "#fff", borderRadius: "24px 24px 0 0", width: "100%", padding: "24px 20px calc(40px + env(safe-area-inset-bottom))", fontFamily: SF_PRO }}
            onClick={e => e.stopPropagation()} onTouchMove={e => e.stopPropagation()}>
            <div style={{ width: 36, height: 4, background: "#e8e8e8", borderRadius: 2, margin: "0 auto 20px" }} />
            <p style={{ fontSize: 17, fontWeight: 700, color: "#1a1a2e", margin: "0 0 16px" }}>Elegí un ícono</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {EMOJI_OPTIONS.map(e => (
                <button type="button" key={e} onClick={() => { setSelectedEmoji(e); setShowEmojiSheet(false); }}
                  style={{ width: 52, height: 52, borderRadius: 14, border: "2px solid", fontSize: 26, cursor: "pointer", borderColor: selectedEmoji === e ? "#4F7FFA" : "#e8e8e8", background: selectedEmoji === e ? "#4F7FFA11" : "#fafafa" }}>
                  {e}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* F6: Modal nueva categoría */}
      {showNewCatModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 200, display: "flex", alignItems: "flex-end" }}>
          <div style={{ background: "#fff", borderRadius: "24px 24px 0 0", width: "100%", padding: "24px 20px 44px", fontFamily: SF_PRO, maxHeight: "85vh", overflowY: "auto" }}>
            <div style={{ width: 36, height: 4, background: "#e8e8e8", borderRadius: 2, margin: "0 auto 20px" }} />
            <p style={{ fontSize: 18, fontWeight: 700, color: "#1a1a2e", margin: "0 0 20px" }}>Nueva categoría</p>
            <p style={{ fontSize: 11, fontWeight: 600, color: "#888", marginBottom: 6, letterSpacing: 0.6, textTransform: "uppercase" }}>Nombre</p>
            <input
              value={newCatLabel}
              onChange={e => setNewCatLabel(e.target.value)}
              placeholder="Ej: Mascotas"
              style={{ width: "100%", padding: "13px 14px", borderRadius: 14, border: "2px solid #e8e8e8", fontSize: 15, marginBottom: 16, fontFamily: "inherit", outline: "none", boxSizing: "border-box", color: "#1a1a2e", background: "#fafafa" }}
              autoFocus
            />
            <p style={{ fontSize: 11, fontWeight: 600, color: "#888", marginBottom: 10, letterSpacing: 0.6, textTransform: "uppercase" }}>Icono</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
              {EMOJI_OPTIONS.map(e => (
                <button type="button" key={e} onClick={() => setNewCatIcon(e)}
                  style={{ width: 44, height: 44, borderRadius: 12, border: "2px solid", fontSize: 22, cursor: "pointer", borderColor: newCatIcon === e ? "#4F7FFA" : "#e8e8e8", background: newCatIcon === e ? "#4F7FFA11" : "#fafafa" }}>
                  {e}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => { addCustomCat(); setShowNewCatModal(false); }} disabled={!newCatLabel.trim()}
              style={{ width: "100%", padding: 14, borderRadius: 14, background: newCatLabel.trim() ? "linear-gradient(135deg,#4F7FFA,#3a6ae8)" : "#ccc", color: "#fff", border: "none", fontSize: 15, fontWeight: 600, cursor: newCatLabel.trim() ? "pointer" : "default", fontFamily: "inherit", marginBottom: 8 }}>
              Guardar
            </button>
            <button type="button" onClick={() => { setShowNewCatModal(false); setNewCatLabel(""); }}
              style={{ width: "100%", padding: 14, borderRadius: 14, background: "#f0f0f0", color: "#888", border: "none", fontSize: 15, cursor: "pointer", fontFamily: "inherit" }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

    </div>
  );
}