import { useState } from "react";
import { collection, addDoc, doc, setDoc } from "firebase/firestore";
import { db } from "./firebase";

const SF = `-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', sans-serif`;

const DIVISION_SYSTEMS = [
  { id: "proportional", label: "Proporcional al salario", icon: "📊" },
  { id: "50_50", label: "50/50", icon: "⚖️" },
  { id: "fixed", label: "Monto fijo", icon: "🔒" },
  { id: "by_category", label: "Por categoría", icon: "🗂️" },
];

export default function AccountSelectorScreen({ user, accounts, onSelect, onCreated }) {
  const [creating, setCreating] = useState(false);
  const [accountName, setAccountName] = useState("");
  const [accountType, setAccountType] = useState("shared");
  const [divisionSystem, setDivisionSystem] = useState("proportional");
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!accountName.trim()) return;
    setSaving(true);
    const ref = await addDoc(collection(db, "accounts"), {
      name: accountName,
      type: accountType,
      divisionSystem,
      ownerId: user.uid,
      memberIds: [user.uid],
      currency: "ARS",
      createdAt: new Date().toISOString(),
    });
    // Link account to user
    await setDoc(doc(db, "users", user.uid), {
      accountIds: [...(accounts.map(a => a.id)), ref.id],
    }, { merge: true });
    setSaving(false);
    onCreated(ref.id);
  };

  const inputStyle = { width: "100%", padding: "13px 14px", borderRadius: 14, border: "2px solid #e8e8e8", fontSize: 15, marginBottom: 14, fontFamily: SF, outline: "none", boxSizing: "border-box", color: "#1a1a2e", background: "#fafafa" };

  return (
    <div style={{ minHeight: "100vh", background: "#f7f8fc", fontFamily: SF }}>
      <style>{`* { box-sizing: border-box; }`}</style>
      <div style={{ background: "linear-gradient(140deg, #1a1a2e, #0f3460)", padding: "52px 20px 32px" }}>
        <p style={{ color: "#ffffff44", fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", margin: "0 0 8px" }}>X-penses</p>
        <p style={{ fontSize: 26, fontWeight: 700, color: "#fff", margin: "0 0 4px" }}>Tus cuentas</p>
        <p style={{ color: "#ffffff66", fontSize: 14, margin: 0 }}>Elegí con cuál querés trabajar</p>
      </div>

      <div style={{ padding: 20 }}>
        {!creating ? (
          <>
            {accounts.length === 0 && (
              <div style={{ textAlign: "center", padding: "40px 20px", color: "#aaa" }}>
                <p style={{ fontSize: 48, margin: "0 0 12px" }}>📂</p>
                <p style={{ fontSize: 16, fontWeight: 600, color: "#555", margin: "0 0 6px" }}>No tenés cuentas todavía</p>
                <p style={{ fontSize: 14, margin: 0 }}>Creá tu primera cuenta para empezar</p>
              </div>
            )}

            {accounts.map(acc => (
              <button key={acc.id} onClick={() => onSelect(acc.id)}
                style={{ width: "100%", background: "#fff", borderRadius: 20, padding: "18px 20px", marginBottom: 12, border: "2px solid #e8e8e8", cursor: "pointer", fontFamily: SF, textAlign: "left", display: "flex", alignItems: "center", gap: 14, boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
                <div style={{ width: 48, height: 48, borderRadius: 16, background: acc.type === "shared" ? "#4F7FFA18" : "#2ecc7118", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>
                  {acc.type === "shared" ? "👥" : "👤"}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: "0 0 4px", fontWeight: 700, fontSize: 16, color: "#1a1a2e" }}>{acc.name}</p>
                  <p style={{ margin: 0, fontSize: 12, color: "#aaa" }}>
                    {acc.type === "shared" ? "Compartida" : "Personal"} · {acc.memberIds?.length || 1} miembro{(acc.memberIds?.length || 1) !== 1 ? "s" : ""}
                  </p>
                </div>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18l6-6-6-6"/>
                </svg>
              </button>
            ))}

            <button onClick={() => setCreating(true)}
              style={{ width: "100%", padding: 16, borderRadius: 16, background: "linear-gradient(135deg,#4F7FFA,#3a6ae8)", color: "#fff", border: "none", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: SF, marginTop: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <span style={{ fontSize: 20 }}>+</span> Nueva cuenta
            </button>
          </>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <button onClick={() => setCreating(false)} style={{ background: "#fff", border: "2px solid #e8e8e8", borderRadius: 12, padding: "8px 14px", fontSize: 13, cursor: "pointer", fontFamily: SF, color: "#555" }}>← Volver</button>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 17, color: "#1a1a2e" }}>Nueva cuenta</p>
            </div>

            <div style={{ background: "#fff", borderRadius: 20, padding: 18, marginBottom: 12, boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: "#888", marginBottom: 6, letterSpacing: 0.6, textTransform: "uppercase" }}>Nombre de la cuenta</p>
              <input value={accountName} onChange={e => setAccountName(e.target.value)} placeholder="Ej: Casa, Vacaciones, Gastos compartidos..." style={{ ...inputStyle, marginBottom: 0 }} autoFocus />
            </div>

            <div style={{ background: "#fff", borderRadius: 20, padding: 18, marginBottom: 12, boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
              <p style={{ fontSize: 17, fontWeight: 600, margin: "0 0 14px", color: "#1a1a2e" }}>Tipo de cuenta</p>
              <div style={{ display: "flex", gap: 10 }}>
                {[["personal","👤","Personal","Solo para vos"],["shared","👥","Compartida","Con otros"]].map(([val,icon,lbl,desc]) => (
                  <button key={val} onClick={() => setAccountType(val)} style={{ flex: 1, padding: 14, borderRadius: 14, border: "2px solid", cursor: "pointer", fontFamily: SF, textAlign: "left", borderColor: accountType === val ? "#4F7FFA" : "#e8e8e8", background: accountType === val ? "#4F7FFA11" : "#fafafa" }}>
                    <p style={{ fontSize: 22, margin: "0 0 4px" }}>{icon}</p>
                    <p style={{ margin: "0 0 2px", fontWeight: 600, fontSize: 13, color: accountType === val ? "#4F7FFA" : "#1a1a2e" }}>{lbl}</p>
                    <p style={{ margin: 0, fontSize: 11, color: "#aaa" }}>{desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {accountType === "shared" && (
              <div style={{ background: "#fff", borderRadius: 20, padding: 18, marginBottom: 12, boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
                <p style={{ fontSize: 17, fontWeight: 600, margin: "0 0 14px", color: "#1a1a2e" }}>División de gastos</p>
                {DIVISION_SYSTEMS.map(s => (
                  <button key={s.id} onClick={() => setDivisionSystem(s.id)} style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "2px solid", cursor: "pointer", fontFamily: SF, textAlign: "left", marginBottom: 8, display: "flex", alignItems: "center", gap: 10, borderColor: divisionSystem === s.id ? "#4F7FFA" : "#e8e8e8", background: divisionSystem === s.id ? "#4F7FFA11" : "#fafafa" }}>
                    <span style={{ fontSize: 20 }}>{s.icon}</span>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: divisionSystem === s.id ? "#4F7FFA" : "#1a1a2e" }}>{s.label}</p>
                    {divisionSystem === s.id && <span style={{ marginLeft: "auto", color: "#4F7FFA" }}>✓</span>}
                  </button>
                ))}
              </div>
            )}

            <button onClick={handleCreate} disabled={saving || !accountName.trim()}
              style={{ width: "100%", padding: 16, borderRadius: 16, background: saving || !accountName.trim() ? "#aaa" : "linear-gradient(135deg,#4F7FFA,#3a6ae8)", color: "#fff", border: "none", fontSize: 16, fontWeight: 600, cursor: saving || !accountName.trim() ? "default" : "pointer", fontFamily: SF, marginTop: 8 }}>
              {saving ? "Creando..." : "Crear cuenta →"}
            </button>
            <div style={{ height: 40 }} />
          </>
        )}
      </div>
    </div>
  );
}