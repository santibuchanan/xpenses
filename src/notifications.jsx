import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { collection, addDoc, onSnapshot, query, where, orderBy, updateDoc, doc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import { useTheme } from "./theme.jsx";

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
      // Show toast for new unread
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

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <NotifContext.Provider value={{ notifications, unreadCount, sendNotification, markRead, markAllRead, prefs, setPrefs }}>
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
      animation: "slideDown 0.3s ease"
    }}>
      <style>{`@keyframes slideDown { from { transform: translateX(-50%) translateY(-20px); opacity: 0; } to { transform: translateX(-50%) translateY(0); opacity: 1; } }`}</style>
      <span style={{ fontSize: 28 }}>{NOTIF_ICONS[notif.type] || "🔔"}</span>
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: colors.text }}>{notif.title}</p>
        <p style={{ margin: "2px 0 0", fontSize: 12, color: colors.textMuted }}>{notif.body}</p>
      </div>
      <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: colors.textMuted, padding: 4 }}>×</button>
    </div>
  );
}

export function NotifCenter({ onClose }) {
  const { notifications, unreadCount, markRead, markAllRead } = useNotif();
  const { colors } = useTheme();

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
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "flex-end" }}>
      <div style={{ background: colors.card, borderRadius: "24px 24px 0 0", width: "100%", maxHeight: "75vh", overflowY: "auto", padding: "20px 20px 40px" }}>
        <div style={{ width: 36, height: 4, background: colors.divider, borderRadius: 2, margin: "0 auto 20px" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22, color: colors.text }}>Notificaciones {unreadCount > 0 && <span style={{ background: "#4F7FFA", color: "#fff", fontSize: 12, fontWeight: 700, padding: "2px 8px", borderRadius: 12, marginLeft: 6 }}>{unreadCount}</span>}</span>
          <div style={{ display: "flex", gap: 8 }}>
            {unreadCount > 0 && <button onClick={markAllRead} style={{ background: "none", border: "none", fontSize: 12, color: "#4F7FFA", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Marcar todo leído</button>}
            <button onClick={onClose} style={{ background: colors.pill, border: "none", borderRadius: 50, width: 32, height: 32, fontSize: 18, cursor: "pointer", color: colors.text }}>×</button>
          </div>
        </div>

        {notifications.length === 0 && (
          <div style={{ textAlign: "center", padding: 40, color: colors.textMuted }}>
            <p style={{ fontSize: 40, margin: "0 0 8px" }}>🔔</p>
            <p style={{ margin: 0 }}>Sin notificaciones</p>
          </div>
        )}

        {notifications.map(n => (
          <div key={n.id} onClick={() => markRead(n.id)}
            style={{ display: "flex", gap: 12, padding: "14px 0", borderBottom: `1px solid ${colors.divider}`, cursor: "pointer", opacity: n.read ? 0.6 : 1 }}>
            <div style={{ width: 44, height: 44, borderRadius: 22, background: "#4F7FFA22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>
              {NOTIF_ICONS[n.type] || "🔔"}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <p style={{ margin: 0, fontWeight: n.read ? 400 : 700, fontSize: 14, color: colors.text }}>{n.title}</p>
                <span style={{ fontSize: 11, color: colors.textMuted, flexShrink: 0, marginLeft: 8 }}>{timeAgo(n.createdAt)}</span>
              </div>
              <p style={{ margin: "3px 0 0", fontSize: 13, color: colors.textMuted }}>{n.body}</p>
            </div>
            {!n.read && <div style={{ width: 8, height: 8, borderRadius: 4, background: "#4F7FFA", flexShrink: 0, marginTop: 6 }} />}
          </div>
        ))}
      </div>
    </div>
  );
}
