import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "./firebase";
import { useState } from "react";

export default function AuthScreen() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleGoogle = async () => {
    setLoading(true);
    setError("");
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      setError("No se pudo iniciar sesión. Intentá de nuevo.");
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(140deg, #1a1a2e 0%, #0f3460 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Serif+Display&display=swap');`}</style>

      {/* Logo */}
      <div style={{ textAlign: "center", marginBottom: 48 }}>
        <div style={{ width: 80, height: 80, borderRadius: 24, background: "linear-gradient(135deg,#4F7FFA,#3a6ae8)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40, margin: "0 auto 20px", boxShadow: "0 8px 32px #4F7FFA55" }}>
          💸
        </div>
        <p style={{ fontFamily: "'DM Serif Display', serif", fontSize: 38, color: "#fff", margin: "0 0 8px", letterSpacing: -1 }}>X-penses</p>
        <p style={{ color: "#ffffff66", fontSize: 15, margin: 0 }}>Tu app de finanzas personales</p>
      </div>

      {/* Card */}
      <div style={{ background: "#ffffff0f", backdropFilter: "blur(20px)", borderRadius: 28, padding: 32, width: "100%", maxWidth: 360, border: "1px solid #ffffff18" }}>
        <p style={{ color: "#fff", fontSize: 20, fontWeight: 700, margin: "0 0 8px", textAlign: "center" }}>Bienvenido</p>
        <p style={{ color: "#ffffff88", fontSize: 14, margin: "0 0 28px", textAlign: "center", lineHeight: 1.5 }}>
          Iniciá sesión para acceder a tu cuenta
        </p>

        <button onClick={handleGoogle} disabled={loading}
          style={{ width: "100%", padding: "16px 20px", borderRadius: 16, background: "#fff", border: "none", cursor: loading ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 12, fontFamily: "inherit", fontWeight: 700, fontSize: 15, color: "#1a1a2e", opacity: loading ? 0.7 : 1, transition: "opacity 0.2s" }}>
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {loading ? "Iniciando sesión..." : "Continuar con Google"}
        </button>

        {error && <p style={{ color: "#ff6b6b", fontSize: 13, textAlign: "center", margin: "16px 0 0" }}>{error}</p>}
      </div>

      <p style={{ color: "#ffffff33", fontSize: 12, marginTop: 32, textAlign: "center" }}>
        Tus datos están protegidos con Firebase
      </p>
    </div>
  );
}
