import { useState, useRef } from "react";
import { doc, setDoc, updateDoc, collection, addDoc, deleteDoc } from "firebase/firestore";
import { db, deleteUserData, reauthenticateUser } from "./firebase";
import { useTheme, CURRENCIES as CURRENCIES_MAP } from "./theme.jsx";
import { useSwipeSheet } from "./hooks/useSwipeSheet.js";
import DateInput from "./DateInput";
import InviteScreen from "./InviteScreen.jsx";

const FONT = `'DM Sans', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif`;
const CURRENCY_LIST = Object.values(CURRENCIES_MAP);
const CURRENCY_SYMBOLS = Object.fromEntries(CURRENCY_LIST.map(c => [c.code, c.symbol]));
const MEMBER_COLORS = ["#4F7FFA","#FA4F7F","#2ecc71","#f39c12","#9b59b6","#1abc9c","#e74c3c","#3498db"];
import { DEFAULT_CATEGORIES } from "./constants/categories.js";
import { removeMember } from "./hooks/removeMember.js";
const EMOJI_OPTIONS = ["🛒","🍕","💡","🚗","💊","👗","🏠","📦","🐶","✈️","🏋️","📚","📱","🎮","🍺","☕","🎁","💈","🎵","🏥","🌮","🧴","🎬","🏖️","🎓","💻","🛵","🧹","🪴","🐱","⚽️","🔥","🍔","👩🏼‍❤️‍👨🏼","💃🏾","🏝️","🛫","🍣","🎂","🍾","🏂","⛷️"];

function SectionHeader({ title, colors }) {
  return <p style={{ fontSize: 11, fontWeight: 700, color: colors.textMuted, letterSpacing: 1.2, textTransform: "uppercase", margin: "24px 0 8px", fontFamily: FONT }}>{title}</p>;
}

function SettingRow({ icon, label, value, onPress, danger, colors }) {
  return (
    <button onClick={onPress} style={{ width: "100%", background: colors.card, border: "none", borderRadius: 16, padding: "14px 16px", marginBottom: 8, display: "flex", alignItems: "center", gap: 12, cursor: "pointer", fontFamily: FONT, boxShadow: colors.shadow, textAlign: "left" }}>
      <span style={{ fontSize: 20, width: 28 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: danger ? colors.danger : colors.text, fontFamily: FONT }}>{label}</p>
        {value && <p style={{ margin: "2px 0 0", fontSize: 12, color: colors.textMuted, fontFamily: FONT }}>{value}</p>}
      </div>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={colors.textMuted} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
    </button>
  );
}

