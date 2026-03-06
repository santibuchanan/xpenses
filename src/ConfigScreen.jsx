import { useState } from "react";
import { doc, setDoc, addDoc, collection, writeBatch } from "firebase/firestore";
import { db } from "./firebase";

const SF_PRO = `-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', sans-serif`;

const DIVISION_SYSTEMS = [
  { id: "proportional", label: "Proporcional al salario", desc: "Cada uno aporta el mismo % de su sueldo", icon: "📊" },
  { id: "50_50", label: "50/50", desc: "Cada uno paga la mitad exacta", icon: "⚖️" },
  { id: "fixed", label: "Monto fijo por persona", desc: "Cada uno aporta un monto fijo por mes", icon: "🔒" },
  { id: "by_category", label: "Por categoría", desc: "Cada categoría tiene su propia regla", icon: "🗂️" },
];

import { ALL_CATEGORIES, DEFAULT_SELECTED_CATEGORY_IDS, DEFAULT_CATEGORIES } from "./constants/categories.js";
const labelStyle = { fontSize: 11, fontWeight: 600, color: "#888", marginBottom: 6, letterSpacing: 0.6, textTransform: "uppercase" };
const inputStyle = { width: "100%", padding: "13px 14px", borderRadius: 14, border: "2px solid #e8e8e8", fontSize: 15, marginBottom: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box", color: "#1a1a2e", background: "#fafafa" };
function Card({ children, style = {} }) { return <div style={{ background: "#fff", borderRadius: 20, padding: 18, marginBottom: 12, boxShadow: "0 2px 12px rgba(0,0,0,0.05)", ...style }}>{children}</div>; }

export default function ConfigScreen({ user, onDone }) {
  const [accountType, setAccountType] = useState("shared");
  const [divisionSystem, setDivisionSystem] = useState("proportional");
  const [accountName, setAccountName] = useState("Nuestro Hogar");
  const [myName, setMyName] = useState(user.displayName?.split(" ")[0] || "");
  const [salary, setSalary] = useState("");
  const [selectedCategories, setSelectedCategories] = useState(DEFAULT_SELECTED_IDS);
  const [saving, setSaving] = useState(false);

  const toggleCategory = (id) => {
    setSelectedCategories(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
  };

  const handleSave = async () => {
    if (!myName) return;
    setSaving(true);

    try {
      // 1. Generar accountId desde Firestore (no usar user.uid como ID de cuenta)
      const accountRef = doc(collection(db, "accounts"));
      const accountId = accountRef.id;

      // 2. Categorías extra (las que no están en DEFAULT_CATEGORIES)
      const defaultIds = DEFAULT_CATEGORIES.map(c => c.id);
      const extraCats = ALL_CATEGORIES.filter(
        c => selectedCategories.includes(c.id) && !defaultIds.includes(c.id)
      );

      // 3. Batch para account + user (operación atómica — si falla una, no queda estado inconsistente)
      const batch = writeBatch(db);

      batch.set(accountRef, {
        id: accountId,
        name: accountName,
        type: accountType,
        divisionSystem,
        ownerId: user.uid,
        memberIds: [user.uid],
        currency: "ARS",
        createdAt: new Date().toISOString(),
        disabledCategories: DEFAULT_CATEGORIES
          .filter(c => !selectedCategories.includes(c.id))
          .map(c => c.id),
      });

      batch.set(doc(db, "users", user.uid), {
        uid: user.uid,
        name: myName,
        email: user.email,
        photo: user.photoURL || null,
        salary: parseFloat(salary) || 0,
        color: "#4F7FFA",
        accountId,          // cuenta principal (retrocompatibilidad)
        accountIds: [accountId],
        setupDone: true,
      }, { merge: true });

      await batch.commit();

      // 4. Categorías extra — addDoc no entra en writeBatch con subcollections fácilmente,
      //    pero son datos no críticos: si fallan no rompen el estado de cuenta/usuario
      if (extraCats.length > 0) {
        await Promise.all(
          extraCats.map(cat =>
            addDoc(collection(db, "accounts", accountId, "categories"), cat)
          )
        );
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
        <Card>
          <p style={{ fontSize: 17, fontWeight: 600, margin: "0 0 4px", color: "#1a1a2e" }}>¿Qué tipo de cuenta querés?</p>
          <p style={{ color: "#aaa", fontSize: 13, margin: "0 0 16px" }}>Podés cambiarlo después en ajustes</p>
          <div style={{ display: "flex", gap: 10 }}>
            {[["personal","👤","Personal","Solo para vos"],["shared","👥","Compartida","Con tu pareja o compañeros"]].map(([val,icon,lbl,desc]) => (
              <button key={val} onClick={() => setAccountType(val)} style={{ flex: 1, padding: 16, borderRadius: 16, border: "2px solid", cursor: "pointer", fontFamily: "inherit", textAlign: "left", borderColor: accountType === val ? "#4F7FFA" : "#e8e8e8", background: accountType === val ? "#4F7FFA11" : "#fafafa" }}>
                <p style={{ fontSize: 24, margin: "0 0 6px" }}>{icon}</p>
                <p style={{ margin: "0 0 4px", fontWeight: 600, fontSize: 14, color: accountType === val ? "#4F7FFA" : "#1a1a2e" }}>{lbl}</p>
                <p style={{ margin: 0, fontSize: 12, color: "#aaa" }}>{desc}</p>
              </button>
            ))}
          </div>
        </Card>

        <Card>
          <p style={labelStyle}>Nombre de la cuenta</p>
          <input value={accountName} onChange={e => setAccountName(e.target.value)} style={{ ...inputStyle, marginBottom: 0 }} placeholder="Ej: Nuestro Hogar" />
        </Card>

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
          <p style={labelStyle}>Salario mensual (ARS $)</p>
          <input type="number" value={salary} onChange={e => setSalary(e.target.value)} style={{ ...inputStyle, marginBottom: 0 }} placeholder="0" />
        </Card>

        {accountType === "shared" && (
          <Card>
            <p style={{ fontSize: 17, fontWeight: 600, margin: "0 0 4px", color: "#1a1a2e" }}>¿Cómo dividir los gastos?</p>
            <p style={{ color: "#aaa", fontSize: 13, margin: "0 0 16px" }}>Podés cambiarlo después</p>
            {DIVISION_SYSTEMS.map(s => (
              <button key={s.id} onClick={() => setDivisionSystem(s.id)} style={{ width: "100%", padding: "14px 16px", borderRadius: 14, border: "2px solid", cursor: "pointer", fontFamily: "inherit", textAlign: "left", marginBottom: 8, display: "flex", alignItems: "center", gap: 12, borderColor: divisionSystem === s.id ? "#4F7FFA" : "#e8e8e8", background: divisionSystem === s.id ? "#4F7FFA11" : "#fafafa" }}>
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

        <Card>
          <p style={{ fontSize: 17, fontWeight: 600, margin: "0 0 4px", color: "#1a1a2e" }}>¿Qué categorías usás?</p>
          <p style={{ color: "#aaa", fontSize: 13, margin: "0 0 16px" }}>Podés agregar más después en Ajustes.</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {ALL_CATEGORIES.map(c => {
              const selected = selectedCategories.includes(c.id);
              return (
                <button key={c.id} onClick={() => toggleCategory(c.id)} style={{ padding: "9px 14px", borderRadius: 20, border: "2px solid", fontSize: 13, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6, borderColor: selected ? "#4F7FFA" : "#e8e8e8", background: selected ? "#4F7FFA" : "#fafafa", color: selected ? "#fff" : "#555", fontWeight: selected ? 600 : 400 }}>
                  {c.icon} {c.label}
                </button>
              );
            })}
          </div>
          <p style={{ color: "#aaa", fontSize: 12, margin: "12px 0 0", textAlign: "center" }}>
            {selectedCategories.length} seleccionada{selectedCategories.length !== 1 ? "s" : ""}
          </p>
        </Card>

        <button onClick={handleSave} disabled={saving || !myName} style={{ width: "100%", padding: 16, borderRadius: 16, background: saving || !myName ? "#aaa" : "linear-gradient(135deg,#4F7FFA,#3a6ae8)", color: "#fff", border: "none", fontSize: 16, fontWeight: 600, cursor: saving || !myName ? "default" : "pointer", fontFamily: "inherit", marginTop: 8 }}>
          {saving ? "Guardando..." : "Comenzar →"}
        </button>
        <div style={{ height: 40 }} />
      </div>
    </div>
  );
}