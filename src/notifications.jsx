import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { collection, addDoc, onSnapshot, query, where, orderBy, updateDoc, deleteDoc, doc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import { useTheme } from "./theme.jsx";

const FONT = `'DM Sans', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif`;
const NotifContext = createContext({});

export const NOTIF_TYPES = {
  EXPENSE_ADDED: "expense_added",
  EXPENSE_EDITED: "expense_edited",
  FIXED_PAID: "fixed_paid",
  ACCOUNT_SETTLED: "account_settled",
  MEMBER_JOINED: "member_joined",
  FIXED_DUE_SOON: "fixed_due_soon",
};

export const NOTIF_LABELS = {
  expense_added: "Nuevo gasto agregado",
  expense_edited: "Gasto editado",
  fixed_paid: "Gasto fijo pagado",
  account_settled: "Cuenta saldada",
  member_joined: "Nuevo miembro",
  fixed_due_soon: "Vencimiento próximo",
};

export const NOTIF_ICONS = {
  expense_added: "💸",
  expense_edited: "✏️",
  fixed_paid: "✅",
  account_settled: "🎉",
  member_joined: "👋",
  fixed_due_soon: "⏰",
};

export function NotifProvider({ children, currentUser, accountId }) {
  const [notifications, setNotifications] = useState([]);
  const [prefs, setPrefs] = useState({
    expense_added: true, expense_edited: true, fixed_paid: true,
    account_settled: true, member_joined: true, fixed_due_soon: true,
    pushEnabled: false,
  });
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!currentUser) return;
    const q = query(
      collection(db, "notifications"),
      where("toUid", "==", currentUser.uid),
      orderBy("createdAt", "desc")
    );
    return onSnapshot(q, snap => {
      const notifs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setNotifications(notifs);
      const newest = notifs[0];
      if (newest && !newest.read && newest.createdAt) {
        const age = Date.now() - (newest.createdAt?.toMillis?.() || 0);
        if (age < 5000) {
          setToast(newest);
          setTimeout(() => setToast(null), 4000);
        }
      }
    });
  }, [currentUser]);

  const sendNotification = useCallback(async ({ type, title, body, fromName, toUids, accountId: accId }) => {
    if (!toUids || toUids.length === 0) return;
    for (const uid of toUids) {
      await addDoc(collection(db, "notifications"), {
        type, title, body, fromName,
        toUid: uid, accountId: accId,
        read: false, createdAt: serverTimestamp(),
      });
    }
  }, []);

  const markRead = async (id) => {
    await updateDoc(doc(db, "notifications", id), { read: true });
  };

  const markAllRead = async () => {
    for (const n of notifications.filter(n => !n.read)) {
      await updateDoc(doc(db, "notifications", n.id), { read: true });
    }
  };

  const deleteNotif = async (id) => {
    await deleteDoc(doc(db, "notifications", id));
  };

  const deleteAllNotifs = async () => {
    for (const n of notifications) {
      await deleteDoc(doc(db, "notifications", n.id));
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <NotifContext.Provider value={{ notifications, unreadCount, sendNotification, markRead, markAllRead, deleteNotif, deleteAllNotifs, prefs, setPrefs }}>
      {children}
      {toast && <NotifToast notif={toast} onClose={() => setToast(null)} />}
    </NotifContext.Provider>
  );
}

export function useNotif() {
  return useContext(NotifContext);
}

function NotifToast({ notif, onClose }) {
  const { colors } = useTheme();
  return (
    <div style={{
      position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)",
      width: "calc(100% - 32px)", maxWidth: 398,
      background: colors.card, borderRadius: 16, padding: "14px 16px",
      boxShadow: "0 8px 32px rgba(0,0,0,0.18)", zIndex: 999,
      display: "flex", alignItems: "center", gap: 12,
      border: `1px solid ${colors.cardBorder}`,
      animation: "slideDown 0.3s ease", fontFamily: FONT,
    }}>
      <style>{`@keyframes slideDown { from { transform: translateX(-50%) translateY(-20px); opacity: 0; } to { transform: translateX(-50%) translateY(0); opacity: 1; } }`}</style>
      <span style={{ fontSize: 28 }}>{NOTIF_ICONS[notif.type] || "🔔"}</span>
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: colors.text, fontFamily: FONT }}>{notif.title}</p>
        <p style={{ margin: "2px 0 0", fontSize: 12, color: colors.textMuted, fontFamily: FONT }}>{notif.body}</p>
      </div>
      <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: colors.textMuted, padding: 4 }}>×</button>
    </div>
  );
}

