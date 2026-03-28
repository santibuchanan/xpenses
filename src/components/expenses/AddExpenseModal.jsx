import { useState, useRef, useEffect } from "react";
import { collection, addDoc } from "firebase/firestore";
import { db } from "../../firebase.js";
import { useTheme } from "../../theme.jsx";
import { CURRENCIES } from "../../theme.jsx";
import { useSwipeSheet } from "../../hooks/useSwipeSheet.js";
import { useAmountInput } from "../../hooks/useAmountInput.js";
import DateInput from "../../DateInput.jsx";

const FONT = `'DM Sans', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif`;

const TYPE_DESCRIPTIONS = [
  { icon: "🛍️", name: "Ordinario", desc: "Un gasto habitual que se divide entre todos los miembros. Por ejemplo: supermercado, servicios, limpieza." },
  { icon: "🫵🏽", name: "Para otro", desc: "Pagaste algo para uno o varios miembros específicos. Elegís para quién fue el gasto." },
  { icon: "🏝️", name: "Extraordinario", desc: "Un gasto especial que no se repite. Podés dividir el pago entre varios y asignar cuánto puso cada uno." },
  { icon: "🙋🏼‍♂️", name: "Para mí", desc: "Un gasto tuyo que no se comparte con nadie. No afecta los saldos del grupo." },
];

function PayerAmountInput({ uid, onValueChange, currSymbol, colors, FONT, width = 80, height = 28 }) {
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
      {!focused && (
        <div style={{
          position: "absolute", inset: 0, display: "flex", alignItems: "center",
          padding: "0 8px", pointerEvents: "none", zIndex: 2, fontFamily: FONT,
        }}>
          <span style={{ fontSize: 11, color: colors.textMuted, marginRight: 1 }}>{currSymbol}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: intPart ? colors.inputText : colors.textMuted }}>
            {intPart || "0"}
          </span>
          {decPart !== undefined && (
            <span style={{ fontSize: 10, color: colors.inputText }}>,{decPart}</span>
          )}
        </div>
      )}
      <input
        type="text" inputMode="decimal"
        value={input.displayValue}
        onChange={input.onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={focused ? "0" : ""}
        style={{
          position: "absolute", inset: 0, width: "100%", height: "100%",
          padding: focused ? "0 8px 0 24px" : "0",
          borderRadius: 8,
          border: `2px solid ${colors.inputBorder}`,
          fontSize: 13, fontFamily: FONT, outline: "none",
          background: colors.input,
          color: focused ? colors.inputText : "transparent",
          caretColor: colors.inputText,
          boxSizing: "border-box",
        }}
      />
    </div>
  );
}

