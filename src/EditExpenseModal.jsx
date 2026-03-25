import { useState, useRef, useEffect } from "react";
import { useSwipeSheet } from "./hooks/useSwipeSheet.js";
import { useAmountInput } from "./hooks/useAmountInput.js";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import { useTheme, CURRENCIES } from "./theme.jsx";
import DateInput from "./DateInput";
import { DEFAULT_CATEGORIES } from "./constants/categories.js";

const FONT = `'DM Sans', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif`;

const TYPE_DESCRIPTIONS = [
  { icon: "🛍️", name: "Ordinario", desc: "Un gasto habitual que se divide entre todos los miembros. Por ejemplo: supermercado, servicios, limpieza." },
  { icon: "🫵🏽", name: "Para otro", desc: "Pagaste algo para uno o varios miembros específicos. Elegís para quién fue el gasto." },
  { icon: "🏝️", name: "Extraordinario", desc: "Un gasto especial que no se repite. Podés dividir el pago entre varios y asignar cuánto puso cada uno." },
  { icon: "🙋🏼‍♂️", name: "Para mí", desc: "Un gasto tuyo que no se comparte con nadie. No afecta los saldos del grupo." },
];

// Calcula el tipo desde la perspectiva del usuario que mira
function getPerspectiveType(expense, currentUserUid) {
  if (expense.type === "hogar" || expense.type === "extraordinary") return expense.type;
  // Para "mio" y "personal": depende de si el usuario es el destinatario
  const destUids = expense.type === "mio"
    ? (expense.owner ? [expense.owner] : [])
    : (Array.isArray(expense.forWhom) ? expense.forWhom : (expense.forWhom ? [expense.forWhom] : []));
  const iAmDest = destUids.includes(currentUserUid);
  return iAmDest ? "mio" : "personal";
}