// ── Fila de notificación con swipe para eliminar (estilo iOS) ──
function SwipeableNotifRow({ n, onMarkRead, onDelete, colors }) {
  const [offsetX, setOffsetX] = useState(0);
  const startX = useRef(null);
  const THRESHOLD = 72;

  const onTouchStart = (e) => { startX.current = e.touches[0].clientX; };
  const onTouchMove = (e) => {
    if (startX.current === null) return;
    const dx = startX.current - e.touches[0].clientX;
    if (dx > 0) setOffsetX(Math.min(dx, THRESHOLD + 20));
  };
  const onTouchEnd = () => {
    if (offsetX > THRESHOLD / 2) setOffsetX(THRESHOLD);
    else setOffsetX(0);
    startX.current = null;
  };

  const timeAgo = (ts) => {
    if (!ts?.toMillis) return "";
    const diff = Date.now() - ts.toMillis();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "ahora";
    if (mins < 60) return `hace ${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `hace ${hrs}h`;
    return `hace ${Math.floor(hrs / 24)}d`;
  };

  return (
    <div style={{ position: "relative", overflow: "hidden", borderBottom: `1px solid ${colors.divider}` }}>
      {/* Fondo rojo de eliminar */}
      <div style={{
        position: "absolute", right: 0, top: 0, bottom: 0, width: THRESHOLD,
        background: "#e74c3c", display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <button onClick={() => onDelete(n.id)}
          style={{ background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
          <span style={{ fontSize: 18 }}>🗑️</span>
          <span style={{ fontSize: 10, color: "#fff", fontWeight: 700, fontFamily: FONT }}>Eliminar</span>
        </button>
      </div>

      {/* Contenido deslizable */}
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={() => { if (offsetX > 0) setOffsetX(0); else onMarkRead(n.id); }}
        style={{
          display: "flex", gap: 12, padding: "14px 0",
          transform: `translateX(-${offsetX}px)`,
          transition: startX.current === null ? "transform 0.25s ease" : "none",
          cursor: "pointer", opacity: n.read ? 0.6 : 1,
          background: colors.card, position: "relative", zIndex: 1,
        }}>
        <div style={{ width: 44, height: 44, borderRadius: 22, background: "#4F7FFA22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>
          {NOTIF_ICONS[n.type] || "🔔"}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <p style={{ margin: 0, fontWeight: n.read ? 400 : 700, fontSize: 14, color: colors.text, fontFamily: FONT }}>{n.title}</p>
            <span style={{ fontSize: 11, color: colors.textMuted, flexShrink: 0, marginLeft: 8, fontFamily: FONT }}>{timeAgo(n.createdAt)}</span>
          </div>
          <p style={{ margin: "3px 0 0", fontSize: 13, color: colors.textMuted, fontFamily: FONT }}>{n.body}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {/* Botón X individual */}
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(n.id); }}
            style={{ background: colors.pill, border: "none", borderRadius: 50, width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 14, color: colors.textMuted, flexShrink: 0 }}>
            ×
          </button>
          {!n.read && <div style={{ width: 8, height: 8, borderRadius: 4, background: "#4F7FFA", flexShrink: 0 }} />}
        </div>
      </div>
    </div>
  );
}

// ── Ícono campana SVG (igual al del header) ──
function BellIcon({ size = 48, color = "#4F7FFA" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 01-3.46 0"/>
    </svg>
  );
}

export function NotifCenter({ onClose }) {
  const { notifications, unreadCount, markRead, markAllRead, deleteNotif, deleteAllNotifs } = useNotif();
  const { colors } = useTheme();
  const [showConfirmClear, setShowConfirmClear] = useState(false);

  // Swipe-to-close
  const startY = useRef(null);
  const [dragY, setDragY] = useState(0);
  const isDragging = useRef(false);
  const onTouchStart = (e) => { startY.current = e.touches[0].clientY; isDragging.current = true; };
  const onTouchMove = (e) => {
    if (!isDragging.current) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 0) setDragY(dy);
  };
  const onTouchEnd = () => {
    if (dragY > 120) onClose();
    else setDragY(0);
    isDragging.current = false; startY.current = null;
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "flex-end" }}
      onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          background: colors.card, borderRadius: "24px 24px 0 0", width: "100%",
          maxHeight: "78vh", display: "flex", flexDirection: "column", fontFamily: FONT,
          transform: `translateY(${dragY}px)`,
          transition: isDragging.current ? "none" : "transform 0.3s ease",
        }}>

        {/* Handle */}
        <div style={{ padding: "20px 20px 0" }}>
          <div style={{ width: 36, height: 4, background: colors.divider, borderRadius: 2, margin: "0 auto 20px" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 22, fontWeight: 700, color: colors.text, fontFamily: FONT }}>Notificaciones</span>
              {unreadCount > 0 && (
                <span style={{ background: "#4F7FFA", color: "#fff", fontSize: 12, fontWeight: 700, padding: "2px 8px", borderRadius: 12, fontFamily: FONT }}>{unreadCount}</span>
              )}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {unreadCount > 0 && (
                <button onClick={markAllRead} style={{ background: "none", border: "none", fontSize: 12, color: "#4F7FFA", fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>
                  Marcar todo leído
                </button>
              )}
              {notifications.length > 0 && (
                <button onClick={() => setShowConfirmClear(true)} style={{ background: colors.dangerBg, border: "none", borderRadius: 8, padding: "5px 10px", fontSize: 12, color: colors.danger, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>
                  Borrar todas
                </button>
              )}
              <button onClick={onClose} style={{ background: colors.pill, border: "none", borderRadius: 50, width: 32, height: 32, fontSize: 18, cursor: "pointer", color: colors.text }}>×</button>
            </div>
          </div>
        </div>

        {/* Lista scrolleable */}
        <div style={{ overflowY: "auto", flex: 1, padding: "0 20px 32px" }}>
          {notifications.length === 0 && (
            <div style={{ textAlign: "center", padding: "48px 20px", color: colors.textMuted }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 14, opacity: 0.35 }}>
                <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke={colors.textMuted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 01-3.46 0"/>
                </svg>
              </div>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: colors.textMuted, fontFamily: FONT }}>Sin notificaciones</p>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: colors.textMuted, fontFamily: FONT }}>Acá vas a ver las novedades de tus cuentas</p>
            </div>
          )}

          {notifications.map(n => (
            <SwipeableNotifRow
              key={n.id}
              n={n}
              colors={colors}
              onMarkRead={markRead}
              onDelete={deleteNotif}
            />
          ))}
        </div>
      </div>

      {/* Confirm borrar todas */}
      {showConfirmClear && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
          onClick={() => setShowConfirmClear(false)}>
          <div style={{ background: colors.card, borderRadius: 24, padding: 24, width: "100%", maxWidth: 320, fontFamily: FONT }}
            onClick={e => e.stopPropagation()}>
            <p style={{ fontSize: 36, textAlign: "center", margin: "0 0 12px" }}>🗑️</p>
            <p style={{ fontSize: 17, fontWeight: 700, color: colors.text, margin: "0 0 8px", textAlign: "center", fontFamily: FONT }}>¿Borrar todas?</p>
            <p style={{ fontSize: 13, color: colors.textMuted, margin: "0 0 24px", textAlign: "center", fontFamily: FONT }}>Esta acción no se puede deshacer.</p>
            <button onClick={async () => { await deleteAllNotifs(); setShowConfirmClear(false); }}
              style={{ width: "100%", padding: 14, borderRadius: 14, background: "#e74c3c", color: "#fff", border: "none", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: FONT, marginBottom: 8 }}>
              Sí, borrar todas
            </button>
            <button onClick={() => setShowConfirmClear(false)}
              style={{ width: "100%", padding: 14, borderRadius: 14, background: colors.pill, color: colors.textMuted, border: "none", fontSize: 15, cursor: "pointer", fontFamily: FONT }}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