function ShareAppModal({ onClose, colors }) {
  const appUrl = "https://xpenses.vercel.app";
  const [copied, setCopied] = useState(false);
  const { dragY, isDragging, handlers } = useSwipeSheet({ onClose });
  const handleCopy = () => { navigator.clipboard.writeText(appUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  const handleShare = () => { if (navigator.share) { navigator.share({ title: "X-penses", text: "Usá X-penses para llevar tus gastos compartidos", url: appUrl }); } else { handleCopy(); } };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 200, display: "flex", alignItems: "flex-end" }}>
      <div {...handlers} style={{ background: colors.card, borderRadius: "24px 24px 0 0", width: "100%", padding: "24px 20px 44px", fontFamily: FONT, transform: `translateY(${dragY}px)`, transition: isDragging ? "none" : "transform 0.3s ease" }}>
        <div style={{ width: 36, height: 4, background: colors.divider, borderRadius: 2, margin: "0 auto 20px" }} />
        <p style={{ fontSize: 20, fontWeight: 700, color: colors.text, margin: "0 0 6px", fontFamily: FONT }}>Compartir X-penses</p>
        <p style={{ color: colors.textMuted, fontSize: 14, margin: "0 0 24px", fontFamily: FONT }}>Invitá a otros a usar la app</p>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <img src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(appUrl)}`} style={{ borderRadius: 16, width: 160, height: 160 }} alt="QR" />
        </div>
        <div style={{ background: colors.pill, borderRadius: 12, padding: "12px 14px", marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, color: "#4F7FFA", fontWeight: 600, fontFamily: FONT }}>{appUrl}</span>
          <button onClick={handleCopy} style={{ background: copied ? "#2ecc71" : "#4F7FFA", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, color: "#fff", cursor: "pointer", fontFamily: FONT, fontWeight: 600, flexShrink: 0, marginLeft: 8 }}>{copied ? "✓ Copiado" : "Copiar"}</button>
        </div>
        <button onClick={handleShare} style={{ width: "100%", padding: 14, borderRadius: 14, background: "linear-gradient(135deg,#4F7FFA,#3a6ae8)", color: "#fff", border: "none", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: FONT, marginBottom: 8 }}>📤 Compartir</button>
        <button onClick={onClose} style={{ width: "100%", padding: 14, borderRadius: 14, background: colors.pill, color: colors.textMuted, border: "none", fontSize: 15, cursor: "pointer", fontFamily: FONT }}>Cerrar</button>
      </div>
    </div>
  );
}

function EditCategoryModal({ category, onSave, onClose, onDelete, isDefault, colors }) {
  const [label, setLabel] = useState(category.label);
  const [icon, setIcon]   = useState(category.icon);
  const [showDiscard, setShowDiscard] = useState(false);

  const isDirty = label !== category.label || icon !== category.icon;
  const handleClose = () => { if (isDirty) { setShowDiscard(true); return; } onClose(); };
  const { dragY, isDragging, handlers } = useSwipeSheet({ onClose: handleClose });

  const inputStyle = { width: "100%", padding: "13px 14px", borderRadius: 14, border: `2px solid ${colors.inputBorder}`, fontSize: 15, marginBottom: 16, fontFamily: FONT, outline: "none", boxSizing: "border-box", color: colors.inputText, background: colors.input };
  return (
    <>
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 200, display: "flex", alignItems: "flex-end" }}>
        <div {...handlers} style={{ background: colors.card, borderRadius: "24px 24px 0 0", width: "100%", padding: "24px 20px 44px", fontFamily: FONT, maxHeight: "85vh", overflowY: "auto", transform: `translateY(${dragY}px)`, transition: isDragging ? "none" : "transform 0.3s ease" }}>
          <div style={{ width: 36, height: 4, background: colors.divider, borderRadius: 2, margin: "0 auto 20px" }} />
          <p style={{ fontSize: 18, fontWeight: 700, color: colors.text, margin: "0 0 20px", fontFamily: FONT }}>Editar categoría</p>
          <p style={{ fontSize: 11, fontWeight: 600, color: colors.textMuted, marginBottom: 6, letterSpacing: 0.6, textTransform: "uppercase", fontFamily: FONT }}>Nombre</p>
          <input value={label} onChange={e => setLabel(e.target.value)} style={inputStyle} />
          <p style={{ fontSize: 11, fontWeight: 600, color: colors.textMuted, marginBottom: 10, letterSpacing: 0.6, textTransform: "uppercase", fontFamily: FONT }}>Icono</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
            {EMOJI_OPTIONS.map(e => (
              <button key={e} onClick={() => setIcon(e)} style={{ width: 44, height: 44, borderRadius: 12, border: "2px solid", fontSize: 22, cursor: "pointer", borderColor: icon === e ? "#4F7FFA" : colors.inputBorder, background: icon === e ? "#4F7FFA11" : colors.input }}>{e}</button>
            ))}
          </div>
          <button onClick={() => onSave({ ...category, label, icon })} style={{ width: "100%", padding: 14, borderRadius: 14, background: "linear-gradient(135deg,#4F7FFA,#3a6ae8)", color: "#fff", border: "none", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: FONT, marginBottom: 8 }}>Guardar</button>
          {!isDefault && <button onClick={() => onDelete(category.id)} style={{ width: "100%", padding: 14, borderRadius: 14, background: colors.dangerBg, color: colors.danger, border: "none", fontSize: 15, cursor: "pointer", fontFamily: FONT, marginBottom: 8 }}>Eliminar</button>}
          <button onClick={handleClose} style={{ width: "100%", padding: 14, borderRadius: 14, background: colors.pill, color: colors.textMuted, border: "none", fontSize: 15, cursor: "pointer", fontFamily: FONT }}>Cancelar</button>
        </div>
      </div>
      {showDiscard && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 400, display: "flex", alignItems: "flex-end" }}>
          <div style={{ background: colors.card, borderRadius: "24px 24px 0 0", width: "100%", padding: "28px 20px calc(40px + env(safe-area-inset-bottom))", fontFamily: FONT }}>
            <p style={{ fontSize: 18, fontWeight: 700, color: colors.text, margin: "0 0 8px", fontFamily: FONT }}>¿Descartás los cambios?</p>
            <p style={{ fontSize: 14, color: colors.textMuted, margin: "0 0 24px", fontFamily: FONT }}>Se van a perder los datos que ingresaste.</p>
            <button type="button" onClick={onClose} style={{ width: "100%", padding: 14, borderRadius: 14, background: "#e74c3c", color: "#fff", border: "none", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: FONT, marginBottom: 8 }}>Descartar</button>
            <button type="button" onClick={() => setShowDiscard(false)} style={{ width: "100%", padding: 14, borderRadius: 14, background: colors.pill, color: colors.textMuted, border: "none", fontSize: 15, cursor: "pointer", fontFamily: FONT }}>Seguir editando</button>
          </div>
        </div>
      )}
    </>
  );
}

function FixedExpenseModal({ expense, onSave, onClose, colors, isPersonalAccount }) {
  const [form, setForm] = useState(
    expense || { name: "", amount: "", dueDay: "", shared: true, startDate: new Date().toISOString().slice(0, 10) }
  );
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const [showDiscard, setShowDiscard] = useState(false);

  const initialName = expense?.name || "";
  const initialAmount = String(expense?.amount || "");
  const isDirty = form.name !== initialName || String(form.amount) !== initialAmount;
  const handleClose = () => { if (isDirty) { setShowDiscard(true); return; } onClose(); };
  const { dragY, isDragging, handlers } = useSwipeSheet({ onClose: handleClose });

  const inputStyle = {
    width: "100%", padding: "13px 14px", borderRadius: 14,
    border: `2px solid ${colors.inputBorder}`, fontSize: 15, marginBottom: 14,
    fontFamily: FONT, outline: "none", boxSizing: "border-box",
    color: colors.inputText, background: colors.input,
  };
  const labelStyle = {
    fontSize: 11, fontWeight: 600, color: colors.textMuted,
    marginBottom: 6, letterSpacing: 0.6, textTransform: "uppercase", fontFamily: FONT,
  };

  return (
    <>
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 200, display: "flex", alignItems: "flex-end" }}>
        <div {...handlers} style={{ background: colors.card, borderRadius: "24px 24px 0 0", width: "100%", padding: "24px 20px 44px", fontFamily: FONT, maxHeight: "90vh", overflowY: "auto", transform: `translateY(${dragY}px)`, transition: isDragging ? "none" : "transform 0.3s ease" }}>
          <div style={{ width: 36, height: 4, background: colors.divider, borderRadius: 2, margin: "0 auto 20px" }} />
          <p style={{ fontSize: 18, fontWeight: 700, color: colors.text, margin: "0 0 20px", fontFamily: FONT }}>
            {expense?.id ? "Editar gasto fijo" : "Nuevo gasto fijo"}
          </p>

          <p style={labelStyle}>Nombre</p>
          <input value={form.name} onChange={e => set("name", e.target.value)} placeholder="Ej: Expensas, Netflix, Gym..." style={inputStyle} />

          <p style={labelStyle}>Monto</p>
          <input type="number" inputMode="decimal" value={form.amount} onChange={e => set("amount", e.target.value)} placeholder="0" style={inputStyle} />

          {!isPersonalAccount && (
            <>
              <p style={labelStyle}>Tipo</p>
              <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                {[[true, "🏠 Hogar"], [false, "👤 Personal"]].map(([val, lbl]) => (
                  <button key={String(val)} onClick={() => set("shared", val)}
                    style={{ flex: 1, padding: 12, borderRadius: 12, border: "2px solid", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: FONT,
                      borderColor: form.shared === val ? "#4F7FFA" : colors.inputBorder,
                      background: form.shared === val ? "#4F7FFA11" : colors.input,
                      color: form.shared === val ? "#4F7FFA" : colors.textMuted }}>
                    {lbl}
                  </button>
                ))}
              </div>
            </>
          )}

          <p style={labelStyle}>Fecha de inicio</p>
          <DateInput value={form.startDate || new Date().toISOString().slice(0, 10)} onChange={v => set("startDate", v)} />

          <p style={labelStyle}>Día de vencimiento (opcional)</p>
          <input
            type="number" inputMode="numeric"
            value={form.dueDay}
            onChange={e => set("dueDay", e.target.value)}
            placeholder="Ej: 10  (día del mes)"
            min="1" max="31"
            style={inputStyle}
          />
          {form.dueDay
            ? <p style={{ fontSize: 12, color: colors.textMuted, margin: "-10px 0 14px", fontFamily: FONT }}>Vence el día {form.dueDay} de cada mes</p>
            : null}

          <button
            onClick={() => onSave({ ...form, amount: parseFloat(form.amount) || 0, dueDay: parseInt(form.dueDay) || null })}
            style={{ width: "100%", padding: 14, borderRadius: 14, background: "linear-gradient(135deg,#4F7FFA,#3a6ae8)", color: "#fff", border: "none", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: FONT, marginBottom: 8 }}>
            Guardar
          </button>
          <button onClick={handleClose} style={{ width: "100%", padding: 14, borderRadius: 14, background: colors.pill, color: colors.textMuted, border: "none", fontSize: 15, cursor: "pointer", fontFamily: FONT }}>Cancelar</button>
        </div>
      </div>
      {showDiscard && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 400, display: "flex", alignItems: "flex-end" }}>
          <div style={{ background: colors.card, borderRadius: "24px 24px 0 0", width: "100%", padding: "28px 20px calc(40px + env(safe-area-inset-bottom))", fontFamily: FONT }}>
            <p style={{ fontSize: 18, fontWeight: 700, color: colors.text, margin: "0 0 8px", fontFamily: FONT }}>¿Descartás los cambios?</p>
            <p style={{ fontSize: 14, color: colors.textMuted, margin: "0 0 24px", fontFamily: FONT }}>Se van a perder los datos que ingresaste.</p>
            <button type="button" onClick={onClose} style={{ width: "100%", padding: 14, borderRadius: 14, background: "#e74c3c", color: "#fff", border: "none", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: FONT, marginBottom: 8 }}>Descartar</button>
            <button type="button" onClick={() => setShowDiscard(false)} style={{ width: "100%", padding: 14, borderRadius: 14, background: colors.pill, color: colors.textMuted, border: "none", fontSize: 15, cursor: "pointer", fontFamily: FONT }}>Seguir editando</button>
          </div>
        </div>
      )}
    </>
  );
}

function EditMemberModal({ member, onSave, onClose, onDelete, colors, allMembers = [], isProportional = false }) {
  const [name, setName]   = useState(member.name || "");
  const [color, setColor] = useState(member.color || MEMBER_COLORS[0]);
  const [salary, setSalary] = useState(member.salary?.toString() || "");
  const [showDiscard, setShowDiscard] = useState(false);

  const trimmed = name.trim();
  const isDuplicate = trimmed.length > 0 && allMembers.some(
    m => m.name.toLowerCase() === trimmed.toLowerCase() && m.uid !== member.uid
  );
  const isDirty = name !== (member.name || "") || color !== (member.color || MEMBER_COLORS[0]) || (isProportional && salary !== (member.salary?.toString() || ""));
  const handleClose = () => { if (isDirty) { setShowDiscard(true); return; } onClose(); };
  const { dragY, isDragging, handlers } = useSwipeSheet({ onClose: handleClose });
  const isDraggingFromHandle = useRef(false);

  const inputStyle = { width: "100%", padding: "13px 14px", borderRadius: 14, border: `2px solid ${colors.inputBorder}`, fontSize: 15, marginBottom: 14, fontFamily: FONT, outline: "none", boxSizing: "border-box", color: colors.inputText, background: colors.input };
  return (
    <>
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 200, display: "flex", alignItems: "flex-end" }}>
        <div
          onTouchStart={(e) => { isDraggingFromHandle.current = true; handlers.onTouchStart(e); }}
          onTouchMove={handlers.onTouchMove}
          onTouchEnd={(e) => { if (isDraggingFromHandle.current) handlers.onTouchEnd(e); isDraggingFromHandle.current = false; }}
          style={{ background: colors.card, borderRadius: "24px 24px 0 0", width: "100%", padding: "24px 20px 44px", fontFamily: FONT, transform: `translateY(${dragY}px)`, transition: isDragging ? "none" : "transform 0.3s ease" }}>
          <div style={{ width: 36, height: 4, background: colors.divider, borderRadius: 2, margin: "0 auto 20px" }} />
          <p style={{ fontSize: 18, fontWeight: 700, color: colors.text, margin: "0 0 20px", fontFamily: FONT }}>{member.id ? "Editar miembro" : "Nuevo miembro"}</p>
          <p style={{ fontSize: 11, fontWeight: 600, color: colors.textMuted, marginBottom: 6, letterSpacing: 0.6, textTransform: "uppercase", fontFamily: FONT }}>Nombre</p>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Nombre del integrante" style={inputStyle} />
          {isDuplicate && (
            <p style={{ color: "#ff6b6b", fontSize: 13, margin: "-10px 0 12px", fontFamily: FONT }}>Ya existe un miembro con ese nombre en la cuenta</p>
          )}
          <p style={{ fontSize: 11, fontWeight: 600, color: colors.textMuted, marginBottom: 10, letterSpacing: 0.6, textTransform: "uppercase", fontFamily: FONT }}>Color</p>
          <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
            {MEMBER_COLORS.map(c => (
              <button key={c} onClick={() => setColor(c)} style={{ width: 36, height: 36, borderRadius: 18, background: c, border: color === c ? "3px solid #fff" : "3px solid transparent", cursor: "pointer", boxShadow: color === c ? `0 0 0 2px ${c}` : "none" }} />
            ))}
          </div>
          {isProportional && (
            <>
              <p style={{ fontSize: 11, fontWeight: 600, color: colors.textMuted, marginBottom: 6, letterSpacing: 0.6, textTransform: "uppercase", fontFamily: FONT }}>Salario mensual</p>
              <input type="number" inputMode="decimal" value={salary} onChange={e => setSalary(e.target.value)} placeholder="0" style={inputStyle} />
            </>
          )}
          <button type="button" onClick={() => onSave({ ...member, name: trimmed, color, ...(isProportional && { salary: parseFloat(salary) || 0 }) })} disabled={!trimmed || isDuplicate}
            style={{ width: "100%", padding: 14, borderRadius: 14, background: (!trimmed || isDuplicate) ? "#aaa" : "linear-gradient(135deg,#4F7FFA,#3a6ae8)", color: "#fff", border: "none", fontSize: 15, fontWeight: 600, cursor: (!trimmed || isDuplicate) ? "default" : "pointer", fontFamily: FONT, marginBottom: 8 }}>
            Guardar
          </button>
          {member.id && !member.linkedUid && (
            <button type="button" onClick={() => onDelete(member.id)} style={{ width: "100%", padding: 14, borderRadius: 14, background: colors.dangerBg, color: colors.danger, border: "none", fontSize: 15, cursor: "pointer", fontFamily: FONT, marginBottom: 8 }}>
              Eliminar miembro
            </button>
          )}
          <button type="button" onClick={handleClose} style={{ width: "100%", padding: 14, borderRadius: 14, background: colors.pill, color: colors.textMuted, border: "none", fontSize: 15, cursor: "pointer", fontFamily: FONT }}>Cancelar</button>
        </div>
      </div>
      {showDiscard && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 400, display: "flex", alignItems: "flex-end" }}>
          <div style={{ background: colors.card, borderRadius: "24px 24px 0 0", width: "100%", padding: "28px 20px calc(40px + env(safe-area-inset-bottom))", fontFamily: FONT }}>
            <p style={{ fontSize: 18, fontWeight: 700, color: colors.text, margin: "0 0 8px", fontFamily: FONT }}>¿Descartás los cambios?</p>
            <p style={{ fontSize: 14, color: colors.textMuted, margin: "0 0 24px", fontFamily: FONT }}>Se van a perder los datos que ingresaste.</p>
            <button type="button" onClick={onClose} style={{ width: "100%", padding: 14, borderRadius: 14, background: "#e74c3c", color: "#fff", border: "none", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: FONT, marginBottom: 8 }}>Descartar</button>
            <button type="button" onClick={() => setShowDiscard(false)} style={{ width: "100%", padding: 14, borderRadius: 14, background: colors.pill, color: colors.textMuted, border: "none", fontSize: 15, cursor: "pointer", fontFamily: FONT }}>Seguir editando</button>
          </div>
        </div>
      )}
    </>
  );
}

function SwipeableFixedRow({ f, colors, cardStyle, onEdit, onDelete }) {
  const [swipeX,   setSwipeX]   = useState(0);
  const [swiped,   setSwiped]   = useState(false);
  const startX                  = useRef(null);
  const isDragging              = useRef(false);
  const DELETE_THRESHOLD        = 80;

  const onTouchStart = (e) => { startX.current = e.touches[0].clientX; isDragging.current = true; };
  const onTouchMove  = (e) => {
    if (!isDragging.current || startX.current === null) return;
    const diff = startX.current - e.touches[0].clientX;
    if (diff > 0) setSwipeX(Math.min(diff, DELETE_THRESHOLD + 20));
    else if (diff < -10) { setSwipeX(0); setSwiped(false); }
  };
  const onTouchEnd = () => {
    isDragging.current = false;
    if (swipeX > DELETE_THRESHOLD / 2) { setSwipeX(DELETE_THRESHOLD); setSwiped(true); }
    else { setSwipeX(0); setSwiped(false); }
    startX.current = null;
  };

  return (
    <div style={{ position: "relative", marginBottom: 8, borderRadius: 16, overflow: "hidden" }}>
      <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: DELETE_THRESHOLD, background: "#e74c3c", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "0 16px 16px 0" }}>
        <button onClick={(e) => { e.stopPropagation(); onDelete(f.id); }}
          style={{ background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: 0 }}>
          <span style={{ fontSize: 20 }}>🗑️</span>
          <span style={{ fontSize: 10, color: "#fff", fontWeight: 700, fontFamily: FONT }}>Eliminar</span>
        </button>
      </div>
      <div
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
        onClick={() => { if (swiped) { setSwipeX(0); setSwiped(false); } else { onEdit(f); } }}
        style={{ transform: `translateX(-${swipeX}px)`, transition: isDragging.current ? "none" : "transform 0.3s ease", ...cardStyle, display: "flex", alignItems: "center", gap: 12, cursor: "pointer", position: "relative", zIndex: 1, marginBottom: 0 }}>
        <div style={{ width: 40, height: 40, borderRadius: 14, background: f.shared ? "#4F7FFA14" : "#FA4F7F14", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
          {f.shared ? "🏠" : "👤"}
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: colors.text, fontFamily: FONT }}>{f.name}</p>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: colors.textMuted, fontFamily: FONT }}>
            ${(f.amount || 0).toLocaleString("es-AR")}{f.dueDay ? ` · Vence día ${f.dueDay}` : ""}
          </p>
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={colors.textMuted} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
      </div>
    </div>
  );
}

function SwipeableMemberRow({ member, isCurrentUser, onEdit, onRemoveRequest, colors, showSalary }) {
  const [swipeX,     setSwipeX]   = useState(0);
  const [isSettling, setIsSettling] = useState(false);
  const startX                    = useRef(null);
  const isDragging                = useRef(false);
  const DELETE_THRESHOLD          = 80;

  const onTouchStart = (e) => { startX.current = e.touches[0].clientX; isDragging.current = false; setIsSettling(false); };
  const onTouchMove  = (e) => {
    if (startX.current === null) return;
    const diff = startX.current - e.touches[0].clientX;
    if (Math.abs(diff) > 6) isDragging.current = true;
    if (diff > 0) setSwipeX(Math.min(diff, DELETE_THRESHOLD + 20));
    else if (diff < -10) { setSwipeX(0); }
  };
  const onTouchEnd = () => {
    setIsSettling(true);
    if (swipeX >= DELETE_THRESHOLD) onRemoveRequest(member);
    setSwipeX(0);
    startX.current = null;
  };

  return (
    <div style={{ position: "relative", marginBottom: 8, borderRadius: 16, overflow: "hidden" }}>
      {!isCurrentUser && (
        <div style={{
          position: "absolute", right: 0, top: 0, bottom: 0, width: DELETE_THRESHOLD,
          background: `rgba(229,62,62,${0.15 + Math.min(1, swipeX / DELETE_THRESHOLD) * 0.85})`, display: "flex", alignItems: "center", justifyContent: "center",
          borderRadius: "0 16px 16px 0",
        }}>
          <button onClick={(e) => { e.stopPropagation(); onRemoveRequest(member); }}
            style={{ background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14H6L5 6"/>
                <path d="M10 11v6M14 11v6"/>
                <path d="M9 6V4h6v2"/>
              </svg>
            <span style={{ fontSize: 10, color: "#fff", fontWeight: 700, fontFamily: FONT }}>Eliminar</span>
          </button>
        </div>
      )}

      <div
        onTouchStart={!isCurrentUser ? onTouchStart : undefined}
        onTouchMove={!isCurrentUser ? onTouchMove : undefined}
        onTouchEnd={!isCurrentUser ? onTouchEnd : undefined}
        onClick={() => { if (isDragging.current) return; if (onEdit) onEdit(member); }}
        style={{
          transform: `translateX(-${swipeX}px)`,
          transition: isSettling ? "transform 0.3s ease" : "none",
          background: colors.card, borderRadius: 16, padding: "14px 16px",
          border: `1px solid ${colors.cardBorder}`, boxShadow: colors.shadow,
          display: "flex", alignItems: "center", gap: 12,
          cursor: "pointer", position: "relative", zIndex: 1,
        }}>
        {member.photo
          ? <img src={member.photo} style={{ width: 40, height: 40, borderRadius: 20 }} alt="" />
          : <div style={{ width: 40, height: 40, borderRadius: 20, background: (member.color || "#4F7FFA") + "33", border: `2px solid ${member.color || "#4F7FFA"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: member.color || "#4F7FFA", fontFamily: FONT }}>{member.name?.[0]?.toUpperCase()}</span>
            </div>}
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: colors.text, fontFamily: FONT }}>
            {member.name}
            {isCurrentUser && <span style={{ fontSize: 11, color: colors.textMuted }}> (vos)</span>}
          </p>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: colors.textMuted, fontFamily: FONT }}>
            {(showSalary && member.salary) ? `$${(member.salary || 0).toLocaleString('es-AR')}/mes · ` : ""}
            {member.uid ? "Vinculado ✓" : (member.linkedUid ? "Vinculado ✓" : "Sin vincular")}
          </p>
        </div>
      </div>
    </div>
  );
}

