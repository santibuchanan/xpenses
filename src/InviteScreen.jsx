import { useState, useEffect } from "react";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import { useTheme } from "./theme.jsx";
import { useSwipeSheet } from "./hooks/useSwipeSheet.js";

const FONT = `'DM Sans', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif`;

export default function InviteScreen({ account, currentUser, onClose }) {
  const { colors } = useTheme();
  const [inviteLink, setInviteLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const { dragY, isDragging, handlers } = useSwipeSheet({ onClose });

  useEffect(() => {
    generateInvite();
  }, []);

  const generateInvite = async () => {
    setLoading(true);
    // Link reutilizable — un solo invite por cuenta, nunca se marca como usado
    const inviteId = `${account.id}_permanent`;
    await setDoc(doc(db, "invites", inviteId), {
      accountId: account.id,
      accountName: account.name || "X-penses",
      createdBy: currentUser.uid,
      createdAt: serverTimestamp(),
      used: false,
    }, { merge: true });

    const link = `${window.location.origin}/#invite=${inviteId}`;
    setInviteLink(link);
    setLoading(false);
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const shareWhatsApp = () => {
    const text = `¡Te invito a unirte a "${account?.name}" en X-penses! 💸\nLlevemos los gastos juntos.\n\n👉 ${inviteLink}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`);
  };

  const shareNative = () => {
    if (navigator.share) {
      navigator.share({ title: `Unirse a ${account?.name}`, text: `¡Te invito a ${account?.name} en X-penses! 💸`, url: inviteLink });
    } else {
      copyLink();
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 100, display: "flex", alignItems: "flex-end" }}>
      <div {...handlers} style={{ background: colors.card, borderRadius: "24px 24px 0 0", width: "100%", padding: "24px 20px 48px", maxHeight: "85vh", overflowY: "auto", fontFamily: FONT, transform: `translateY(${dragY}px)`, transition: isDragging ? "none" : "transform 0.3s ease" }}>
        <div style={{ width: 36, height: 4, background: colors.divider, borderRadius: 2, margin: "0 auto 20px" }} />
        
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <p style={{ margin: 0, fontSize: 20, fontWeight: 700, color: colors.text, fontFamily: FONT }}>Invitar a la cuenta</p>
          <button onClick={onClose} style={{ background: colors.pill, border: "none", borderRadius: 50, width: 32, height: 32, fontSize: 18, cursor: "pointer", color: colors.text }}>×</button>
        </div>

        <p style={{ color: colors.textMuted, fontSize: 14, margin: "0 0 24px", lineHeight: 1.5, fontFamily: FONT }}>
          Compartí este link con quien querés sumar a <strong style={{ color: colors.text }}>{account?.name}</strong>. El link es permanente y puede usarse múltiples veces.
        </p>

        {/* Link */}
        <div style={{ background: colors.pill, borderRadius: 14, padding: "14px 16px", marginBottom: 12, display: "flex", alignItems: "center", gap: 10 }}>
          <p style={{ margin: 0, fontSize: 12, color: colors.textMuted, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: FONT }}>
            {loading ? "Generando link..." : inviteLink}
          </p>
          <button onClick={copyLink} disabled={loading}
            style={{ background: copied ? "#2ecc71" : "#4F7FFA", border: "none", borderRadius: 10, padding: "8px 16px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: loading ? "default" : "pointer", fontFamily: FONT, flexShrink: 0, opacity: loading ? 0.6 : 1 }}>
            {copied ? "✓ Copiado" : "Copiar"}
          </button>
        </div>

        {/* WhatsApp */}
        <button onClick={shareWhatsApp} disabled={loading}
          style={{ width: "100%", padding: 15, borderRadius: 14, background: "#25D366", color: "#fff", border: "none", fontSize: 15, fontWeight: 700, cursor: loading ? "default" : "pointer", fontFamily: FONT, marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: loading ? 0.6 : 1 }}>
          <span>💬</span> Invitar por WhatsApp
        </button>

        {/* Compartir nativo */}
        <button onClick={shareNative} disabled={loading}
          style={{ width: "100%", padding: 15, borderRadius: 14, background: colors.pill, color: colors.text, border: "none", fontSize: 15, fontWeight: 600, cursor: loading ? "default" : "pointer", fontFamily: FONT, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: loading ? 0.6 : 1 }}>
          <span>📤</span> Compartir link
        </button>
      </div>
    </div>
  );
}