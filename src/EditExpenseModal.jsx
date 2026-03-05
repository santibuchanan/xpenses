import { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import { useTheme } from "./theme.jsx";
import DateInput from "./DateInput";

const FONT = `'DM Sans', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif`;

const DEFAULT_CATEGORIES = [
  { id: "super",      label: "Supermercado",          icon: "🛒" },
  { id: "salidas",    label: "Salidas",                icon: "🍕" },
  { id: "servicios",  label: "Impuestos y Servicios",  icon: "💡" },
  { id: "transporte", label: "Transporte",             icon: "🚗" },
  { id: "salud",      label: "Salud",                  icon: "💊" },
  { id: "ropa",       label: "Ropa y Calzado",         icon: "👗" },
  { id: "hogar",      label: "Hogar",                  icon: "🏠" },
  { id: "otros",      label: "Otros",                  icon: "📦" },
];

export default function EditExpenseModal({ expense, members, customCategories, currentUser, onClose }) {
  const { colors } = useTheme();
  const profiles = members?.filter(m => !m._isLabel) || [];
  const allCategories = [...DEFAULT_CATEGORIES, ...(customCategories || [])];

  const [form, setForm]   = useState({ ...expense });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const setType = (t) => {
    setForm(f => ({
      ...f, type: t,
      forWhom: (t === "hogar" || t === "extraordinary") ? profiles.map(m => m.uid) : f.forWhom || [],
    }));
  };

  const toggleForWhom = (uid) => {
    setForm(f => {
      const cur = Array.isArray(f.forWhom) ? f.forWhom : [];
      return { ...f, forWhom: cur.includes(uid) ? cur.filter(u => u !== uid) : [...cur, uid] };
    });
  };

  // Validación antes de guardar
  const canSave = () => {
    if (!form.concept?.trim() || !form.amount) return false;
    if (form.type !== "mio" && !form.paidBy) return false;
    if (form.type === "personal" && (!form.forWhom || form.forWhom.length === 0)) return false;
    if (form.type === "mio" && !form.owner) return false;
    return true;
  };

  const handleSave = async () => {
    if (!canSave()) return;
    setSaving(true);
    const { id, ...data } = form;
    await updateDoc(doc(db, "expenses", id), {
      ...data,
      amount: parseFloat(data.amount),
      month: data.date?.slice(0, 7) || data.month,
    });
    setSaving(false);
    onClose();
  };

  const inputStyle = {
    width: "100%", padding: "13px 14px", borderRadius: 14,
    border: `2px solid ${colors.inputBorder}`, fontSize: 15, marginBottom: 14,
    fontFamily: FONT, outline: "none", boxSizing: "border-box",
    color: colors.inputText, background: colors.input,
  };
  const labelStyle = {
    fontSize: 11, fontWeight: 700, color: colors.textMuted,
    marginBottom: 6, letterSpacing: 0.6, textTransform: "uppercase", fontFamily: FONT,
  };

  const types = [
    ["hogar", "🏠 Hogar"],
    ["personal", "🎁 Para otro"],
    ["extraordinary", "✈️ Extra"],
    ["mio", "👤 Para mí"],
  ];

  const showPaidBy  = form.type !== "mio" && profiles.length > 0;
  const showForWhom = form.type === "personal" && profiles.length > 0;
  const showOwner   = form.type === "mio" && profiles.length > 0;

  const forWhomArr = Array.isArray(form.forWhom) ? form.forWhom : (form.forWhom ? [form.forWhom] : []);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 100, display: "flex", alignItems: "flex-end" }}>
      <div style={{ background: colors.card, borderRadius: "24px 24px 0 0", width: "100%", padding: "24px 20px 44px", maxHeight: "90vh", overflowY: "auto", fontFamily: FONT }}>
        <div style={{ width: 36, height: 4, background: colors.divider, borderRadius: 2, margin: "0 auto 20px" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <span style={{ fontSize: 20, fontWeight: 700, color: colors.text, fontFamily: FONT }}>Editar Gasto</span>
          <button onClick={onClose} style={{ background: colors.pill, border: "none", borderRadius: 50, width: 32, height: 32, fontSize: 18, cursor: "pointer", color: colors.text }}>×</button>
        </div>

        {/* TIPO */}
        <p style={labelStyle}>Tipo</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
          {types.map(([val, lbl]) => (
            <button key={val} onClick={() => setType(val)}
              style={{ padding: "10px 8px", borderRadius: 12, border: "2px solid", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: FONT,
                borderColor: form.type === val ? "#4F7FFA" : colors.inputBorder,
                background: form.type === val ? "#4F7FFA11" : colors.input,
                color: form.type === val ? "#4F7FFA" : colors.textMuted }}>
              {lbl}
            </button>
          ))}
        </div>

        {/* CONCEPTO */}
        <p style={labelStyle}>Concepto</p>
        <input value={form.concept} onChange={e => set("concept", e.target.value)} style={inputStyle} />

        {/* MONTO */}
        <p style={labelStyle}>Monto</p>
        <input type="number" value={form.amount} onChange={e => set("amount", e.target.value)} style={inputStyle} />

        {/* CATEGORÍA */}
        <p style={labelStyle}>Categoría</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 16 }}>
          {allCategories.map(c => (
            <button key={c.id} onClick={() => set("category", c.id)}
              style={{ padding: "7px 12px", borderRadius: 12, border: "2px solid", fontSize: 12, cursor: "pointer", fontFamily: FONT,
                borderColor: form.category === c.id ? "#4F7FFA" : colors.inputBorder,
                background: form.category === c.id ? "#4F7FFA11" : colors.input,
                color: form.category === c.id ? "#4F7FFA" : colors.text }}>
              {c.icon} {c.label}
            </button>
          ))}
        </div>

        {/* FECHA */}
        <p style={labelStyle}>Fecha</p>
        <DateInput value={form.date} onChange={v => set("date", v)} />

        {/* PAGÓ */}
        {showPaidBy && (
          <>
            <p style={labelStyle}>Pagó</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
              {profiles.map(p => (
                <button key={p.uid} onClick={() => set("paidBy", p.uid)}
                  style={{ flex: 1, minWidth: 80, padding: 12, borderRadius: 14, border: "2px solid", fontWeight: 600, cursor: "pointer", fontFamily: FONT,
                    borderColor: form.paidBy === p.uid ? (p.color || "#4F7FFA") : colors.inputBorder,
                    background: form.paidBy === p.uid ? (p.color || "#4F7FFA") + "18" : colors.input,
                    color: form.paidBy === p.uid ? (p.color || "#4F7FFA") : colors.textMuted }}>
                  {p.name}
                </button>
              ))}
            </div>
            {!form.paidBy && <p style={{ fontSize: 12, color: "#e74c3c", margin: "-10px 0 12px", fontFamily: FONT }}>Seleccioná quién pagó</p>}
          </>
        )}

        {/* PARA QUIÉN (type=personal) */}
        {showForWhom && (
          <>
            <p style={labelStyle}>Para quién/es</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
              {profiles.map(p => {
                const sel = forWhomArr.includes(p.uid);
                return (
                  <button key={p.uid} onClick={() => toggleForWhom(p.uid)}
                    style={{ flex: 1, minWidth: 80, padding: 12, borderRadius: 14, border: "2px solid", fontWeight: 600, cursor: "pointer", fontFamily: FONT,
                      borderColor: sel ? (p.color || "#4F7FFA") : colors.inputBorder,
                      background: sel ? (p.color || "#4F7FFA") + "18" : colors.input,
                      color: sel ? (p.color || "#4F7FFA") : colors.textMuted }}>
                    {p.name}
                  </button>
                );
              })}
            </div>
            {forWhomArr.length === 0 && <p style={{ fontSize: 12, color: "#e74c3c", margin: "-10px 0 12px", fontFamily: FONT }}>Seleccioná al menos un destinatario</p>}
          </>
        )}

        {/* DUEÑO (type=mio) */}
        {showOwner && (
          <>
            <p style={labelStyle}>¿De quién?</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
              {profiles.map(p => (
                <button key={p.uid} onClick={() => set("owner", p.uid)}
                  style={{ flex: 1, minWidth: 80, padding: 12, borderRadius: 14, border: "2px solid", fontWeight: 600, cursor: "pointer", fontFamily: FONT,
                    borderColor: form.owner === p.uid ? (p.color || "#4F7FFA") : colors.inputBorder,
                    background: form.owner === p.uid ? (p.color || "#4F7FFA") + "18" : colors.input,
                    color: form.owner === p.uid ? (p.color || "#4F7FFA") : colors.textMuted }}>
                  {p.name}
                </button>
              ))}
            </div>
          </>
        )}

        <button onClick={handleSave} disabled={saving || !canSave()}
          style={{ width: "100%", padding: 16, borderRadius: 16,
            background: saving || !canSave() ? "#aaa" : "linear-gradient(135deg,#4F7FFA,#3a6ae8)",
            color: "#fff", border: "none", fontSize: 16, fontWeight: 700,
            cursor: saving || !canSave() ? "default" : "pointer", fontFamily: FONT }}>
          {saving ? "Guardando..." : "Guardar cambios ✓"}
        </button>
      </div>
    </div>
  );
}