function DeleteAccountModal({ onClose, colors, currentUser }) {
  const [step, setStep] = useState(1);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { dragY, isDragging, handlers } = useSwipeSheet({ onClose });

  const isGoogle = currentUser?.providerData[0]?.providerId === "google.com";

  const doDelete = async () => {
    await deleteUserData(currentUser.uid);
    await currentUser.delete();
    localStorage.removeItem("pendingInviteId");
    window.location.replace(window.location.origin);
  };

  const handleDelete = async () => {
    setError("");
    setLoading(true);
    try {
      await doDelete();
    } catch (e) {
      if (e.code === "auth/requires-recent-login") {
        setStep(2);
        setLoading(false);
      } else {
        setError("No se pudo eliminar la cuenta. Intentá de nuevo.");
        setLoading(false);
      }
    }
  };

  const handleReauth = async () => {
    setError("");
    setLoading(true);
    try {
      await reauthenticateUser(currentUser, password);
    } catch {
      setError(isGoogle ? "No se pudo verificar con Google. Intentá de nuevo." : "Contraseña incorrecta.");
      setLoading(false);
      return;
    }
    try {
      await doDelete();
    } catch (e) {
      setError("No se pudo eliminar la cuenta. Intentá de nuevo.");
      setLoading(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 300, display: "flex", alignItems: "flex-end" }}>
      <div {...handlers} style={{ background: colors.card, borderRadius: "24px 24px 0 0", width: "100%", padding: "24px 20px calc(44px + env(safe-area-inset-bottom))", fontFamily: FONT, transform: `translateY(${dragY}px)`, transition: isDragging ? "none" : "transform 0.3s ease" }}>
        <div style={{ width: 36, height: 4, background: colors.divider, borderRadius: 2, margin: "0 auto 20px" }} />

        {step === 1 && (
          <>
            <p style={{ fontSize: 20, fontWeight: 700, color: colors.text, margin: "0 0 12px", fontFamily: FONT }}>Eliminar tu cuenta</p>
            <p style={{ fontSize: 14, color: colors.textMuted, margin: "0 0 28px", lineHeight: 1.55, fontFamily: FONT }}>
              Esta acción es irreversible. Se eliminarán todos tus datos: perfil, notificaciones y acceso a tus cuentas compartidas. Los gastos cargados por vos van a quedar registrados.
            </p>
            {error && <p style={{ fontSize: 13, color: colors.danger, margin: "0 0 12px", fontFamily: FONT }}>{error}</p>}
            <button type="button" onClick={onClose} style={{ width: "100%", padding: 14, borderRadius: 14, background: colors.pill, color: colors.textMuted, border: "none", fontSize: 15, cursor: "pointer", fontFamily: FONT, marginBottom: 10 }}>Cancelar</button>
            <button type="button" onClick={handleDelete} disabled={loading} style={{ width: "100%", padding: 14, borderRadius: 14, background: colors.danger, color: "#fff", border: "none", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: FONT, opacity: loading ? 0.6 : 1 }}>
              {loading ? "Eliminando..." : "Sí, eliminar"}
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <p style={{ fontSize: 20, fontWeight: 700, color: colors.text, margin: "0 0 12px", fontFamily: FONT }}>Confirmá tu identidad</p>
            <p style={{ fontSize: 14, color: colors.textMuted, margin: "0 0 20px", lineHeight: 1.55, fontFamily: FONT }}>
              Por seguridad, necesitamos verificar que sos vos antes de eliminar la cuenta.
            </p>
            {!isGoogle && (
              <input
                type="password"
                value={password}
                onChange={e => { setPassword(e.target.value); setError(""); }}
                placeholder="Tu contraseña"
                style={{ width: "100%", padding: "13px 14px", borderRadius: 14, border: `2px solid ${error ? colors.danger : colors.inputBorder}`, fontSize: 15, marginBottom: 8, fontFamily: FONT, outline: "none", boxSizing: "border-box", color: colors.inputText, background: colors.input }}
              />
            )}
            {error && <p style={{ fontSize: 13, color: colors.danger, margin: "0 0 12px", fontFamily: FONT }}>{error}</p>}
            <button type="button" onClick={onClose} style={{ width: "100%", padding: 14, borderRadius: 14, background: colors.pill, color: colors.textMuted, border: "none", fontSize: 15, cursor: "pointer", fontFamily: FONT, marginBottom: 10 }}>Cancelar</button>
            <button
              type="button"
              onClick={handleReauth}
              disabled={loading || (!isGoogle && !password)}
              style={{ width: "100%", padding: 14, borderRadius: 14, background: colors.danger, color: "#fff", border: "none", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: FONT, opacity: (loading || (!isGoogle && !password)) ? 0.6 : 1 }}
            >
              {loading ? "Verificando..." : isGoogle ? "Verificar con Google" : "Verificar"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function SettingsScreen({ currentUser, userProfile, account, members, allMembers, customCategories, fixedExpenses, onSignOut, onSwitchAccount }) {
  const { colors } = useTheme();
  const isPersonal = account?.type === "personal";

  const [showShareApp,      setShowShareApp]      = useState(false);
  const [showCurrencySheet, setShowCurrencySheet] = useState(false);
  const [editingCategory,   setEditingCategory]   = useState(null);
  const [editingFixed,  setEditingFixed]  = useState(null);
  const [showNewFixed,  setShowNewFixed]  = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [myName,            setMyName]            = useState(userProfile?.name || "");
  const [mySalary,          setMySalary]          = useState(userProfile?.salary?.toString() || "");
  const [selectedCurrency,  setSelectedCurrency]  = useState(account?.currency || "ARS");
  const [editingProfile,    setEditingProfile]    = useState(false);
  const [showInvite,        setShowInvite]        = useState(false);
  const [editingMember,     setEditingMember]     = useState(null);
  const [removingMember,    setRemovingMember]    = useState(null);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [removeLoading,     setRemoveLoading]     = useState(false);
  const [showBudgetEditor,  setShowBudgetEditor]  = useState(false);
  const [budgetTotal,       setBudgetTotal]       = useState((account?.categoryBudgets?._total || "").toString());
  const [budgetByCategory,  setBudgetByCategory]  = useState(() => {
    const b = account?.categoryBudgets || {};
    const out = {};
    DEFAULT_CATEGORIES.forEach(c => {
      const v = b[c.id];
      out[c.id] = v ? parseInt(v, 10).toLocaleString("es-AR") : "";
    });
    return out;
  });
  const [savingBudget, setSavingBudget] = useState(false);

  const budgetSwipe   = useSwipeSheet({ onClose: () => setShowBudgetEditor(false) });
  const currencySwipe = useSwipeSheet({ onClose: () => setShowCurrencySheet(false) });
  const removeSwipe   = useSwipeSheet({ onClose: () => setRemovingMember(null) });

  const cardStyle = { background: colors.card, borderRadius: 16, padding: "14px 16px", marginBottom: 8, boxShadow: colors.shadow, border: `1px solid ${colors.cardBorder}` };
  const inputStyle = { width: "100%", padding: "11px 13px", borderRadius: 12, border: `2px solid ${colors.inputBorder}`, fontSize: 15, marginBottom: 12, fontFamily: FONT, outline: "none", boxSizing: "border-box", color: colors.inputText, background: colors.input };

  // FIX: mostrar solo las categorías activas de la cuenta
  // Las categorías de la cuenta son: DEFAULT_CATEGORIES no desactivadas + customCategories
  const disabledCategoryIds = account?.disabledCategories || [];
  const activeDefaultCategories = DEFAULT_CATEGORIES.filter(c => !disabledCategoryIds.includes(c.id));
  const allCategories = [
    ...activeDefaultCategories.map(c => ({ ...c, isDefault: true })),
    ...customCategories,
  ];

  const saveProfile = async () => {
    setSavingProfile(true);
    await setDoc(doc(db, "users", currentUser.uid), { name: myName, salary: parseFloat(mySalary) || 0 }, { merge: true });
    setSavingProfile(false);
    setEditingProfile(false);
  };

  const saveCurrency = async (cur) => {
    setSelectedCurrency(cur);
    if (account?.id) await updateDoc(doc(db, "accounts", account.id), { currency: cur });
  };

  const saveBudgets = async () => {
    setSavingBudget(true);
    const budgets = { _total: parseFloat(budgetTotal) || 0 };
    Object.entries(budgetByCategory).forEach(([id, val]) => {
      const n = parseFloat((val || "").replace(/\./g, "")) || 0;
      if (n > 0) budgets[id] = n;
    });
    await updateDoc(doc(db, "accounts", account.id), { categoryBudgets: budgets });
    setSavingBudget(false);
    setShowBudgetEditor(false);
  };

  const handleSaveCategory = async (updated) => {
    if (updated.isDefault) {
      await setDoc(doc(db, "accounts", account.id, "categoryOverrides", updated.id), { label: updated.label, icon: updated.icon });
    } else {
      await setDoc(doc(db, "accounts", account.id, "categories", updated.id), { label: updated.label, icon: updated.icon }, { merge: true });
    }
    setEditingCategory(null);
  };

  const handleDeleteCategory = async (id) => {
    await deleteDoc(doc(db, "accounts", account.id, "categories", id));
    setEditingCategory(null);
  };

  const handleSaveFixed = async (data) => {
    const toSave = {
      ...data,
      shared: isPersonal ? false : data.shared,
      createdBy: currentUser.uid,
    };
    if (toSave.id) {
      const { id, ...rest } = toSave;
      await setDoc(doc(db, "accounts", account.id, "fixedExpenses", id), rest, { merge: true });
    } else {
      await addDoc(collection(db, "accounts", account.id, "fixedExpenses"), {
        ...toSave, createdAt: new Date().toISOString(),
      });
    }
    setEditingFixed(null);
    setShowNewFixed(false);
  };

  const handleDeleteFixed = async (id) => {
    await deleteDoc(doc(db, "accounts", account.id, "fixedExpenses", id));
  };

  const generateInvite = () => { setShowInvite(true); };

  const handleSaveMember = async (updated) => {
    const currentLabels = account?.memberLabels || [];
    let newLabels;
    // Buscar por id (label sin vincular) o por linkedUid (usuario vinculado)
    const existingByLabelId = updated.id && currentLabels.find(l => l.id === updated.id);
    const existingByUid = updated.uid && currentLabels.find(l => l.linkedUid === updated.uid);
    if (existingByLabelId) {
      newLabels = currentLabels.map(l => l.id === updated.id ? { ...l, name: updated.name, color: updated.color, ...(updated.salary !== undefined && { salary: updated.salary }) } : l);
    } else if (existingByUid) {
      newLabels = currentLabels.map(l => l.linkedUid === updated.uid ? { ...l, name: updated.name, color: updated.color } : l);
    } else {
      const newId = `label_${Date.now()}`;
      const color = MEMBER_COLORS[currentLabels.length % MEMBER_COLORS.length];
      newLabels = [...currentLabels, { id: newId, name: updated.name, color: updated.color || color, linkedUid: null, ...(updated.salary !== undefined && { salary: updated.salary }) }];
    }
    await updateDoc(doc(db, "accounts", account.id), { memberLabels: newLabels });
    // Si es usuario vinculado, también actualizar su perfil en Firestore users
    if (existingByUid && updated.uid === currentUser.uid) {
      await setDoc(doc(db, "users", currentUser.uid), { name: updated.name, ...(updated.salary !== undefined && { salary: updated.salary }) }, { merge: true });
    } else if (existingByUid && updated.salary !== undefined) {
      // No se puede escribir en users/{uid} ajeno — guardar en memberLabels del account
      const labelsWithSalary = (account?.memberLabels || []).map(l =>
        l.linkedUid === updated.uid
          ? { ...l, salary: updated.salary }
          : l
      );
      await updateDoc(doc(db, "accounts", account.id), { memberLabels: labelsWithSalary });
    }
    setEditingMember(null);
  };

  const handleDeleteMember = async (labelId) => {
    const currentLabels = account?.memberLabels || [];
    const newLabels = currentLabels.filter(l => l.id !== labelId);
    await updateDoc(doc(db, "accounts", account.id), { memberLabels: newLabels });
    setEditingMember(null);
  };

  const handleRemoveMember = async (memberToRemove) => {
    setRemoveLoading(true);
    try {
      const memberUid = memberToRemove.linkedUid || memberToRemove.uid || memberToRemove.id;
      const currentMonth = new Date().toISOString().slice(0, 7);
      const result = await removeMember({
        accountId:    account.id,
        memberUid,
        ownerUid:     account.ownerId,
        currentMonth,
      });
      if (!result.success) {
        console.error("removeMember error:", result.error);
      }
    } catch (e) {
      console.error("Error removing member:", e);
    }
    setRemoveLoading(false);
    setRemovingMember(null);
    setEditingMember(null);
  };

  const memberLabels = account?.memberLabels || [];
  // Solo mostrar labels NO vinculados en la lista de miembros
  // (los vinculados ya aparecen como usuarios reales en members.map)
  const unlinkedLabels = memberLabels.filter(l => !l.linkedUid);

  const visibleFixed = fixedExpenses.filter(f =>
    f.shared || f.createdBy === currentUser.uid
  );
  const sharedFixed   = visibleFixed.filter(f => f.shared);
  const personalFixed = visibleFixed.filter(f => !f.shared);

  return (
    <div style={{ padding: "16px 20px", paddingTop: "calc(env(safe-area-inset-top) + 76px)", fontFamily: FONT, background: colors.bg, minHeight: "100vh" }}>

      {/* MI PERFIL */}
      <SectionHeader title="Mi Perfil" colors={colors} />
      <div style={cardStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: editingProfile ? 16 : 0 }}>
          {currentUser.photoURL
            ? <img src={currentUser.photoURL} style={{ width: 52, height: 52, borderRadius: 26 }} alt="" />
            : <div style={{ width: 52, height: 52, borderRadius: 26, background: "#4F7FFA22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>👤</div>}
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 16, color: colors.text, fontFamily: FONT }}>{userProfile?.name || currentUser.displayName}</p>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: colors.textMuted, fontFamily: FONT }}>{currentUser.email}</p>
          </div>
          <button onClick={() => setEditingProfile(!editingProfile)} style={{ background: "#4F7FFA11", border: "none", borderRadius: 10, padding: "6px 12px", fontSize: 12, color: "#4F7FFA", cursor: "pointer", fontFamily: FONT, fontWeight: 600 }}>
            {editingProfile ? "Cancelar" : "Editar"}
          </button>
        </div>
        {editingProfile && (
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: colors.textMuted, marginBottom: 6, letterSpacing: 0.6, textTransform: "uppercase", fontFamily: FONT }}>Nombre</p>
            <input value={myName} onChange={e => setMyName(e.target.value)} style={inputStyle} />
            {!isPersonal && (
              <>
                <p style={{ fontSize: 11, fontWeight: 600, color: colors.textMuted, marginBottom: 6, letterSpacing: 0.6, textTransform: "uppercase", fontFamily: FONT }}>Salario mensual</p>
                <input type="number" value={mySalary} onChange={e => setMySalary(e.target.value)} style={inputStyle} />
              </>
            )}
            <button onClick={saveProfile} disabled={savingProfile} style={{ width: "100%", padding: 12, borderRadius: 12, background: savingProfile ? "#aaa" : "#4F7FFA", color: "#fff", border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>
              {savingProfile ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        )}
      </div>

      {/* CONFIGURACIÓN DE CUENTA */}
      <SectionHeader title="Configuracion de Cuenta" colors={colors} />
      <div style={cardStyle}>
        <p style={{ margin: "0 0 4px", fontWeight: 700, fontSize: 15, color: colors.text, fontFamily: FONT }}>{account?.name || "Sin cuenta"}</p>
        <p style={{ margin: "0 0 14px", fontSize: 12, color: colors.textMuted, fontFamily: FONT }}>{isPersonal ? "Personal" : "Compartida"} · {((account?.memberIds?.length || 0) + (account?.memberLabels?.filter(l => !l.linkedUid)?.length || 0)) || 1} miembro{(((account?.memberIds?.length || 0) + (account?.memberLabels?.filter(l => !l.linkedUid)?.length || 0)) || 1) !== 1 ? "s" : ""}</p>
        <p style={{ fontSize: 11, fontWeight: 600, color: colors.textMuted, marginBottom: 8, letterSpacing: 0.6, textTransform: "uppercase", fontFamily: FONT }}>Moneda</p>
        <button onClick={() => setShowCurrencySheet(true)}
          style={{ width: "100%", padding: "12px 14px", borderRadius: 14, border: `2px solid ${colors.inputBorder}`, background: colors.input, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", fontFamily: FONT }}>
          <span style={{ fontSize: 14, color: colors.text, fontWeight: 600 }}>
            {CURRENCY_SYMBOLS[selectedCurrency] || "$"} {selectedCurrency} — {CURRENCIES_MAP[selectedCurrency]?.name || selectedCurrency}
          </span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={colors.textMuted} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
        </button>
      </div>

      {/* FIX: APARIENCIA — tamaño de letra ELIMINADO de aquí, se movió al MenuPanel global */}

      {/* MIEMBROS */}
      <SectionHeader title="Miembros" colors={colors} />
      <p style={{ fontSize: 12, color: colors.textMuted, margin: "-4px 0 10px", fontFamily: FONT }}>Deslizá a la izquierda para eliminar</p>
      {members?.map(m => {
        const linkedLabel = memberLabels.find(l => l.linkedUid === m.uid);
        const displayMember = linkedLabel
          ? { ...m, name: linkedLabel.name, color: linkedLabel.color || m.color }
          : m;
        return (
          <SwipeableMemberRow
            key={m.uid}
            member={displayMember}
            isCurrentUser={m.uid === currentUser.uid}
            onEdit={setEditingMember}
            onRemoveRequest={setRemovingMember}
            colors={colors}
            showSalary={account?.type === 'shared' && account?.divisionSystem === 'proportional'}
          />
        );
      })}
      {!isPersonal && unlinkedLabels.map(l => (
        <SwipeableMemberRow
          key={l.id}
          member={l}
          isCurrentUser={false}
          onEdit={setEditingMember}
          onRemoveRequest={setRemovingMember}
          colors={colors}
          showSalary={account?.type === 'shared' && account?.divisionSystem === 'proportional'}
        />
      ))}
      {!isPersonal && (
        <>
          <button onClick={() => setEditingMember({ name: "", color: MEMBER_COLORS[(memberLabels.length) % MEMBER_COLORS.length] })}
            style={{ width: "100%", padding: 14, borderRadius: 14, background: colors.pill, border: "2px dashed #4F7FFA", color: "#4F7FFA", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: FONT, marginBottom: 8 }}>
            + Agregar integrante
          </button>
          <SettingRow colors={colors} icon="🔗" label="Invitar a la cuenta" value="Compartí un link para que se unan" onPress={generateInvite} />
        </>
      )}

      {/* GASTOS FIJOS */}
      {isPersonal ? (
        <>
          <SectionHeader title="Mis Gastos Fijos" colors={colors} />
          <p style={{ fontSize: 12, color: colors.textMuted, margin: "-4px 0 10px", fontFamily: FONT }}>Gastos que se repiten cada mes</p>
          {visibleFixed.length === 0 && (
            <div style={{ ...cardStyle, textAlign: "center", color: colors.textMuted, padding: 24 }}>
              <p style={{ fontSize: 28, margin: "0 0 6px" }}>📋</p>
              <p style={{ margin: 0, fontSize: 13, fontFamily: FONT }}>Sin gastos fijos</p>
            </div>
          )}
          {visibleFixed.map(f => (
            <SwipeableFixedRow key={f.id} f={f} colors={colors} cardStyle={cardStyle} onEdit={setEditingFixed} onDelete={handleDeleteFixed} />
          ))}
          <button onClick={() => setShowNewFixed(true)} style={{ width: "100%", padding: 14, borderRadius: 14, background: colors.pill, border: "2px dashed #4F7FFA", color: "#4F7FFA", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: FONT, marginBottom: 8 }}>
            + Agregar gasto fijo
          </button>
        </>
      ) : (
        <>
          <SectionHeader title="Gastos Fijos" colors={colors} />
          <p style={{ fontSize: 12, color: colors.textMuted, margin: "-4px 0 10px", fontFamily: FONT }}>
            Gastos que se repiten cada mes. El tipo (Hogar o Personal) lo elegís al crear cada uno.
          </p>

          {visibleFixed.length === 0 && (
            <div style={{ ...cardStyle, textAlign: "center", color: colors.textMuted, padding: 24 }}>
              <p style={{ fontSize: 28, margin: "0 0 6px" }}>📋</p>
              <p style={{ margin: 0, fontSize: 13, fontFamily: FONT }}>Sin gastos fijos</p>
            </div>
          )}

          {sharedFixed.length > 0 && (
            <>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#4F7FFA", letterSpacing: 0.8, textTransform: "uppercase", margin: "12px 0 6px", fontFamily: FONT }}>🏠 Hogar</p>
              {sharedFixed.map(f => (
                <SwipeableFixedRow key={f.id} f={f} colors={colors} cardStyle={cardStyle} onEdit={setEditingFixed} onDelete={handleDeleteFixed} />
              ))}
            </>
          )}

          {personalFixed.length > 0 && (
            <>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#FA4F7F", letterSpacing: 0.8, textTransform: "uppercase", margin: "12px 0 6px", fontFamily: FONT }}>👤 Personal</p>
              {personalFixed.map(f => (
                <SwipeableFixedRow key={f.id} f={f} colors={colors} cardStyle={cardStyle} onEdit={setEditingFixed} onDelete={handleDeleteFixed} />
              ))}
            </>
          )}

          <button onClick={() => setShowNewFixed(true)} style={{ width: "100%", padding: 14, borderRadius: 14, background: colors.pill, border: "2px dashed #4F7FFA", color: "#4F7FFA", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: FONT, marginBottom: 8 }}>
            + Agregar gasto fijo
          </button>
        </>
      )}

      {/* CATEGORÍAS — FIX: solo las activas de esta cuenta */}
      <SectionHeader title="Categorias" colors={colors} />
      <div style={{ ...cardStyle, padding: 14 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {allCategories.map(c => (
            <button key={c.id} onClick={() => setEditingCategory(c)} style={{ padding: "9px 14px", borderRadius: 20, border: `2px solid ${colors.inputBorder}`, fontSize: 13, cursor: "pointer", fontFamily: FONT, display: "flex", alignItems: "center", gap: 6, background: colors.input, color: colors.text }}>
              {c.icon} {c.label}
            </button>
          ))}
          <button onClick={() => setEditingCategory({ id: null, label: "", icon: "📦", isNew: true })} style={{ padding: "9px 14px", borderRadius: 20, border: "2px dashed #4F7FFA", fontSize: 13, cursor: "pointer", fontFamily: FONT, color: "#4F7FFA", background: "#4F7FFA08", fontWeight: 600 }}>
            + Nueva
          </button>
        </div>
      </div>

      {/* PRESUPUESTO — Pozo Común, Proporcional y Partes iguales */}
      {(account?.type === "pozo" || account?.type === "personal" || account?.divisionSystem === "proportional" || account?.divisionSystem === "50_50") && (
        <>
          <SectionHeader title="Presupuesto" colors={colors} />
          <div style={cardStyle}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: colors.text, fontFamily: FONT }}>Presupuesto mensual</p>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: colors.textMuted, fontFamily: FONT }}>
                  {account?.categoryBudgets?._total
                    ? `Total: ${(account.categoryBudgets._total || 0).toLocaleString("es-AR")}`
                    : "Crea presupuestos para cada categoría."}
                </p>
              </div>
              <button type="button" onClick={() => {
                const b = account?.categoryBudgets || {};
                const out = {};
                allCategories.forEach(c => {
                  const v = b[c.id];
                  out[c.id] = v ? parseInt(v, 10).toLocaleString("es-AR") : "";
                });
                setBudgetByCategory(out);
                setShowBudgetEditor(true);
              }}
                style={{ background: "#4F7FFA11", border: "none", borderRadius: 10, padding: "6px 12px", fontSize: 12, color: "#4F7FFA", cursor: "pointer", fontFamily: FONT, fontWeight: 600 }}>
                {account?.categoryBudgets?._total ? "Editar" : "Configurar"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* LEGAL Y SOPORTE */}
      <SectionHeader title="Legal y soporte" colors={colors} />
      <div style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
        {[
          { icon: "🔒", label: "Política de Privacidad", href: "/privacy.html" },
        ].map((item, i, arr) => (
          <a key={item.href} href={item.href} target="_blank" rel="noopener noreferrer"
            style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", textDecoration: "none", borderBottom: i < arr.length - 1 ? `1px solid ${colors.divider}` : "none" }}>
            <span style={{ fontSize: 20, width: 28, textAlign: "center" }}>{item.icon}</span>
            <span style={{ flex: 1, fontSize: 15, fontWeight: 500, color: colors.text, fontFamily: FONT }}>{item.label}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={colors.textSubtle} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
          </a>
        ))}
      </div>

      {/* CERRAR SESIÓN / ELIMINAR CUENTA */}
      <button
        type="button"
        onClick={onSignOut}
        style={{ width: "100%", padding: 16, borderRadius: 16, background: colors.card, border: "none", fontSize: 16, fontWeight: 500, color: colors.danger, cursor: "pointer", fontFamily: FONT, boxShadow: colors.shadow, marginBottom: 16, marginTop: 24 }}
      >
        Cerrar sesión
      </button>

      <button
        type="button"
        onClick={() => setShowDeleteAccount(true)}
        style={{ width: "100%", padding: 8, background: "none", border: "none", fontSize: 13, color: colors.textMuted, cursor: "pointer", fontFamily: FONT }}
      >
        Eliminar mi cuenta
      </button>

      <div style={{ height: 100 }} />

      {/* MODAL PRESUPUESTO */}
      {showBudgetEditor && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 200, display: "flex", alignItems: "flex-end" }}>
          <div {...budgetSwipe.handlers} style={{ background: colors.card, borderRadius: "24px 24px 0 0", width: "100%", padding: "24px 20px calc(40px + env(safe-area-inset-bottom))", fontFamily: FONT, maxHeight: "85vh", overflowY: "auto", transform: `translateY(${budgetSwipe.dragY}px)`, transition: budgetSwipe.isDragging ? "none" : "transform 0.3s ease" }}>
            <div style={{ width: 36, height: 4, background: colors.divider, borderRadius: 2, margin: "0 auto 20px" }} />
            <p style={{ fontSize: 18, fontWeight: 700, color: colors.text, margin: "0 0 4px", fontFamily: FONT }}>Presupuesto mensual</p>
            <p style={{ fontSize: 13, color: colors.textMuted, margin: "0 0 20px", fontFamily: FONT }}>Configurá cuánto querés gastar por mes. Recibirás alertas al llegar al 80% de la categoría.</p>

            {/* Por categoría */}
            <p style={{ fontSize: 11, fontWeight: 700, color: colors.textMuted, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 10, fontFamily: FONT }}>Por categoría (opcional)</p>
            {allCategories.map(c => (
              <div key={c.id} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 16 }}>{c.icon}</span>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: colors.text, fontFamily: FONT }}>{c.label}</p>
                </div>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: colors.textMuted, fontWeight: 600, fontSize: 14, fontFamily: FONT }}>
                    {CURRENCY_SYMBOLS[account?.currency || "ARS"] || "$"}
                  </span>
                  <input
                    type="text" inputMode="decimal"
                    value={budgetByCategory[c.id] || ""}
                    onChange={e => {
                      const digits = e.target.value.replace(/\D/g, "");
                      const display = digits ? parseInt(digits, 10).toLocaleString("es-AR") : "";
                      setBudgetByCategory(prev => ({ ...prev, [c.id]: display }));
                    }}
                    placeholder="Sin límite"
                    style={{ width: "100%", padding: "10px 14px 10px 36px", borderRadius: 12, border: `2px solid ${colors.inputBorder}`, fontSize: 14, fontFamily: FONT, outline: "none", boxSizing: "border-box", color: colors.inputText, background: colors.input }}
                  />
                </div>
              </div>
            ))}

            <div style={{ marginTop: 12 }}>
              <button type="button" onClick={saveBudgets} disabled={savingBudget}
                style={{ width: "100%", padding: 14, borderRadius: 14, background: savingBudget ? "#aaa" : "linear-gradient(135deg,#4F7FFA,#3a6ae8)", color: "#fff", border: "none", fontSize: 15, fontWeight: 700, cursor: savingBudget ? "default" : "pointer", fontFamily: FONT, marginBottom: 8 }}>
                {savingBudget ? "Guardando..." : "Guardar presupuesto"}
              </button>
              <button type="button" onClick={() => setShowBudgetEditor(false)}
                style={{ width: "100%", padding: 14, borderRadius: 14, background: colors.pill, color: colors.textMuted, border: "none", fontSize: 15, cursor: "pointer", fontFamily: FONT }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODALES */}
      {showShareApp && <ShareAppModal onClose={() => setShowShareApp(false)} colors={colors} />}

      {/* Currency bottom sheet — FIX: scroll lock en fondo */}
      {showCurrencySheet && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 200, display: "flex", alignItems: "flex-end" }}
          onClick={() => setShowCurrencySheet(false)}
          onTouchMove={e => e.preventDefault()}
        >
          <div
            {...currencySwipe.handlers}
            style={{ background: colors.card, borderRadius: "24px 24px 0 0", width: "100%", padding: "24px 20px calc(40px + env(safe-area-inset-bottom))", fontFamily: FONT, maxHeight: "70vh", overflowY: "auto", transform: `translateY(${currencySwipe.dragY}px)`, transition: currencySwipe.isDragging ? "none" : "transform 0.3s ease" }}
            onClick={e => e.stopPropagation()}
            onTouchMove={e => e.stopPropagation()}
          >
            <div style={{ width: 36, height: 4, background: colors.divider, borderRadius: 2, margin: "0 auto 20px" }} />
            <p style={{ fontSize: 17, fontWeight: 700, color: colors.text, margin: "0 0 16px", fontFamily: FONT }}>Moneda</p>
            {CURRENCY_LIST.map(c => (
              <button key={c.code} onClick={() => { saveCurrency(c.code); setShowCurrencySheet(false); }}
                style={{ width: "100%", padding: "14px 16px", borderRadius: 14, border: `2px solid ${selectedCurrency === c.code ? "#4F7FFA" : colors.inputBorder}`, background: selectedCurrency === c.code ? "#4F7FFA11" : colors.input, marginBottom: 8, cursor: "pointer", display: "flex", alignItems: "center", gap: 12, fontFamily: FONT }}>
                <span style={{ fontSize: 20, minWidth: 28 }}>{c.symbol}</span>
                <div style={{ textAlign: "left" }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: colors.text, fontFamily: FONT }}>{c.code}</p>
                  <p style={{ margin: 0, fontSize: 12, color: colors.textMuted, fontFamily: FONT }}>{c.name}</p>
                </div>
                {selectedCurrency === c.code && <span style={{ marginLeft: "auto", color: "#4F7FFA", fontSize: 18 }}>✓</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {showInvite && (
        <InviteScreen account={account} currentUser={currentUser} onClose={() => setShowInvite(false)} />
      )}

      {/* MODAL CONFIRMAR ELIMINAR MIEMBRO */}
      {removingMember && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 300, display: "flex", alignItems: "flex-end" }}>
          <div {...removeSwipe.handlers} style={{ background: colors.card, borderRadius: "24px 24px 0 0", width: "100%", padding: "24px 20px calc(40px + env(safe-area-inset-bottom))", fontFamily: FONT, transform: `translateY(${removeSwipe.dragY}px)`, transition: removeSwipe.isDragging ? "none" : "transform 0.3s ease" }}>
            <div style={{ width: 36, height: 4, background: colors.divider, borderRadius: 2, margin: "0 auto 20px" }} />
            <p style={{ fontSize: 20, fontWeight: 700, color: colors.text, margin: "0 0 8px", fontFamily: FONT }}>¿Eliminar integrante?</p>
            <p style={{ fontSize: 14, color: colors.textMuted, margin: "0 0 24px", fontFamily: FONT }}>
              Se eliminará <strong style={{ color: colors.text }}>{removingMember.name}</strong> de la cuenta. Sus gastos quedarán sin asignar o se reasignarán a vos.
            </p>
            <button onClick={() => handleRemoveMember(removingMember)} disabled={removeLoading}
              style={{ width: "100%", padding: 14, borderRadius: 14, background: "#ff6b6b", color: "#fff", border: "none", fontSize: 15, fontWeight: 700, cursor: removeLoading ? "default" : "pointer", fontFamily: FONT, marginBottom: 10, opacity: removeLoading ? 0.7 : 1 }}>
              {removeLoading ? "Eliminando..." : "Sí, eliminar"}
            </button>
            <button onClick={() => setRemovingMember(null)} style={{ width: "100%", padding: 14, borderRadius: 14, background: colors.pill, color: colors.textMuted, border: "none", fontSize: 15, cursor: "pointer", fontFamily: FONT }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {(editingFixed || showNewFixed) && (
        <FixedExpenseModal
          colors={colors}
          isPersonalAccount={isPersonal}
          expense={editingFixed || undefined}
          onSave={handleSaveFixed}
          onClose={() => { setEditingFixed(null); setShowNewFixed(false); }}
        />
      )}

      {editingCategory && (
        <EditCategoryModal
          colors={colors}
          category={editingCategory}
          isDefault={editingCategory.isDefault}
          onSave={editingCategory.isNew
            ? async (cat) => { await addDoc(collection(db, "accounts", account.id, "categories"), { label: cat.label, icon: cat.icon }); setEditingCategory(null); }
            : handleSaveCategory}
          onDelete={handleDeleteCategory}
          onClose={() => setEditingCategory(null)}
        />
      )}

      {editingMember && (
        <EditMemberModal
          colors={colors}
          member={editingMember}
          onSave={handleSaveMember}
          onDelete={handleDeleteMember}
          onClose={() => setEditingMember(null)}
          allMembers={allMembers}
          isProportional={account?.divisionSystem === 'proportional'}
        />
      )}

      {showDeleteAccount && (
        <DeleteAccountModal
          colors={colors}
          onClose={() => setShowDeleteAccount(false)}
          currentUser={currentUser}
        />
      )}
    </div>
  );
}