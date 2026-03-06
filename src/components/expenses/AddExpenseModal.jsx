import { useState, useRef } from "react";
import { useTheme } from "../../theme.jsx";
import { DEFAULT_CATEGORIES } from "../../constants/categories.js";
import { CURRENCIES } from "../../theme.jsx";
import { useSwipeSheet } from "../../hooks/useSwipeSheet.js";
import DateInput from "../../DateInput.jsx";

const FONT = `'DM Sans', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif`;

export default function AddExpenseModal({ onClose, onAdd, currentUser, allMembers, currency, customCategories, isPersonal }) {
  const { colors } = useTheme();
  const allCategories = [...DEFAULT_CATEGORIES, ...(customCategories || [])];
  const defaultType = isPersonal ? "mio" : "hogar";
  const memberList = allMembers || [];

  const [form, setForm] = useState({
    type: defaultType, concept: "", amount: "", category: "super",
    date: new Date().toISOString().slice(0, 10),
    paidBy: currentUser.uid, forWhom: memberList.map(m => m.uid), owner: currentUser.uid,
  });
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const currSymbol = CURRENCIES[currency]?.symbol || "$";

  const setType = (t) => {
    setForm(f => ({
      ...f, type: t,
      forWhom: (t === "hogar" || t === "extraordinary") ? memberList.map(m => m.uid) : [],
      owner: t === "mio" ? currentUser.uid : f.owner,
    }));
  };

  const toggleForWhom = (uid) => {
    setForm(f => {
      const cur = f.forWhom || [];
      return { ...f, forWhom: cur.includes(uid) ? cur.filter(u => u !== uid) : [...cur, uid] };
    });
  };

  // Swipe-to-close — sólo desde el handle
  const sheetRef = useRef(null);
  const { dragY, isDragging, handlers: swipeHandlers } = useSwipeSheet({ onClose });

  const onTouchStart = (e) => {
    const handle = sheetRef.current?.querySelector("[data-handle]");
    if (handle && handle.contains(e.target)) swipeHandlers.onTouchStart(e);
  };

  const handleAdd = async () => {
    if (!form.concept || !form.amount) return;
    setLoading(true);
    const amount = parseFloat(form.amount);
    const extra = {};
    if (form.type === "extraordinary" && memberList.length > 0) {
      memberList.forEach(m => { extra[`paid_${m.uid}`] = m.uid === form.paidBy ? amount : 0; });
    }
    await onAdd({ ...form, ...extra, amount, month: form.date.slice(0, 7) });
    setLoading(false);
    onClose();
  };

  const labelStyle = { fontSize: 11, fontWeight: 600, color: colors.textMuted, marginBottom: 6, letterSpacing: 0.6, textTransform: "uppercase", fontFamily: FONT };
  const inputStyle = { width: "100%", padding: "13px 14px", borderRadius: 14, border: `2px solid ${colors.inputBorder}`, fontSize: 15, marginBottom: 14, fontFamily: FONT, outline: "none", boxSizing: "border-box", color: colors.inputText, background: colors.input };

  const types = [["hogar","🏠 Hogar"],["personal","🎁 Para otro"],["extraordinary","✈️ Extraordinario"],["mio","👤 Para mí"]];
  const showPaidBy  = !isPersonal && form.type !== "mio" && memberList.length > 0;
  const showForWhom = !isPersonal && (form.type === "personal" || form.type === "extraordinary" || form.type === "hogar") && memberList.length > 0;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 100, display: "flex", alignItems: "flex-end" }}>
      <div
        ref={sheetRef}
        onTouchStart={onTouchStart}
        onTouchMove={swipeHandlers.onTouchMove}
        onTouchEnd={swipeHandlers.onTouchEnd}
        style={{
          background: colors.card, borderRadius: "24px 24px 0 0", width: "100%",
          padding: "0 20px 44px", maxHeight: "90vh", overflowY: "auto", fontFamily: FONT,
          transform: `translateY(${dragY}px)`,
          transition: isDragging ? "none" : "transform 0.3s ease",
        }}
      >
        <div data-handle style={{ padding: "20px 0 4px", cursor: "grab", touchAction: "none" }}>
          <div style={{ width: 36, height: 4, background: colors.divider, borderRadius: 2, margin: "0 auto" }} />
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, paddingTop: 12 }}>
          <span style={{ fontSize: 20, fontWeight: 700, color: colors.text, fontFamily: FONT }}>Nuevo Gasto</span>
          <button onClick={onClose} style={{ background: colors.pill, border: "none", borderRadius: 50, width: 32, height: 32, fontSize: 18, cursor: "pointer", color: colors.text }}>×</button>
        </div>

        {!isPersonal && (
          <>
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
          </>
        )}

        <p style={labelStyle}>Concepto</p>
        <input value={form.concept} onChange={e => set("concept", e.target.value)} placeholder="Ej: Supermercado" style={inputStyle} />

        <p style={labelStyle}>Monto ({currSymbol})</p>
        <div style={{ position: "relative", marginBottom: 14 }}>
          <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: colors.textMuted, fontWeight: 600, fontSize: 15, fontFamily: FONT }}>{currSymbol}</span>
          <input type="number" value={form.amount} onChange={e => set("amount", e.target.value)} placeholder="0" style={{ ...inputStyle, marginBottom: 0, paddingLeft: 36 }} />
        </div>

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

        <p style={labelStyle}>Fecha</p>
        <DateInput value={form.date} onChange={v => set("date", v)} />

        {showPaidBy && (
          <>
            <p style={labelStyle}>Pagó</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
              {memberList.map(m => (
                <button key={m.uid} onClick={() => set("paidBy", m.uid)}
                  style={{ flex: 1, minWidth: 80, padding: 12, borderRadius: 14, border: "2px solid", fontWeight: 600, cursor: "pointer", fontFamily: FONT,
                    borderColor: form.paidBy === m.uid ? (m.color || "#4F7FFA") : colors.inputBorder,
                    background: form.paidBy === m.uid ? (m.color || "#4F7FFA") + "18" : colors.input,
                    color: form.paidBy === m.uid ? (m.color || "#4F7FFA") : colors.textMuted }}>
                  {m.name}
                </button>
              ))}
            </div>
          </>
        )}

        {showForWhom && (
          <>
            <p style={labelStyle}>Para quién/es</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
              {memberList.map(m => {
                const sel = form.forWhom?.includes(m.uid);
                return (
                  <button key={m.uid} onClick={() => toggleForWhom(m.uid)}
                    style={{ flex: 1, minWidth: 80, padding: 12, borderRadius: 14, border: "2px solid", fontWeight: 600, cursor: "pointer", fontFamily: FONT,
                      borderColor: sel ? (m.color || "#4F7FFA") : colors.inputBorder,
                      background: sel ? (m.color || "#4F7FFA") + "18" : colors.input,
                      color: sel ? (m.color || "#4F7FFA") : colors.textMuted }}>
                    {m.name}
                  </button>
                );
              })}
            </div>
          </>
        )}

        <button
          onClick={handleAdd}
          disabled={loading}
          style={{ width: "100%", padding: 16, borderRadius: 16, background: loading ? "#aaa" : "linear-gradient(135deg,#4F7FFA,#3a6ae8)", color: "#fff", border: "none", fontSize: 16, fontWeight: 600, cursor: loading ? "default" : "pointer", fontFamily: FONT, marginTop: 4 }}>
          {loading ? "Guardando..." : "Agregar ✓"}
        </button>
      </div>
    </div>
  );
}