export default function AddExpenseModal({ onClose, onAdd, onSaved, currentUser, allMembers, currency, customCategories, isPersonal, isPozo, accountId }) {
  const { colors } = useTheme();

  // Scroll lock
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  // App.jsx ya pasa activeCategories filtradas (defaults activas + custom).
  // No reconstruir acá — usar directamente lo que llega.
  const allCategories = customCategories || [];

  // Default category: primera disponible
  const defaultCategory = allCategories[0]?.id || "otros";

  // Nueva categoría
  const [showNewCat, setShowNewCat]   = useState(false);
  const [newCatLabel, setNewCatLabel] = useState("");
  const [newCatIcon,  setNewCatIcon]  = useState("📦");
  const [savingCat,   setSavingCat]   = useState(false);
  const CAT_ICONS = ["🛒","🍕","💡","🚗","💊","👗","🏠","📦","🐶","✈️","🏋️","📚","📱","🎮","🍺","☕","🎁","🎵","🏥","🌮","🎬","🏖️","🎓","💻","🧹","🔥","🍔","🍣","🎂","⚽️"];
  const defaultType = isPersonal ? "mio" : "hogar";

  // Normalizar allMembers garantizando que todos tengan .uid
  const baseMemberList = (allMembers || []).map(m => ({
    ...m,
    uid: m.uid || m.id,
    name: m.name || m.displayName || "Sin nombre",
  }));

  // FIX B2/B7: garantizar que el usuario actual SIEMPRE esté en la lista,
  // independientemente del timing del onSnapshot en App.jsx.
  // En cuentas nuevas, members[] puede llegar vacío o sin el creador
  // porque el listener de Firestore aún no resolvió cuando se abre el modal.
  const currentUserInList = baseMemberList.some(m => m.uid === currentUser.uid);
  const memberList = (!isPersonal && !currentUserInList)
    ? [{ uid: currentUser.uid, name: currentUser.displayName || "Vos", color: "#4F7FFA", _isFallback: true }, ...baseMemberList]
    : baseMemberList;

  // default paidBy = usuario que carga el gasto; forWhom = todos los miembros
  const othersUids = memberList.filter(m => m.uid !== currentUser.uid).map(m => m.uid);

  const [form, setForm] = useState({
    type: defaultType, concept: "", amount: "", category: defaultCategory,
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
  const [showTypeHelp, setShowTypeHelp] = useState(false);
  const handleClose = () => {
    const dirty = form.concept.trim() !== "" || (amountInput?.numericValue || 0) > 0;
    if (dirty) setShowDiscard(true); else onClose();
  };

  // Amount input con hook
  const amountInput = useAmountInput("");

  // Swipe-to-close — solo desde el handle
  const sheetRef = useRef(null);
  const amountRef = useRef(null);
  const { dragY, isDragging, handlers: swipeHandlers } = useSwipeSheet({ onClose: handleClose });

  const onTouchStart = (e) => {
    const handle = sheetRef.current?.querySelector("[data-handle]");
    if (handle && handle.contains(e.target)) swipeHandlers.onTouchStart(e);
  };

  const [touched, setTouched] = useState({ concept: false, amount: false });
  const touchField = (f) => setTouched(t => ({ ...t, [f]: true }));

  // Multi-payer state
  const [multiPayer, setMultiPayer] = useState(false);
  const [paidAmounts, setPaidAmounts] = useState({});

  const r2 = (n) => Math.round(n * 100) / 100;

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

  const multiPayerTotal = Math.round(
    Object.values(paidAmounts).reduce((s, v) => s + (parseFloat(v) || 0), 0) * 100
  ) / 100;

  const handleAdd = async () => {
    setTouched({ concept: true, amount: true });
    const amount = amountInput.numericValue || 0;
    if (!form.concept || amount <= 0) return;
    if (multiPayer && Math.abs(multiPayerTotal - amount) >= 0.01) return;
    setLoading(true);
    const paidByValue = multiPayer
      ? Object.entries(paidAmounts)
          .filter(([, v]) => (parseFloat(v) || 0) > 0)
          .map(([uid, v]) => ({ uid, amount: parseFloat(v) }))
      : form.paidBy;
    try {
      await onAdd({ ...form, paidBy: paidByValue, amount, month: form.date.slice(0, 7) });
    } catch(e) {
      console.error("onAdd error", e);
      setLoading(false);
      return;
    }
    // onAdd succeeded — siempre cerrar aunque onClose() lance
    try { onSaved?.(); } catch {}
    try { onClose(); } catch {}
  };

  const labelStyle = { fontSize: 11, fontWeight: 600, color: colors.textMuted, marginBottom: 6, letterSpacing: 0.6, textTransform: "uppercase", fontFamily: FONT };
  const inputStyle = { width: "100%", padding: "13px 14px", borderRadius: 14, border: `2px solid ${colors.inputBorder}`, fontSize: 15, marginBottom: 14, fontFamily: FONT, outline: "none", boxSizing: "border-box", color: colors.inputText, background: colors.input };

  const types = [["hogar","🛍️ Ordinario"],["personal","🫵🏽 Para otro"],["extraordinary","🏝️ Extraordinario"],["mio","🙋🏼‍♂️ Para mí"]];
  const visibleTypes = isPozo ? types.filter(([val]) => val === "hogar" || val === "extraordinary") : types;
  // FIX B2: removida dependencia de memberList.length — las secciones se
  // muestran siempre en cuentas compartidas, incluso si allMembers aún no cargó,
  // porque memberList ya garantiza que el usuario actual está presente.
  // cambio de iconos y nombres para "tipo" de gastos.
  const showPaidBy  = !isPersonal && form.type !== "mio";
  const showForWhom = !isPersonal && (form.type === "personal" || form.type === "extraordinary" || form.type === "hogar");

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
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <p style={{ ...labelStyle, margin: 0 }}>Tipo</p>
              <button type="button" onClick={() => setShowTypeHelp(true)}
                style={{ width: 18, height: 18, borderRadius: 9, background: colors.pill, border: `1px solid ${colors.inputBorder}`, cursor: "pointer", fontSize: 10, fontWeight: 700, color: colors.textMuted, display: "flex", alignItems: "center", justifyContent: "center", padding: 0, fontFamily: FONT }}>?</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
              {visibleTypes.map(([val, lbl]) => (
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
        <input value={form.concept} onChange={e => set("concept", e.target.value)} onFocus={() => touchField("concept")} onKeyDown={e => e.key === "Enter" && amountRef.current?.focus()} placeholder="Ej: Supermercado" style={{ ...inputStyle, borderColor: touched.concept && !form.concept ? "#ff6b6b" : colors.inputBorder }} />

        <p style={labelStyle}>Monto ({currSymbol})</p>
        <div style={{ position: "relative", marginBottom: 14 }}>
          <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: colors.textMuted, fontWeight: 600, fontSize: 15, fontFamily: FONT }}>{currSymbol}</span>
          <input
            ref={amountRef}
            type="text"
            inputMode="decimal"
            value={amountInput.displayValue}
            onChange={amountInput.onChange}
            onFocus={() => { touchField("amount"); amountInput.onFocus?.(); }}
            onBlur={amountInput.onBlur}
            placeholder="0"
            style={{ ...inputStyle, marginBottom: 0, paddingLeft: 36,
              borderColor: touched.amount && amountInput.numericValue <= 0 ? "#ff6b6b" : colors.inputBorder
            }}
          />
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
          <button onClick={() => setShowNewCat(true)}
            style={{ padding: "7px 12px", borderRadius: 12, border: "2px dashed", fontSize: 12, cursor: "pointer", fontFamily: FONT,
              borderColor: "#4F7FFA", background: "transparent", color: "#4F7FFA", fontWeight: 600 }}>
            + Nueva
          </button>
        </div>

        <p style={labelStyle}>Fecha</p>
        <DateInput value={form.date} onChange={v => set("date", v)} />

        {(showPaidBy || showForWhom) && (
          <div style={{ display: "grid", gridTemplateColumns: "4fr 1fr", gap: 10, marginBottom: 14, alignItems: "start" }}>

            {/* ── Pagado por (80%) ── */}
            {showPaidBy && (
              <div>
                <p style={labelStyle}>Pagado por</p>
                {memberList.map(m => {
                  const isPayer = multiPayer ? (m.uid in paidAmounts) : form.paidBy === m.uid;
                  const mc = m.color || "#4F7FFA";
                  return (
                    <div key={m.uid} style={{
                      display: "flex", alignItems: "center", gap: 8, marginBottom: 6,
                      height: 42, padding: "0 10px", borderRadius: 12,
                      border: `2px solid ${isPayer ? mc : colors.inputBorder}`,
                      background: isPayer ? mc + "18" : colors.input,
                    }}>
                      <button type="button" onClick={() => togglePayerSelection(m.uid)}
                        style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0,
                          background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: FONT,
                          textAlign: "left" }}>
                        <span style={{
                          width: 18, height: 18, borderRadius: 9, flexShrink: 0,
                          border: `2px solid ${isPayer ? mc : colors.textMuted}`,
                          background: isPayer ? mc : "transparent",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 10, color: "#fff", fontWeight: 700,
                        }}>
                          {isPayer && "✓"}
                        </span>
                        <span style={{ fontWeight: 600, fontSize: 13, color: isPayer ? mc : colors.text,
                          fontFamily: FONT, flex: 1, minWidth: 0,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          textAlign: "left" }}>
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
                    color: Math.abs(multiPayerTotal - (amountInput.numericValue || 0)) < 0.01 ? "#27ae60" : "#e74c3c",
                  }}>
                    {currSymbol}{multiPayerTotal.toLocaleString("es-AR")} / {currSymbol}{(amountInput.numericValue || 0).toLocaleString("es-AR")}
                  </p>
                )}
              </div>
            )}

            {/* ── Para (20%) — cajas alineadas con Pagado por ── */}
            {showForWhom && (
              <div>
                <p style={{ ...labelStyle, textAlign: "center" }}>Para</p>
                {memberList.map(m => {
                  const sel = form.forWhom?.includes(m.uid);
                  const mc = m.color || "#4F7FFA";
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

        <button
          onClick={handleAdd}
          disabled={loading}
          style={{ width: "100%", padding: 16, borderRadius: 16, background: loading ? "#aaa" : "linear-gradient(135deg,#4F7FFA,#3a6ae8)", color: "#fff", border: "none", fontSize: 16, fontWeight: 600, cursor: loading ? "default" : "pointer", fontFamily: FONT, marginTop: 4 }}>
          {loading ? "Guardando..." : "Agregar"}
        </button>
      </div>

      {/* Modal nueva categoría */}
      {showNewCat && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 200, display: "flex", alignItems: "flex-end" }}>
          <div style={{ background: colors.card, borderRadius: "24px 24px 0 0", width: "100%", padding: "24px 20px 44px", fontFamily: FONT }}>
            <div style={{ width: 36, height: 4, background: colors.divider, borderRadius: 2, margin: "0 auto 20px" }} />
            <p style={{ fontSize: 18, fontWeight: 700, color: colors.text, margin: "0 0 20px", fontFamily: FONT }}>Nueva categoría</p>

            <p style={{ fontSize: 11, fontWeight: 600, color: colors.textMuted, marginBottom: 6, letterSpacing: 0.6, textTransform: "uppercase", fontFamily: FONT }}>Nombre</p>
            <input
              value={newCatLabel}
              onChange={e => setNewCatLabel(e.target.value)}
              placeholder="Ej: Gimnasio"
              style={{ width: "100%", padding: "13px 14px", borderRadius: 14, border: `2px solid ${colors.inputBorder}`, fontSize: 15, marginBottom: 16, fontFamily: FONT, outline: "none", boxSizing: "border-box", color: colors.inputText, background: colors.input }}
            />

            <p style={{ fontSize: 11, fontWeight: 600, color: colors.textMuted, marginBottom: 10, letterSpacing: 0.6, textTransform: "uppercase", fontFamily: FONT }}>Ícono</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
              {CAT_ICONS.map(e => (
                <button key={e} onClick={() => setNewCatIcon(e)} type="button"
                  style={{ width: 44, height: 44, borderRadius: 12, border: "2px solid", fontSize: 22, cursor: "pointer",
                    borderColor: newCatIcon === e ? "#4F7FFA" : colors.inputBorder,
                    background: newCatIcon === e ? "#4F7FFA11" : colors.input }}>
                  {e}
                </button>
              ))}
            </div>

            <button
              type="button"
              disabled={!newCatLabel.trim() || savingCat || !accountId}
              onClick={async () => {
                if (!newCatLabel.trim() || !accountId) return;
                setSavingCat(true);
                try {
                  const ref = await addDoc(collection(db, "accounts", accountId, "categories"), {
                    label: newCatLabel.trim(),
                    icon: newCatIcon,
                  });
                  set("category", ref.id);
                  setShowNewCat(false);
                  setNewCatLabel("");
                  setNewCatIcon("📦");
                } catch(e) { console.error(e); }
                setSavingCat(false);
              }}
              style={{ width: "100%", padding: 14, borderRadius: 14, background: (!newCatLabel.trim() || savingCat) ? "#aaa" : "#4F7FFA", color: "#fff", border: "none", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: FONT, marginBottom: 8 }}>
              {savingCat ? "Guardando..." : "Crear categoría"}
            </button>
            <button type="button" onClick={() => setShowNewCat(false)}
              style={{ width: "100%", padding: 14, borderRadius: 14, background: colors.pill, color: colors.textMuted, border: "none", fontSize: 15, cursor: "pointer", fontFamily: FONT }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

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