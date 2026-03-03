import { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";

const CATEGORIES = [
  { id: "super", label: "Supermercado", icon: "🛒" },
  { id: "salidas", label: "Salidas", icon: "🍕" },
  { id: "servicios", label: "Impuestos y Servicios", icon: "💡" },
  { id: "transporte", label: "Transporte", icon: "🚗" },
  { id: "salud", label: "Salud", icon: "💊" },
  { id: "ropa", label: "Ropa y Calzado", icon: "👗" },
  { id: "hogar", label: "Hogar", icon: "🏠" },
  { id: "otros", label: "Otros", icon: "📦" },
];

const PROFILES_FALLBACK = [
  { id: "mati", name: "Mati", emoji: "👨", color: "#4F7FFA" },
  { id: "sofi", name: "Sofi", emoji: "👩", color: "#FA4F7F" },
];

const labelStyle = { fontSize: 11, fontWeight: 700, color: "#888", marginBottom: 6, letterSpacing: 0.6, textTransform: "uppercase" };
const inputStyle = { width: "100%", padding: "13px 14px", borderRadius: 14, border: "2px solid #e8e8e8", fontSize: 15, marginBottom: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box", color: "#1a1a2e", background: "#fafafa" };

export default function EditExpenseModal({ expense, members, onClose }) {
  const profiles = members?.length > 0 ? members : PROFILES_FALLBACK;
  const [form, setForm] = useState({ ...expense });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    const { id, ...data } = form;
    await updateDoc(doc(db, "expenses", id), {
      ...data,
      amount: parseFloat(data.amount),
      paidMati: data.paidMati ? parseFloat(data.paidMati) : null,
      paidSofi: data.paidSofi ? parseFloat(data.paidSofi) : null,
    });
    setSaving(false);
    onClose();
  };

  const types = [["hogar","🏠 Hogar"],["personal","🎁 Para otro"],["extraordinary","⭐ Extra"],["mio","👤 Mío"]];

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 100, display: "flex", alignItems: "flex-end" }}>
      <div style={{ background: "#fff", borderRadius: "24px 24px 0 0", width: "100%", padding: "24px 20px 44px", maxHeight: "88vh", overflowY: "auto" }}>
        <div style={{ width: 36, height: 4, background: "#e0e0e0", borderRadius: 2, margin: "0 auto 20px" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22 }}>Editar Gasto</span>
          <button onClick={onClose} style={{ background: "#f4f4f4", border: "none", borderRadius: 50, width: 32, height: 32, fontSize: 18, cursor: "pointer" }}>×</button>
        </div>

        <p style={labelStyle}>Tipo</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
          {types.map(([val, lbl]) => (
            <button key={val} onClick={() => set("type", val)}
              style={{ padding: "10px 8px", borderRadius: 12, border: "2px solid", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                borderColor: form.type === val ? "#4F7FFA" : "#e8e8e8",
                background: form.type === val ? "#4F7FFA11" : "#fafafa",
                color: form.type === val ? "#4F7FFA" : "#888" }}>
              {lbl}
            </button>
          ))}
        </div>

        <p style={labelStyle}>Concepto</p>
        <input value={form.concept} onChange={e => set("concept", e.target.value)} style={inputStyle} />

        <p style={labelStyle}>Monto (ARS $)</p>
        <input type="number" value={form.amount} onChange={e => set("amount", e.target.value)} style={inputStyle} />

        <p style={labelStyle}>Categoría</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 16 }}>
          {CATEGORIES.map(c => (
            <button key={c.id} onClick={() => set("category", c.id)}
              style={{ padding: "7px 12px", borderRadius: 12, border: "2px solid", fontSize: 12, cursor: "pointer", fontFamily: "inherit",
                borderColor: form.category === c.id ? "#4F7FFA" : "#e8e8e8",
                background: form.category === c.id ? "#4F7FFA11" : "#fafafa",
                color: form.category === c.id ? "#4F7FFA" : "#555" }}>
              {c.icon} {c.label}
            </button>
          ))}
        </div>

        <p style={labelStyle}>Fecha</p>
        <input type="date" value={form.date} onChange={e => set("date", e.target.value)} style={inputStyle} />

        {form.type !== "mio" && (
          <>
            <p style={labelStyle}>Pagó</p>
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              {profiles.map(p => (
                <button key={p.id || p.uid} onClick={() => set("paidBy", p.id || p.uid)}
                  style={{ flex: 1, padding: 12, borderRadius: 14, border: "2px solid", fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                    borderColor: form.paidBy === (p.id || p.uid) ? p.color : "#e8e8e8",
                    background: form.paidBy === (p.id || p.uid) ? p.color + "18" : "#fafafa",
                    color: form.paidBy === (p.id || p.uid) ? p.color : "#888" }}>
                  {p.emoji || "👤"} {p.name}
                </button>
              ))}
            </div>
          </>
        )}

        <button onClick={handleSave} disabled={saving}
          style={{ width: "100%", padding: 16, borderRadius: 16, background: saving ? "#aaa" : "linear-gradient(135deg,#4F7FFA,#3a6ae8)", color: "#fff", border: "none", fontSize: 16, fontWeight: 700, cursor: saving ? "default" : "pointer", fontFamily: "inherit" }}>
          {saving ? "Guardando..." : "Guardar cambios ✓"}
        </button>
      </div>
    </div>
  );
}
