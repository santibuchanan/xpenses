import { useState, useRef, useEffect } from "react";
import { useSwipeSheet } from "./hooks/useSwipeSheet.js";
import { useAmountInput } from "./hooks/useAmountInput.js";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import { useTheme, CURRENCIES } from "./theme.jsx";
import DateInput from "./DateInput";
import { DEFAULT_CATEGORIES } from "./constants/categories.js";

const FONT = `'DM Sans', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif`;

function PayerAmountInput({ uid, onValueChange, currSymbol, colors, FONT, width = 120, height = 28 }) {
  const input = useAmountInput("");
  const isMounted = useRef(false);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!isMounted.current) { isMounted.current = true; return; }
    onValueChange(uid, input.numericValue);
  }, [input.numericValue]);
  const [intPart = "", decPart] = (input.displayValue || "").split(",");
  return (
    <div style={{ position: "relative", width, height }}>
      <span style={{
        position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)",
        fontSize: 11, color: colors.textMuted, pointerEvents: "none", zIndex: 3, fontFamily: FONT,
      }}>{currSymbol}</span>
      {!focused && (
        <div style={{
          position: "absolute", left: 20, right: 0, top: 0, bottom: 0,
          display: "flex", alignItems: "center", pointerEvents: "none", zIndex: 2, fontFamily: FONT,
        }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: intPart ? colors.inputText : colors.textMuted }}>
            {intPart || "0"}
          </span>
          {decPart !== undefined && <span style={{ fontSize: 10, color: colors.inputText }}>,{decPart}</span>}
        </div>
      )}
      <input type="text" inputMode="decimal"
        value={input.displayValue} onChange={input.onChange}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        placeholder={focused ? "0" : ""}
        style={{
          position: "absolute", inset: 0, width: "100%", height: "100%",
          padding: focused ? "0 8px 0 20px" : "0", borderRadius: 8,
          border: `2px solid ${colors.inputBorder}`, fontSize: 13, fontFamily: FONT,
          outline: "none", background: colors.input,
          color: focused ? colors.inputText : "transparent",
          caretColor: colors.inputText, boxSizing: "border-box",
        }}
      />
    </div>
  );
}

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

  const memberList = profiles.filter(m => !!m.uid && !m._isLabel);

  const togglePayerSelection = (uid) => {
    if (!multiPayer) {
      if (uid === form.paidBy) return;
      setPaidAmounts({ [form.paidBy]: 0, [uid]: 0 });
      setMultiPayer(true);
    } else {
      const current = Object.keys(paidAmounts);
      if (current.includes(uid)) {
        const remaining = current.filter(u => u !== uid);
        if (remaining.length === 1) {
          set("paidBy", remaining[0]);
          setPaidAmounts({});
          setMultiPayer(false);
        } else {
          setPaidAmounts(prev => { const u = { ...prev }; delete u[uid]; return u; });
        }
      } else {
        setPaidAmounts(prev => ({ ...prev, [uid]: 0 }));
      }
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
          .map(([uid, v]) => ({ uid, amount: Math.round(parseFloat(v) * 100) / 100 }))
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

        {/* PAGADO POR + PARA — grid 80/20 */}
        {(showPaidBy || showForWhom) && (
          <div style={{ display: "grid", gridTemplateColumns: "4fr 1fr", gap: 10, marginBottom: 14, alignItems: "start" }}>

            {showPaidBy && (
              <div>
                <p style={labelStyle}>Pagado por</p>
                {memberList.map(m => {
                  const isPayer = multiPayer ? (m.uid in paidAmounts) : form.paidBy === m.uid;
                  const mc = "#4F7FFA";
                  return (
                    <div key={m.uid} style={{
                      display: "flex", alignItems: "center", gap: 8, marginBottom: 6,
                      height: 42, padding: "0 10px", borderRadius: 12,
                      border: `2px solid ${isPayer ? mc : colors.inputBorder}`,
                      background: isPayer ? mc + "18" : colors.input,
                    }}>
                      <button type="button" onClick={() => togglePayerSelection(m.uid)}
                        style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0,
                          background: "none", border: "none", cursor: "pointer", padding: 0,
                          fontFamily: FONT, textAlign: "left" }}>
                        <span style={{
                          width: 18, height: 18, borderRadius: 9, flexShrink: 0,
                          border: `2px solid ${isPayer ? mc : colors.textMuted}`,
                          background: isPayer ? mc : "transparent",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 10, color: "#fff", fontWeight: 700,
                        }}>
                          {isPayer && "✓"}
                        </span>
                        <span style={{
                          fontWeight: 600, fontSize: 13, color: isPayer ? mc : colors.text,
                          fontFamily: FONT, flex: 1, minWidth: 0,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          textAlign: "left",
                        }}>
                          {m.name}
                        </span>
                      </button>
                      {multiPayer && isPayer && (
                        <PayerAmountInput
                          uid={m.uid}
                          onValueChange={(u, amt) => setPaidAmounts(prev => ({ ...prev, [u]: amt }))}
                          currSymbol={currSymbol}
                          colors={colors}
                          FONT={FONT}
                        />
                      )}
                    </div>
                  );
                })}
                {multiPayer && (
                  <p style={{
                    fontSize: 11, textAlign: "right", fontFamily: FONT, fontWeight: 600, margin: "2px 0 0",
                    color: Math.abs(multiPayerTotal - parseFloat(form.amount || 0)) < 0.01 ? "#27ae60" : "#e74c3c",
                  }}>
                    {currSymbol}{multiPayerTotal.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / {currSymbol}{parseFloat(form.amount || 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                )}
              </div>
            )}

            {showForWhom && (
              <div>
                <p style={{ ...labelStyle, textAlign: "center" }}>Para</p>
                {memberList.map(m => {
                  const sel = forWhomArr.includes(m.uid);
                  const mc = "#4F7FFA";
                  return (
                    <button key={m.uid} type="button" onClick={() => toggleForWhom(m.uid)}
                      style={{
                        width: "100%", height: 42, marginBottom: 6,
                        borderRadius: 12, border: `2px solid ${sel ? mc : colors.inputBorder}`,
                        background: sel ? mc + "18" : colors.input,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        cursor: "pointer", padding: 0,
                      }}>
                      <span style={{
                        width: 18, height: 18, borderRadius: 9,
                        border: `2px solid ${sel ? mc : colors.textMuted}`,
                        background: sel ? mc : "transparent",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 10, color: "#fff", fontWeight: 700,
                      }}>
                        {sel && "✓"}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

          </div>
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