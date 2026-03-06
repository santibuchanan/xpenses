import { useState, useEffect, useRef } from "react";
import { doc, setDoc, query, collection, where, orderBy, limit, getDocs, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import { useTheme } from "./theme.jsx";

export default function InviteScreen({ account, currentUser, onClose }) {
  const { colors } = useTheme();
  const [inviteLink, setInviteLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [qrUrl, setQrUrl] = useState("");
  const canvasRef = useRef(null);

  useEffect(() => {
    generateInvite();
  }, []);

  const generateInvite = async () => {
    // Primero buscar si ya existe un invite activo y no usado para esta cuenta
    const existingSnap = await getDocs(
      query(
        collection(db, "invites"),
        where("accountId", "==", account.id),
        where("used", "==", false),
        orderBy("createdAt", "desc"),
        limit(1)
      )
    );

    let inviteId;
    if (!existingSnap.empty) {
      // Reutilizar el invite existente — evita documentos basura en Firestore
      inviteId = existingSnap.docs[0].id;
    } else {
      inviteId = `${account.id}_${Date.now()}`;
      await setDoc(doc(db, "invites", inviteId), {
        accountId: account.id,
        accountName: account.name || "X-penses",
        createdBy: currentUser.uid,
        createdByName: currentUser.displayName,
        createdAt: serverTimestamp(),
        used: false,
      });
    }

    const link = `${window.location.origin}?invite=${inviteId}`;
    setInviteLink(link);
    setQrUrl(`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(link)}&color=1a1a2e&bgcolor=f7f8fc`);
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareWhatsApp = () => {
    const text = `¡Te invito a X-penses! 💸\nUná nuestras cuentas del hogar y llevemos los gastos juntos.\n\n👉 ${inviteLink}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`);
  };

  const shareApp = () => {
    const text = `¡Conocé X-penses! 💸\nLa app para llevar las cuentas del hogar entre dos.\n\n👉 ${window.location.origin}`;
    if (navigator.share) {
      navigator.share({ title: "X-penses", text, url: window.location.origin });
    } else {
      navigator.clipboard.writeText(window.location.origin);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 100, display: "flex", alignItems: "flex-end" }}>
      <div style={{ background: colors.card, borderRadius: "24px 24px 0 0", width: "100%", padding: "24px 20px 44px", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ width: 36, height: 4, background: colors.divider, borderRadius: 2, margin: "0 auto 20px" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22, color: colors.text }}>Invitar a la cuenta</span>
          <button onClick={onClose} style={{ background: colors.pill, border: "none", borderRadius: 50, width: 32, height: 32, fontSize: 18, cursor: "pointer", color: colors.text }}>×</button>
        </div>

        <p style={{ color: colors.textMuted, fontSize: 14, margin: "0 0 20px", lineHeight: 1.5 }}>
          Compartí este link o QR con la persona que querés sumar a <strong style={{ color: colors.text }}>{account?.name}</strong>. Cuando lo abra e inicie sesión con Google, quedará vinculada automáticamente.
        </p>

        {/* QR */}
        {qrUrl && (
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <div style={{ display: "inline-block", background: "#fff", borderRadius: 20, padding: 16, boxShadow: colors.shadow }}>
              <img src={qrUrl} alt="QR" style={{ width: 180, height: 180, display: "block" }} />
            </div>
            <p style={{ color: colors.textMuted, fontSize: 12, margin: "10px 0 0" }}>Escaneá con la cámara del iPhone</p>
          </div>
        )}

        {/* Link */}
        <div style={{ background: colors.pill, borderRadius: 14, padding: "12px 14px", marginBottom: 12, display: "flex", alignItems: "center", gap: 10 }}>
          <p style={{ margin: 0, fontSize: 12, color: colors.textMuted, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{inviteLink || "Generando link..."}</p>
          <button onClick={copyLink} style={{ background: copied ? "#2ecc71" : "#4F7FFA", border: "none", borderRadius: 10, padding: "6px 14px", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>
            {copied ? "✓ Copiado" : "Copiar"}
          </button>
        </div>

        {/* Compartir por WhatsApp */}
        <button onClick={shareWhatsApp} style={{ width: "100%", padding: 14, borderRadius: 14, background: "#25D366", color: "#fff", border: "none", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <span>💬</span> Invitar por WhatsApp
        </button>

        <div style={{ height: 1, background: colors.divider, margin: "16px 0" }} />

        {/* Compartir la app */}
        <p style={{ color: colors.textMuted, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, margin: "0 0 10px" }}>Compartir X-penses con amigos</p>
        <p style={{ color: colors.textMuted, fontSize: 13, margin: "0 0 12px" }}>¿Querés que otros conozcan la app? Compartila.</p>
        <button onClick={shareApp} style={{ width: "100%", padding: 14, borderRadius: 14, background: "linear-gradient(135deg,#4F7FFA,#3a6ae8)", color: "#fff", border: "none", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <span>📤</span> Compartir X-penses
        </button>
      </div>
    </div>
  );
}
