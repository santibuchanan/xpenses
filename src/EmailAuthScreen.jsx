import { useState } from "react";
import {
  fetchSignInMethodsForEmail,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  signInWithPopup,
} from "firebase/auth";
import { auth, googleProvider } from "./firebase";

const SF = `-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', sans-serif`;

const FIREBASE_ERRORS = {
  "auth/wrong-password":       "Contraseña incorrecta",
  "auth/invalid-credential":   "Contraseña incorrecta",
  "auth/user-not-found":       "No existe una cuenta con ese email",
  "auth/email-already-in-use": "Ese email ya está registrado",
  "auth/weak-password":        "La contraseña debe tener al menos 6 caracteres",
  "auth/invalid-email":        "El email no es válido",
  "auth/too-many-requests":    "Demasiados intentos. Intentá más tarde",
};

function translateError(code) {
  return FIREBASE_ERRORS[code] || "Ocurrió un error. Intentá de nuevo.";
}

export default function EmailAuthScreen({ onBack, onEnter }) {
  const [step, setStep]           = useState("email"); // "email" | "login" | "register"
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [confirm, setConfirm]     = useState("");
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [verifSent, setVerifSent] = useState(false);
  const [touched, setTouched]     = useState({});

  const touch = (field) => setTouched(t => ({ ...t, [field]: true }));

  const isValidEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  // ── PASO 1: verificar email ──
  const handleCheckEmail = async () => {
    touch("email");
    if (!isValidEmail(email)) { setError("El email no es válido"); return; }
    setLoading(true);
    setError("");
    try {
      const methods = await fetchSignInMethodsForEmail(auth, email);
      if (methods.includes("google.com")) {
        // Email registrado con Google — redirigir directo
        setStep("google");
      } else if (methods.length > 0) {
        setStep("login");
      } else {
        setStep("register");
      }
    } catch (e) {
      setError(translateError(e.code));
    } finally {
      setLoading(false);
    }
  };

  // ── Google redirect desde email detectado ──
  const handleGoogleFromEmail = async () => {
    setLoading(true);
    setError("");
    try {
      await signInWithPopup(auth, googleProvider);
      onEnter();
    } catch (e) {
      setError(translateError(e.code));
      setLoading(false);
    }
  };

  // ── PASO 2: login ──
  const handleLogin = async () => {
    touch("password");
    if (!password) { setError("Ingresá tu contraseña"); return; }
    setLoading(true);
    setError("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
      onEnter();
    } catch (e) {
      setError(translateError(e.code));
      setLoading(false);
    }
  };

  // ── PASO 2: olvidé contraseña ──
  const handleReset = async () => {
    setLoading(true);
    setError("");
    try {
      await sendPasswordResetEmail(auth, email);
      setResetSent(true);
    } catch (e) {
      setError(translateError(e.code));
    } finally {
      setLoading(false);
    }
  };

  // ── PASO 3: registro ──
  const handleRegister = async () => {
    touch("password"); touch("confirm");
    if (password.length < 6) { setError("La contraseña debe tener al menos 6 caracteres"); return; }
    if (password !== confirm) { setError("Las contraseñas no coinciden"); return; }
    setLoading(true);
    setError("");
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await sendEmailVerification(cred.user);
      setVerifSent(true);
      setTimeout(() => onEnter(), 2500);
    } catch (e) {
      setError(translateError(e.code));
      setLoading(false);
    }
  };

  const inputStyle = (hasError) => ({
    width: "100%", padding: "15px 16px", borderRadius: 14, fontSize: 16,
    fontFamily: SF, outline: "none", boxSizing: "border-box",
    color: "#1a1a2e", background: "#fff",
    border: `2px solid ${hasError ? "#e74c3c" : "#e8e8e8"}`,
    marginBottom: 4,
  });

  return (
    <div style={{
      position: "fixed", inset: 0, background: "#08090d",
      display: "flex", flexDirection: "column", fontFamily: SF,
      paddingTop: "env(safe-area-inset-top)",
      paddingBottom: "env(safe-area-inset-bottom)",
    }}>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        .ea-card { animation: fadeUp 0.3s ease forwards; }
        .btn-press:active { transform: scale(0.97); }
      `}</style>

      {/* Header */}
      <div style={{ padding: "16px 20px 0", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => { if (step === "email") { onBack(); } else { setStep("email"); setError(""); setPassword(""); setConfirm(""); } }}
          style={{ background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 12, padding: "10px 16px", color: "#ffffffcc", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: SF }}>
          ← Atrás
        </button>
        <span style={{ fontSize: 17, fontWeight: 700, color: "#fff" }}>
          {step === "email" ? "Ingresá tu email" : step === "login" ? "Iniciá sesión" : step === "google" ? "Cuenta de Google" : "Crear cuenta"}
        </span>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 24px 40px" }}>
        <div className="ea-card" key={step}>

          {/* ── PASO 1: EMAIL ── */}
          {step === "email" && (
            <>
              <p style={{ color: "#ffffff66", fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
                Ingresá tu email para continuar. Si ya tenés cuenta iniciás sesión, si no creamos una nueva.
              </p>
              <input
                type="email" value={email} onChange={e => { setEmail(e.target.value); setError(""); }}
                onKeyDown={e => e.key === "Enter" && handleCheckEmail()}
                placeholder="tu@email.com"
                autoFocus autoComplete="email"
                style={inputStyle(touched.email && !isValidEmail(email))}
              />
              {touched.email && !isValidEmail(email) && (
                <p style={{ color: "#e74c3c", fontSize: 12, margin: "0 0 12px" }}>El email no es válido</p>
              )}
              {error && <p style={{ color: "#ff6b6b", fontSize: 13, margin: "4px 0 12px" }}>{error}</p>}
              <button className="btn-press" onClick={handleCheckEmail} disabled={loading || !email}
                style={{ width: "100%", padding: "16px", borderRadius: 16, marginTop: 8,
                  background: !email ? "#555" : "linear-gradient(135deg,#4F7FFA,#3a6ae8)",
                  color: "#fff", border: "none", fontSize: 16, fontWeight: 700,
                  cursor: !email ? "default" : "pointer", fontFamily: SF, opacity: loading ? 0.7 : 1 }}>
                {loading ? "Verificando..." : "Continuar →"}
              </button>
            </>
          )}

          {/* ── PASO 2: LOGIN ── */}
          {step === "login" && (
            <>
              <div style={{ background: "rgba(79,127,250,0.1)", border: "1px solid rgba(79,127,250,0.3)", borderRadius: 12, padding: "10px 14px", marginBottom: 20 }}>
                <p style={{ margin: 0, fontSize: 13, color: "#ffffffbb", fontFamily: SF }}>📧 {email}</p>
              </div>
              <p style={{ color: "#ffffff66", fontSize: 13, margin: "0 0 16px" }}>Ingresá tu contraseña</p>
              <input
                type="password" value={password} onChange={e => { setPassword(e.target.value); setError(""); }}
                onKeyDown={e => e.key === "Enter" && handleLogin()}
                placeholder="Contraseña"
                autoFocus autoComplete="current-password"
                style={inputStyle(touched.password && !password)}
              />
              {touched.password && !password && (
                <p style={{ color: "#e74c3c", fontSize: 12, margin: "0 0 12px" }}>Ingresá tu contraseña</p>
              )}
              {error && <p style={{ color: "#ff6b6b", fontSize: 13, margin: "4px 0 12px" }}>{error}</p>}
              <button className="btn-press" onClick={handleLogin} disabled={loading || !password}
                style={{ width: "100%", padding: "16px", borderRadius: 16, marginTop: 8,
                  background: !password ? "#555" : "linear-gradient(135deg,#4F7FFA,#3a6ae8)",
                  color: "#fff", border: "none", fontSize: 16, fontWeight: 700,
                  cursor: !password ? "default" : "pointer", fontFamily: SF, opacity: loading ? 0.7 : 1 }}>
                {loading ? "Iniciando sesión..." : "Iniciar sesión →"}
              </button>
              {resetSent ? (
                <p style={{ color: "#2ecc71", fontSize: 13, textAlign: "center", marginTop: 16 }}>
                  ✓ Te enviamos un email para restablecer tu contraseña
                </p>
              ) : (
                <button onClick={handleReset} disabled={loading}
                  style={{ background: "none", border: "none", color: "#4F7FFA", fontSize: 13, cursor: "pointer", fontFamily: SF, marginTop: 16, width: "100%", textAlign: "center" }}>
                  Olvidé mi contraseña
                </button>
              )}
            </>
          )}

          {/* ── PASO GOOGLE: email vinculado a Google ── */}
          {step === "google" && (
            <>
              <div style={{ background: "rgba(79,127,250,0.1)", border: "1px solid rgba(79,127,250,0.3)", borderRadius: 12, padding: "10px 14px", marginBottom: 20 }}>
                <p style={{ margin: 0, fontSize: 13, color: "#ffffffbb", fontFamily: SF }}>📧 {email}</p>
              </div>
              <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 14, padding: 16, marginBottom: 20, textAlign: "center" }}>
                <p style={{ fontSize: 28, margin: "0 0 8px" }}>🔗</p>
                <p style={{ color: "#ffffffcc", fontSize: 14, fontWeight: 600, margin: "0 0 6px", fontFamily: SF }}>
                  Este email está vinculado a Google
                </p>
                <p style={{ color: "#ffffff66", fontSize: 13, margin: 0, fontFamily: SF }}>
                  Usá el botón de Google para ingresar
                </p>
              </div>
              {error && <p style={{ color: "#ff6b6b", fontSize: 13, margin: "0 0 12px", textAlign: "center" }}>{error}</p>}
              <button className="btn-press" onClick={handleGoogleFromEmail} disabled={loading}
                style={{ width: "100%", padding: "16px", borderRadius: 16,
                  background: "#fff", color: "#1a1a2e",
                  border: "none", fontSize: 16, fontWeight: 700,
                  cursor: loading ? "default" : "pointer", fontFamily: SF,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
                  opacity: loading ? 0.7 : 1 }}>
                <svg width="20" height="20" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                {loading ? "Iniciando sesión..." : "Continuar con Google"}
              </button>
            </>
          )}

          {/* ── PASO 3: REGISTRO ── */}
          {step === "register" && (
            <>
              <div style={{ background: "rgba(79,127,250,0.1)", border: "1px solid rgba(79,127,250,0.3)", borderRadius: 12, padding: "10px 14px", marginBottom: 20 }}>
                <p style={{ margin: 0, fontSize: 13, color: "#ffffffbb", fontFamily: SF }}>📧 {email}</p>
              </div>
              <p style={{ color: "#ffffff66", fontSize: 13, margin: "0 0 16px" }}>Creá tu contraseña</p>
              <input
                type="password" value={password} onChange={e => { setPassword(e.target.value); setError(""); }}
                placeholder="Contraseña (mín. 6 caracteres)"
                autoFocus autoComplete="new-password"
                style={inputStyle(touched.password && password.length < 6)}
              />
              {touched.password && password.length < 6 && (
                <p style={{ color: "#e74c3c", fontSize: 12, margin: "0 0 8px" }}>Mínimo 6 caracteres</p>
              )}
              <input
                type="password" value={confirm} onChange={e => { setConfirm(e.target.value); setError(""); }}
                onKeyDown={e => e.key === "Enter" && handleRegister()}
                placeholder="Confirmar contraseña"
                autoComplete="new-password"
                style={{ ...inputStyle(touched.confirm && confirm !== password), marginTop: 8 }}
              />
              {touched.confirm && confirm !== password && (
                <p style={{ color: "#e74c3c", fontSize: 12, margin: "0 0 8px" }}>Las contraseñas no coinciden</p>
              )}
              {error && (
                <div>
                  <p style={{ color: "#ff6b6b", fontSize: 13, margin: "4px 0 8px" }}>{error}</p>
                  {error.includes("registrado") && (
                    resetSent ? (
                      <p style={{ color: "#2ecc71", fontSize: 13, textAlign: "center", margin: "0 0 12px" }}>
                        ✓ Te enviamos un email para restablecer tu contraseña
                      </p>
                    ) : (
                      <button onClick={handleReset} disabled={loading}
                        style={{ background: "none", border: "none", color: "#4F7FFA", fontSize: 13, cursor: "pointer", fontFamily: SF, marginBottom: 12, width: "100%", textAlign: "center" }}>
                        Restablecer contraseña →
                      </button>
                    )
                  )}
                </div>
              )}
              {verifSent ? (
                <div style={{ background: "rgba(46,204,113,0.1)", border: "1px solid rgba(46,204,113,0.3)", borderRadius: 14, padding: 16, marginTop: 12, textAlign: "center" }}>
                  <p style={{ fontSize: 28, margin: "0 0 8px" }}>✉️</p>
                  <p style={{ color: "#2ecc71", fontSize: 14, fontWeight: 600, margin: 0 }}>
                    Te enviamos un email de verificación
                  </p>
                  <p style={{ color: "#ffffff66", fontSize: 12, margin: "6px 0 0" }}>Redirigiendo...</p>
                </div>
              ) : (
                <button className="btn-press" onClick={handleRegister} disabled={loading || !password || !confirm}
                  style={{ width: "100%", padding: "16px", borderRadius: 16, marginTop: 12,
                    background: (!password || !confirm) ? "#555" : "linear-gradient(135deg,#4F7FFA,#3a6ae8)",
                    color: "#fff", border: "none", fontSize: 16, fontWeight: 700,
                    cursor: (!password || !confirm) ? "default" : "pointer", fontFamily: SF, opacity: loading ? 0.7 : 1 }}>
                  {loading ? "Creando cuenta..." : "Crear cuenta →"}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}