export default function EditExpenseModal({ expense, members, allMembers, customCategories, currentUser, isPozo, onClose, onSave }) {
  const { colors } = useTheme();
  const profiles = (allMembers || members || []);
  const currSymbol = CURRENCIES["ARS"]?.symbol || "$";

  // Scroll lock
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);
  const allCategories = customCategories || [];

  const perspectiveType = getPerspectiveType(expense, currentUser?.uid);
  const [form, setForm]   = useState({ ...expense });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Multi-payer state — inicializado desde expense.paidBy si ya es array
  const [multiPayer, setMultiPayer] = useState(() => Array.isArray(expense.paidBy));
  const [paidAmounts, setPaidAmounts] = useState(() => {
    if (Array.isArray(expense.paidBy)) {
      return Object.fromEntries(expense.paidBy.map(p => [p.uid, String(p.amount)]));
    }
    return {};
  });
  const setPaidAmt = (uid, val) => setPaidAmounts(prev => ({ ...prev, [uid]: val }));
  const multiPayerTotal = Math.round(
    Object.values(paidAmounts).reduce((s, v) => s + (parseFloat(v) || 0), 0) * 100
  ) / 100;

  // Amount input con hook
  const amountInput = useAmountInput(expense.amount);
  useEffect(() => { set("amount", amountInput.numericValue || 0); }, [amountInput.numericValue]);

  // Dirty tracking + discard modal
  const [showDiscard, setShowDiscard] = useState(false);
  const [showTypeHelp, setShowTypeHelp] = useState(false);
  const paidByDirty = (() => {
    if (multiPayer !== Array.isArray(expense.paidBy)) return true;
    if (multiPayer && Array.isArray(expense.paidBy)) {
      const origMap = Object.fromEntries(expense.paidBy.map(p => [p.uid, p.amount]));
      return profiles.some(p => Math.abs((parseFloat(paidAmounts[p.uid]) || 0) - (origMap[p.uid] || 0)) >= 0.01);
    }
    return form.paidBy !== expense.paidBy;
  })();
  const isDirty = form.concept !== expense.concept
    || String(form.amount) !== String(expense.amount)
    || form.category !== expense.category
    || form.date !== expense.date
    || form.type !== expense.type
    || paidByDirty;
  const handleClose = () => { if (isDirty) setShowDiscard(true); else onClose(); };

  // Swipe-to-close
  const sheetRef = useRef(null);
  const { dragY, isDragging, handlers: swipeHandlers } = useSwipeSheet({ onClose: handleClose });
  const onTouchStart = (e) => {
    const handle = sheetRef.current?.querySelector("[data-handle]");
    if (handle && handle.contains(e.target)) swipeHandlers.onTouchStart(e);
  };

  // Al cambiar tipo desde la UI (perspectiva), convertir a tipo real
  const setTypeFromPerspective = (perspType) => {
    if (perspType === "hogar" || perspType === "extraordinary") {
      setForm(f => ({ ...f, type: perspType, forWhom: profiles.map(m => m.uid) }));
      return;
    }
    if (perspType === "mio") {
      // "Para mí" desde mi perspectiva → owner = currentUser
      setForm(f => ({ ...f, type: "mio", owner: currentUser?.uid, forWhom: [] }));
    } else {
      // "Para otro" desde mi perspectiva → personal
      setForm(f => ({ ...f, type: "personal", owner: null, forWhom: [] }));
    }
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
    if (form.type !== "mio") {
      if (multiPayer) {
        const hasAnyPayer = Object.values(paidAmounts).some(v => (parseFloat(v) || 0) > 0);
        if (!hasAnyPayer) return false;
        if (Math.abs(multiPayerTotal - parseFloat(form.amount)) >= 0.01) return false;
      } else {
        if (!form.paidBy) return false;
      }
    }
    if (form.type === "personal" && (!form.forWhom || form.forWhom.length === 0)) return false;
    if (form.type === "mio" && !form.owner) return false;
    return true;
  };

  const handleSave = async () => {
    if (!canSave()) return;
    setSaving(true);
    const paidByValue = multiPayer
      ? Object.entries(paidAmounts)
          .filter(([, v]) => (parseFloat(v) || 0) > 0)
          .map(([uid, v]) => ({ uid, amount: parseFloat(v) }))
      : form.paidBy;
    const { id, ...data } = form;
    await updateDoc(doc(db, "expenses", id), {
      ...data,
      paidBy: paidByValue,
      amount: parseFloat(data.amount),
      month: data.date?.slice(0, 7) || data.month,
    });
    setSaving(false);
    if (onSave) await onSave({ ...data, paidBy: paidByValue, amount: parseFloat(data.amount) });
    else onClose();
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

  // Tipo que se muestra en el selector (perspectiva del usuario)
  const displayType = getPerspectiveType(form, currentUser?.uid);

  const types = [
    ["hogar",         "🛍️ Ordinario"],
    ["personal",      "🫵🏽 Para otro"],
    ["extraordinary", "🏝️ Extraordinario"],
    ["mio",           "🙋🏼‍♂️ Para mí"],
  ];
  const visibleTypes = isPozo ? types.filter(([val]) => val === "hogar" || val === "extraordinary") : types;

  const showPaidBy  = form.type !== "mio";
  const showForWhom = (form.type === "personal" || form.type === "hogar" || form.type === "extraordinary");
  // owner se asigna automáticamente, no se muestra selector

  const forWhomArr = Array.isArray(form.forWhom) ? form.forWhom : (form.forWhom ? [form.forWhom] : []);

  // Derivado una sola vez por render — evita llamar canSave() dos veces en el template
  const isSaveable = !saving && canSave();

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 100, display: "flex", alignItems: "flex-end" }}>
      <div ref={sheetRef} onTouchStart={onTouchStart} onTouchMove={swipeHandlers.onTouchMove} onTouchEnd={swipeHandlers.onTouchEnd}
        style={{ background: colors.card, borderRadius: "24px 24px 0 0", width: "100%", padding: "0 20px 44px", maxHeight: "90vh", overflowY: "auto", fontFamily: FONT, transform: `translateY(${dragY}px)`, transition: isDragging ? "none" : "transform 0.3s ease" }}>
        <div data-handle style={{ padding: "20px 0 4px", cursor: "grab", touchAction: "none" }}>
          <div style={{ width: 36, height: 4, background: colors.divider, borderRadius: 2, margin: "0 auto" }} />
        </div>
        <div style={{ marginBottom: 18, paddingTop: 12 }}>
          <span style={{ fontSize: 20, fontWeight: 700, color: colors.text, fontFamily: FONT }}>Editar Gasto</span>
        </div>

        {/* TIPO — muestra perspectiva del usuario */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
          <p style={{ ...labelStyle, marginBottom: 0 }}>Tipo</p>
          <button type="button" onClick={() => setShowTypeHelp(true)}
            style={{ width: 18, height: 18, borderRadius: 9, background: colors.pill, border: `1px solid ${colors.inputBorder}`, cursor: "pointer", fontSize: 10, fontWeight: 700, color: colors.textMuted, display: "flex", alignItems: "center", justifyContent: "center", padding: 0, fontFamily: FONT }}>?</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
          {visibleTypes.map(([val, lbl]) => (
            <button key={val} onClick={() => setTypeFromPerspective(val)}
              style={{ padding: "10px 8px", borderRadius: 12, border: "2px solid", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: FONT,
                borderColor: displayType === val ? "#4F7FFA" : colors.inputBorder,
                background: displayType === val ? "#4F7FFA11" : colors.input,
                color: displayType === val ? "#4F7FFA" : colors.textMuted }}>
              {lbl}
            </button>
          ))}
        </div>

        {/* CONCEPTO */}
        <p style={labelStyle}>Concepto</p>
        <input value={form.concept} onChange={e => set("concept", e.target.value)} style={inputStyle} />

        {/* MONTO */}
        <p style={labelStyle}>Monto ({currSymbol})</p>
        <div style={{ position: "relative", marginBottom: 14 }}>
          <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: colors.textMuted, fontWeight: 600, fontSize: 15, fontFamily: FONT }}>{currSymbol}</span>
          <input type="text" inputMode="decimal" value={amountInput.displayValue}
            onChange={amountInput.onChange}
            onFocus={amountInput.onFocus}
            onBlur={amountInput.onBlur}
            style={{ ...inputStyle, marginBottom: 0, paddingLeft: 36 }} />
        </div>
        {amountInput.formatted && (
          <p style={{ fontSize: 12, color: "#4F7FFA", fontWeight: 600, margin: "-10px 0 12px 2px", fontFamily: FONT }}>
            {amountInput.formatted}
          </p>
        )}

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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <p style={{ ...labelStyle, margin: 0 }}>Pagó</p>
              <button
                onClick={() => setMultiPayer(mp => {
                  if (!mp) setPaidAmounts({ [form.paidBy]: String(form.amount || "") });
                  return !mp;
                })}
                style={{ fontSize: 11, fontWeight: 700, color: "#4F7FFA", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: FONT, letterSpacing: 0.4 }}>
                {multiPayer ? "Un pagador" : "Pago compartido"}
              </button>
            </div>
            {!multiPayer ? (
              <>
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
            ) : (
              <div style={{ marginBottom: 14 }}>
                {profiles.map(p => (
                  <div key={p.uid} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <span style={{ flex: 1, fontWeight: 600, color: colors.text, fontFamily: FONT, fontSize: 14 }}>{p.name}</span>
                    <span style={{ color: colors.textMuted, fontFamily: FONT, fontSize: 15 }}>{currSymbol}</span>
                    <input type="text" inputMode="decimal"
                      value={paidAmounts[p.uid] ?? ""}
                      onChange={e => setPaidAmt(p.uid, e.target.value)}
                      placeholder="0"
                      style={{ width: 90, padding: "8px 10px", borderRadius: 10, border: `2px solid ${colors.inputBorder}`, fontSize: 14, fontFamily: FONT, outline: "none", background: colors.input, color: colors.inputText, boxSizing: "border-box" }} />
                  </div>
                ))}
                <p style={{ fontSize: 12, textAlign: "right", fontFamily: FONT, fontWeight: 600, margin: "2px 0 0",
                  color: Math.abs(multiPayerTotal - parseFloat(form.amount || 0)) < 0.01 ? "#27ae60" : "#e74c3c" }}>
                  Total: {currSymbol}{multiPayerTotal.toLocaleString("es-AR")} / {currSymbol}{parseFloat(form.amount || 0).toLocaleString("es-AR")}
                </p>
              </div>
            )}
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

        <button onClick={handleSave} disabled={!isSaveable}
          style={{ width: "100%", padding: 16, borderRadius: 16,
            background: isSaveable ? "linear-gradient(135deg,#4F7FFA,#3a6ae8)" : "#aaa",
            color: "#fff", border: "none", fontSize: 16, fontWeight: 700,
            cursor: isSaveable ? "pointer" : "default", fontFamily: FONT }}>
          {saving ? "Guardando..." : "Guardar cambios ✓"}
        </button>
      </div>

      {/* Modal descartar cambios */}
      {showDiscard && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ background: colors.card, borderRadius: 24, padding: 24, width: "100%", maxWidth: 320, fontFamily: FONT }}>
            <p style={{ fontSize: 18, fontWeight: 700, color: colors.text, margin: "0 0 8px", fontFamily: FONT }}>¿Descartar cambios?</p>
            <p style={{ fontSize: 14, color: colors.textMuted, margin: "0 0 24px", fontFamily: FONT, lineHeight: 1.5 }}>
              Tenés cambios sin guardar. Si salís, se van a perder.
            </p>
            <button onClick={onClose}
              style={{ width: "100%", padding: 14, borderRadius: 14, background: "#e74c3c", color: "#fff", border: "none", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: FONT, marginBottom: 8 }}>
              Descartar
            </button>
            <button onClick={() => setShowDiscard(false)}
              style={{ width: "100%", padding: 14, borderRadius: 14, background: colors.pill, color: colors.textMuted, border: "none", fontSize: 15, cursor: "pointer", fontFamily: FONT }}>
              Seguir editando
            </button>
          </div>
        </div>
      )}

      {showTypeHelp && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 200, display: "flex", alignItems: "flex-end" }}
          onClick={() => setShowTypeHelp(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: colors.card, borderRadius: "24px 24px 0 0", width: "100%", padding: "20px 20px calc(40px + env(safe-area-inset-bottom))", fontFamily: FONT }}>
            <div style={{ width: 36, height: 4, background: colors.divider, borderRadius: 2, margin: "0 auto 20px" }} />
            <p style={{ fontSize: 17, fontWeight: 700, color: colors.text, margin: "0 0 16px", fontFamily: FONT }}>Tipos de gasto</p>
            {TYPE_DESCRIPTIONS.map(t => (
              <div key={t.name} style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                <span style={{ fontSize: 22, flexShrink: 0 }}>{t.icon}</span>
                <div>
                  <p style={{ margin: "0 0 2px", fontWeight: 700, fontSize: 14, color: colors.text, fontFamily: FONT }}>{t.name}</p>
                  <p style={{ margin: 0, fontSize: 13, color: colors.textMuted, lineHeight: 1.5, fontFamily: FONT }}>{t.desc}</p>
                </div>
              </div>
            ))}
            <button type="button" onClick={() => setShowTypeHelp(false)}
              style={{ width: "100%", padding: 14, borderRadius: 14, background: colors.pill, color: colors.textMuted, border: "none", fontSize: 15, cursor: "pointer", fontFamily: FONT, marginTop: 4 }}>
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}