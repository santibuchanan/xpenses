import { useState, useRef } from "react";
import { useTheme } from "../../theme.jsx";
import { Tag } from "../shared/ui.jsx";
import { useSwipeRow, useSwipeSheet } from "../../hooks/useSwipeSheet.js";

const FONT = `'DM Sans', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif`;

const fmtDate = (iso) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}-${m}-${y}`;
};

// ── POPUP CONFIRMAR ELIMINACIÓN ──
export function DeleteConfirmPopup({ expense, fmt, allCategories, colors, onConfirm, onCancel }) {
  const cat = allCategories?.find(c => c.id === expense.category);
  const [loading, setLoading] = useState(false);
  const { dragY, isDragging, handlers } = useSwipeSheet({ onClose: onCancel, threshold: 100 });

  const handleConfirm = async () => {
    if (loading) return;
    setLoading(true);
    await onConfirm();
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 300, display: "flex", alignItems: "flex-end" }}
      onClick={onCancel}
    >
      <div
        {...handlers}
        onClick={e => e.stopPropagation()}
        style={{
          background: colors.card, borderRadius: "24px 24px 0 0", width: "100%",
          padding: "0 20px calc(40px + env(safe-area-inset-bottom))", fontFamily: FONT,
          transform: `translateY(${dragY}px)`,
          transition: isDragging ? "none" : "transform 0.3s ease",
        }}
      >
        <div style={{ padding: "16px 0 8px", touchAction: "none" }}>
          <div style={{ width: 36, height: 4, background: colors.divider, borderRadius: 2, margin: "0 auto" }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <div style={{ width: 44, height: 44, borderRadius: 14, background: "#e74c3c14", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>
            {cat?.icon || "📦"}
          </div>
          <div>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 16, color: colors.text, fontFamily: FONT }}>{expense.concept}</p>
            <p style={{ margin: "2px 0 0", fontSize: 13, color: colors.textMuted, fontFamily: FONT }}>{fmt(expense.amount)}</p>
          </div>
        </div>
        <p style={{ fontSize: 15, color: colors.text, margin: "0 0 20px", fontFamily: FONT, lineHeight: 1.5 }}>
          ¿Eliminás este gasto? Esta acción no se puede deshacer.
        </p>
        <button
          onClick={handleConfirm}
          disabled={loading}
          style={{ width: "100%", padding: 15, borderRadius: 14, background: loading ? "#aaa" : "#e74c3c", color: "#fff", border: "none", fontSize: 15, fontWeight: 700, cursor: loading ? "default" : "pointer", fontFamily: FONT, marginBottom: 10 }}
        >
          {loading ? "Eliminando..." : "🗑️ Eliminar"}
        </button>
        <button
          onClick={onCancel}
          disabled={loading}
          style={{ width: "100%", padding: 14, borderRadius: 14, background: colors.pill, color: colors.textMuted, border: "none", fontSize: 15, cursor: "pointer", fontFamily: FONT }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ── SWIPEABLE EXPENSE ROW ──
// Click → abre edición | Swipe parcial → peek rojo | Swipe total → popup eliminar
export function SwipeableExpenseRow({ e, allCategories, allMembers, fmt, fs, colors, onEdit, onDelete, isPersonal, currentUser }) {
  const [showDelete, setShowDelete] = useState(false);

  const { offsetX, peekProgress, handlers, reset, wasDragging } = useSwipeRow({
    peekDistance: 80,
    fullDistance: 180,
    onFull: () => setShowDelete(true),
  });

  const handleClick = () => {
    if (wasDragging()) return;
    if (offsetX > 0) { reset(); return; }
    onEdit(e);
  };

  const cat = allCategories.find(c => c.id === e.category);
  const payer = allMembers?.find(m => m.uid === e.paidBy);
  const forWhomUids = Array.isArray(e.forWhom) ? e.forWhom : (e.forWhom ? [e.forWhom] : []);
  const PEEK = 80;

  const getTypeInfo = () => {
    if (e.type === "hogar") return { label: "Hogar", color: "#4F7FFA" };
    if (e.type === "extraordinary") return { label: "Extraordinario", color: "#f39c12" };
    const destUids = e.type === "mio" ? (e.owner ? [e.owner] : []) : forWhomUids;
    const iAmDest = destUids.includes(currentUser?.uid);
    const destNames = destUids
      .map(uid => uid === currentUser?.uid ? "mí" : allMembers?.find(m => m.uid === uid)?.name || "?")
      .filter(Boolean);
    const destStr = destNames.length === 1 && destNames[0] === "mí" ? "mí" : destNames.join(" y ");
    if (iAmDest) return { label: "Para mí", color: "#2ecc71" };
    return { label: `Para ${destStr || "?"}`, color: "#FA4F7F" };
  };

  const { label: typeLabel, color: typeColor } = getTypeInfo();
  const who = (e.type === "hogar" || e.type === "extraordinary") ? payer : null;

  // Gasto eliminado (soft-delete) — mostrar tachado, sin swipe
  if (e.deleted) {
    return (
      <div style={{ background: colors.card, borderRadius: 20, padding: "14px 16px", border: `1px solid ${colors.cardBorder}`, boxShadow: colors.shadow, marginBottom: 10, opacity: 0.5 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
            <span style={{ fontSize: 22, flexShrink: 0, filter: "grayscale(1)" }}>{cat?.icon || "📦"}</span>
            <div>
              <p style={{ margin: 0, fontWeight: 600, fontSize: fs.base, color: colors.textMuted, fontFamily: FONT, textDecoration: "line-through" }}>{e.concept}</p>
              <p style={{ margin: "2px 0 4px", fontSize: fs.sub, color: colors.textMuted, fontFamily: FONT }}>{fmtDate(e.date)}</p>
              <Tag color="#e74c3c">Eliminado</Tag>
            </div>
          </div>
          <p style={{ margin: 0, fontWeight: 700, fontSize: fs.base, color: colors.textMuted, fontFamily: FONT, flexShrink: 0, marginLeft: 8, textDecoration: "line-through" }}>{fmt(e.amount)}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div style={{ position: "relative", marginBottom: 10, borderRadius: 20, overflow: "hidden" }}>
        {/* Fondo rojo animado */}
        <div style={{
          position: "absolute", right: 0, top: 0, bottom: 0, width: PEEK,
          borderRadius: "0 20px 20px 0", display: "flex", alignItems: "center", justifyContent: "center",
          background: `rgba(231,76,60,${0.15 + peekProgress * 0.85})`, transition: "background 0.1s",
        }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, opacity: Math.min(1, offsetX / (PEEK / 2)) }}>
            <span style={{ fontSize: 20 }}>🗑️</span>
            <span style={{ fontSize: 9, color: "#fff", fontWeight: 700, fontFamily: FONT }}>Eliminar</span>
          </div>
        </div>

        {/* Card deslizable */}
        <div
          {...handlers}
          onClick={handleClick}
          style={{
            background: colors.card, borderRadius: 20, padding: "14px 16px",
            border: `1px solid ${colors.cardBorder}`, boxShadow: colors.shadow,
            transform: `translateX(-${offsetX}px)`,
            transition: offsetX === 0 ? "transform 0.25s ease" : "none",
            position: "relative", zIndex: 1, cursor: "pointer",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
              <span style={{ fontSize: 22, flexShrink: 0 }}>{cat?.icon || "📦"}</span>
              <div>
                <p style={{ margin: 0, fontWeight: 600, fontSize: fs.base, color: colors.text, fontFamily: FONT }}>{e.concept}</p>
                <p style={{ margin: "2px 0 4px", fontSize: fs.sub, color: colors.textMuted, fontFamily: FONT }}>
                  {fmtDate(e.date)}{who ? ` · ${who.name}` : ""}
                </p>
                {!isPersonal && <Tag color={typeColor}>{typeLabel}</Tag>}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: fs.base, color: colors.text, fontFamily: FONT }}>{fmt(e.amount)}</p>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={colors.textMuted} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </div>
          </div>
        </div>
      </div>

      {showDelete && (
        <DeleteConfirmPopup
          expense={e}
          fmt={fmt}
          allCategories={allCategories}
          colors={colors}
          onConfirm={async () => { await onDelete(e.id); setShowDelete(false); }}
          onCancel={() => setShowDelete(false)}
        />
      )}
    </>
  );
}
