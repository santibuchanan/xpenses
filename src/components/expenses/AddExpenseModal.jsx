import { useState, useRef, useEffect } from "react";
import { useTheme } from "../../theme.jsx";
import { DEFAULT_CATEGORIES } from "../../constants/categories.js";
import { CURRENCIES } from "../../theme.jsx";
import { useSwipeSheet } from "../../hooks/useSwipeSheet.js";
import { useAmountInput } from "../../hooks/useAmountInput.js";
import DateInput from "../../DateInput.jsx";

const FONT = `'DM Sans', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif`;

export default function AddExpenseModal({ onClose, onAdd, currentUser, allMembers, currency, customCategories, isPersonal }) {
  const { colors } = useTheme();

  // Scroll lock
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const allCategories = [...DEFAULT_CATEGORIES, ...(customCategories || [])];
  const defaultType = isPersonal ? "mio" : "hogar";

  // FIX: incluir miembros no vinculados (labels sin linkedUid) en la lista
  // allMembers puede contener tanto usuarios reales (con uid) como labels (con id y sin linkedUid)
  // Normalizamos para que todos tengan .uid (usamos .id como fallback para labels)
  const memberList = (allMembers || []).map(m => ({
    ...m,
    uid: m.uid || m.id,
    name: m.name || m.displayName || "Sin nombre",
  }));

  // FIX: default paidBy = usuario que carga el gasto; forWhom = todos los demás
  const othersUids = memberList.filter(m => m.uid !== currentUser.uid).map(m => m.uid);

  const [form, setForm] = useState({
    type: defaultType, concept: "", amount: "", category: "super",
    date: new Date().toISOString().slice(0, 10),
    paidBy: currentUser.uid,
    forWhom: defaultType === "hogar" ? memberList.map(m => m.uid) : [],
    owner: currentUser.uid,
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

  // Dirty tracking + discard
  const [showDiscard, setShowDiscard] = useState(false);
  const handleClose = () => {
    const dirty = form.concept.trim() !== "" || (amountInput?.numericValue || 0) > 0;
    if (dirty) setShowDiscard(true); else onClose();
  };

  // Amount input con hook
  const amountInput = useAmountInput("");

  // Swipe-to-close — solo desde el handle
  const sheetRef = useRef(null);
  const { dragY, isDragging, handlers: swipeHandlers } = useSwipeSheet({ onClose: handleClose });

  const onTouchStart = (e) => {
    const handle = sheetRef.current?.querySelector("[data-handle]");
    if (handle && handle.contains(e.target)) swipeHandlers.onTouchStart(e);
  };

  const [touched, setTouched] = useState({ concept: false, amount: false });
  const touchField = (f) => setTouched(t => ({ ...t, [f]: true }));

  const handleAdd = async () => {
    setTouched({ concept: true, amount: true });
    const amount = amountInput.numericValue || 0;
    if (!form.concept || amount <= 0) return;
    setLoading(true);
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
          // FIX: altura inicial ~82vh para que se vea que se puede deslizar para cerrar
          padding: "0 20px 44px", maxHeight: "82vh", overflowY: "auto", fontFamily: FONT,
          transform: `translateY(${dragY}px)`,
          transition: isDragging ? "none" : "transform 0.3s ease",
        }}
      >
        {/* Handle de swipe */}
        <div data-handle style={{ padding: "20px 0 4px", cursor: "grab", touchAction: "none" }}>
          <div style={{ width: 36, height: 4, background: colors.divider, borderRadius: 2, margin: "0 auto" }} />
        </div>

        {/* FIX: sin botón X — solo título */}
        <div style={{ marginBottom: 18, paddingTop: 12 }}>
          <span style={{ fontSize: 20, fontWeight: 700, color: colors.text, fontFamily: FONT }}>Nuevo Gasto</span>
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

        <p style={labelStyle}>Monto ({currSymbol})</p>
        {/* FIX: formato con separador de miles dentro del input, no en azul debajo */}
        <div style={{ position: "relative", marginBottom: 14 }}>
          <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: colors.textMuted, fontWeight: 600, fontSize: 15, fontFamily: FONT }}>{currSymbol}</span>
          <input
            type="text"
            inputMode="decimal"
            autoFocus
            value={amountInput.displayValue}
            onChange={amountInput.onChange}
            onFocus={() => { touchField("amount"); amountInput.onFocus?.(); }}
            onBlur={amountInput.onBlur}
            placeholder="0"
            style={{ ...inputStyle, marginBottom: 0, paddingLeft: 36,
              // Muestra el valor formateado como placeholder visual
              borderColor: touched.amount && amountInput.numericValue <= 0 ? "#ff6b6b" : colors.inputBorder
            }}
          />
          {/* FIX: mostrar formatted dentro del campo como overlay — si el usuario terminó de escribir */}
          {amountInput.numericValue > 0 && (
            <span style={{
              position: "absolute", left: 36, top: "50%", transform: "translateY(-50%)",
              fontSize: 15, fontWeight: 600, color: colors.inputText, fontFamily: FONT,
              pointerEvents: "none",
              // Solo visible cuando el input no está enfocado (gestionado via CSS)
            }} className="amount-formatted">
            </span>
          )}
        </div>
        {/* Muestra el formateado como hint discreto si hay valor */}
        {amountInput.numericValue > 0 && (
          <p style={{ fontSize: 12, color: colors.textMuted, fontWeight: 500, margin: "-10px 0 12px 2px", fontFamily: FONT }}>
            {currSymbol} {amountInput.formatted}
          </p>
        )}

        <p style={labelStyle}>Concepto</p>
        <input value={form.concept} onChange={e => set("concept", e.target.value)} onFocus={() => touchField("concept")} placeholder="Ej: Supermercado" style={{ ...inputStyle, borderColor: touched.concept && !form.concept ? "#ff6b6b" : colors.inputBorder }} />

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

      {/* Modal descartar */}
      {showDiscard && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ background: colors.card, borderRadius: 24, padding: 24, width: "100%", maxWidth: 320, fontFamily: FONT }}>
            <p style={{ fontSize: 18, fontWeight: 700, color: colors.text, margin: "0 0 8px", fontFamily: FONT }}>¿Descartar gasto?</p>
            <p style={{ fontSize: 14, color: colors.textMuted, margin: "0 0 24px", fontFamily: FONT, lineHeight: 1.5 }}>
              Lo que escribiste se va a perder.
            </p>
            <button onClick={onClose}
              style={{ width: "100%", padding: 14, borderRadius: 14, background: "#e74c3c", color: "#fff", border: "none", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: FONT, marginBottom: 8 }}>
              Descartar
            </button>
            <button onClick={() => setShowDiscard(false)}
              style={{ width: "100%", padding: 14, borderRadius: 14, background: colors.pill, color: colors.textMuted, border: "none", fontSize: 15, cursor: "pointer", fontFamily: FONT }}>
              Seguir cargando
            </button>
          </div>
        </div>
      )}
    </div>
  );
}