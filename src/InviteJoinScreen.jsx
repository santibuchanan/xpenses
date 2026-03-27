/**
 * InviteJoinScreen
 *
 * Pantalla dedicada para procesar invitaciones. Maneja TODO el flujo
 * en un solo componente sin depender de localStorage, sessionStorage
 * ni timing de React state entre componentes.
 *
 * Flujo:
 * 1. Muestra la cuenta a la que fue invitado
 * 2. Permite login/registro inline
 * 3. Al autenticarse, procesa el invite directamente
 * 4. Llama onJoined(accountId) cuando termina
 */

import { useState, useEffect } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithPopup,
  onAuthStateChanged,
} from "firebase/auth";
import {
  doc, getDoc, updateDoc, setDoc, arrayUnion, runTransaction, collection,
} from "firebase/firestore";
import { auth, googleProvider, db } from "./firebase";

const SF = `-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', sans-serif`;

const ERRORS = {
  "auth/wrong-password":       "Contraseña incorrecta",
  "auth/invalid-credential":   "Contraseña incorrecta",
  "auth/invalid-login-credentials": "Contraseña incorrecta",
  "auth/user-not-found":       "No existe una cuenta con ese email",
  "auth/email-already-in-use": "Ese email ya está registrado",
  "auth/weak-password":        "La contraseña debe tener al menos 6 caracteres",
  "auth/invalid-email":        "El email no es válido",
  "auth/too-many-requests":    "Demasiados intentos. Intentá más tarde",
};

const translateError = (code) => ERRORS[code] || "Ocurrió un error. Intentá de nuevo.";

export default function InviteJoinScreen({ inviteId, onJoined, onError }) {
  const [invite, setInvite]       = useState(null);
  const [account, setAccount]     = useState(null);
  const [loading, setLoading]     = useState(true);
  const [joining, setJoining]     = useState(false);
  const [error, setError]         = useState("");

  // Auth flow
  const [step, setStep]           = useState("email"); // email | login | register | google
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [confirm, setConfirm]     = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [resetSent, setResetSent] = useState(false);

  // Claim flow
  const [claimLabels, setClaimLabels] = useState(null);
  const [selectedLabel, setSelectedLabel] = useState(null);

  const isValidEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  // 1. Cargar datos del invite y la cuenta
  useEffect(() => {
    const load = async () => {
      try {
        const inviteSnap = await getDoc(doc(db, "invites", inviteId));
        if (!inviteSnap.exists()) { onError("Invitación inválida o expirada."); return; }

        const inviteData = inviteSnap.data();
        if (inviteData.used) { onError("Esta invitación ya fue utilizada."); return; }

        const accountSnap = await getDoc(doc(db, "accounts", inviteData.accountId));
        if (!accountSnap.exists()) { onError("La cuenta ya no existe."); return; }

        setInvite({ id: inviteId, ...inviteData });
        setAccount({ id: inviteData.accountId, ...accountSnap.data() });
        setLoading(false);
      } catch (e) {
        onError("Error al cargar la invitación.");
      }
    };
    load();
  }, [inviteId]);

  // 2. Si el usuario ya está logueado, procesar directamente
  useEffect(() => {
    if (!account) return;
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) await processJoin(user);
    });
    return unsub;
  }, [account]);

  // 3. Procesar el join
  const processJoin = async (user) => {
    if (!invite || !account || joining) return;
    setJoining(true);
    try {
      const unlinked = (account.memberLabels || []).filter(l => !l.linkedUid);

      // Si hay labels sin vincular, mostrar selector
      if (unlinked.length > 0 && !selectedLabel) {
        setClaimLabels(unlinked);
        setJoining(false);
        return;
      }

      // Ejecutar join
      await runTransaction(db, async (tx) => {
        const inviteRef  = doc(db, "invites", invite.id);
        const accountRef = doc(db, "accounts", account.id);
        const userRef    = doc(db, "users", user.uid);

        const [inviteSnap, userSnap] = await Promise.all([
          tx.get(inviteRef),
          tx.get(userRef),
        ]);

        if (inviteSnap.data()?.used) throw new Error("Invitación ya utilizada");

        const existingIds = userSnap.exists() ? (userSnap.data().accountIds || []) : [];

        // Link reutilizable — nunca se marca como usado (Opción A)
        tx.update(accountRef, { memberIds: arrayUnion(user.uid) });

        const userUpdate = {
          accountIds: existingIds.includes(account.id) ? existingIds : [...existingIds, account.id],
          setupDone: true,
        };

        if (selectedLabel) {
          const label = account.memberLabels?.find(l => l.id === selectedLabel);
          if (label?.name) userUpdate.name = label.name;
          const updatedLabels = (account.memberLabels || []).map(l =>
            l.id === selectedLabel ? { ...l, linkedUid: user.uid } : l
          );
          tx.update(accountRef, { memberLabels: updatedLabels });
        }

        tx.set(userRef, userUpdate, { merge: true });
      });

      // Limpiar localStorage
      localStorage.removeItem("pendingInviteId");
      // Recargar la app completa para que React inicialice con el nuevo estado
      window.location.replace(window.location.origin);
    } catch (e) {
      console.error("Error al unirse:", e);
      setError(e.message === "Invitación ya utilizada"
        ? "Esta invitación ya fue utilizada."
        : "Error al unirse. Intentá de nuevo.");
      setJoining(false);
    }
  };

  // Auth handlers
  const handleCheckEmail = async () => {
    if (!isValidEmail(email)) { setAuthError("El email no es válido"); return; }
    setAuthLoading(true); setAuthError("");
    try {
      await signInWithEmailAndPassword(auth, email, "__probe__");
      setStep("login");
    } catch (e) {
      if (["auth/wrong-password","auth/invalid-credential","auth/invalid-login-credentials","auth/too-many-requests"].includes(e.code)) {
        setStep("login");
        if (e.code === "auth/too-many-requests") setAuthError(translateError(e.code));
      } else {
        setStep("register");
      }
    } finally { setAuthLoading(false); }
  };

  const handleLogin = async () => {
    if (!password) { setAuthError("Ingresá tu contraseña"); return; }
    setAuthLoading(true); setAuthError("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // onAuthStateChanged se encarga del resto
    } catch (e) {
      setAuthError(translateError(e.code));
      setAuthLoading(false);
    }
  };

  const handleRegister = async () => {
    if (password.length < 6) { setAuthError("Mínimo 6 caracteres"); return; }
    if (password !== confirm) { setAuthError("Las contraseñas no coinciden"); return; }
    setAuthLoading(true); setAuthError("");
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      // onAuthStateChanged se encarga del resto
    } catch (e) {
      setAuthError(translateError(e.code));
      setAuthLoading(false);
    }
  };

  const handleGoogle = async () => {
    setAuthLoading(true); setAuthError("");
    try {
      await signInWithPopup(auth, googleProvider);
      // onAuthStateChanged se encarga del resto
    } catch (e) {
      setAuthError(translateError(e.code));
      setAuthLoading(false);
    }
  };

  const handleReset = async () => {
    setAuthLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setResetSent(true);
    } catch (e) {
      setAuthError(translateError(e.code));
    } finally { setAuthLoading(false); }
  };

  const inputStyle = {
    width: "100%", padding: "15px 16px", borderRadius: 14, fontSize: 16,
    fontFamily: SF, outline: "none", boxSizing: "border-box",
    color: "#1a1a2e", background: "#fff", border: "2px solid #e8e8e8", marginBottom: 12,
  };

  const btnPrimary = {
    width: "100%", padding: 16, borderRadius: 16, border: "none",
    background: "linear-gradient(135deg,#4F7FFA,#3a6ae8)", color: "#fff",
    fontSize: 16, fontWeight: 700, cursor: "pointer", fontFamily: SF, marginBottom: 10,
  };

  if (loading) return (
    <div style={{ position: "fixed", inset: 0, background: "#08090d", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "#ffffff88", fontFamily: SF }}>Cargando invitación...</p>
    </div>
  );

  if (joining) return (
    <div style={{ position: "fixed", inset: 0, background: "#08090d", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
      <p style={{ fontSize: 40 }}>🎉</p>
      <p style={{ color: "#fff", fontFamily: SF, fontSize: 18, fontWeight: 700 }}>Uniéndote a {account?.name}...</p>
    </div>
  );

  if (error) return (
    <div style={{ position: "fixed", inset: 0, background: "#08090d", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16, padding: 24 }}>
      <p style={{ fontSize: 40 }}>⚠️</p>
      <p style={{ color: "#fff", fontFamily: SF, fontSize: 16, textAlign: "center" }}>{error}</p>
    </div>
  );

  // Selector de label (claim identity)
  if (claimLabels) return (
    <div style={{ position: "fixed", inset: 0, background: "#08090d", display: "flex", flexDirection: "column", fontFamily: SF, paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 24px 40px" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <p style={{ fontSize: 48, margin: "0 0 12px" }}>{account?.emoji || "👋"}</p>
          <p style={{ fontSize: 22, fontWeight: 700, color: "#fff", margin: "0 0 8px" }}>¡Bienvenido a {account?.name}!</p>
          <p style={{ fontSize: 14, color: "#ffffff88", margin: 0 }}>¿Cuál es tu nombre en esta cuenta?</p>
        </div>

        {claimLabels.map(label => (
          <button key={label.id} onClick={() => setSelectedLabel(label.id)}
            style={{ width: "100%", padding: "16px", borderRadius: 16, border: "2px solid", marginBottom: 10, cursor: "pointer", fontFamily: SF, textAlign: "left", display: "flex", alignItems: "center", gap: 14,
              borderColor: selectedLabel === label.id ? label.color || "#4F7FFA" : "#333",
              background: selectedLabel === label.id ? (label.color || "#4F7FFA") + "22" : "#1a1a2e" }}>
            <div style={{ width: 44, height: 44, borderRadius: 22, background: (label.color || "#4F7FFA") + "33", border: `2px solid ${label.color || "#4F7FFA"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: label.color || "#4F7FFA" }}>{label.name[0].toUpperCase()}</span>
            </div>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 16, color: selectedLabel === label.id ? (label.color || "#4F7FFA") : "#fff" }}>{label.name}</p>
            {selectedLabel === label.id && <span style={{ marginLeft: "auto", color: label.color || "#4F7FFA", fontSize: 20 }}>✓</span>}
          </button>
        ))}

        <button onClick={() => processJoin(auth.currentUser)} disabled={!selectedLabel}
          style={{ ...btnPrimary, marginTop: 8, opacity: selectedLabel ? 1 : 0.5, cursor: selectedLabel ? "pointer" : "default" }}>
          ¡Soy yo, unirme!
        </button>
        <button onClick={() => { setSelectedLabel(null); processJoin(auth.currentUser); }}
          style={{ width: "100%", padding: 14, borderRadius: 14, border: "none", background: "transparent", color: "#ffffff66", fontSize: 14, cursor: "pointer", fontFamily: SF }}>
          Mi nombre no está en la lista
        </button>
      </div>
    </div>
  );

  // Pantalla de auth
  return (
    <div style={{ position: "fixed", inset: 0, background: "#08090d", display: "flex", flexDirection: "column", fontFamily: SF, paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>

      {/* Header con info de la cuenta */}
      <div style={{ padding: "24px 24px 0", textAlign: "center" }}>
        <p style={{ fontSize: 48, margin: "0 0 8px" }}>{account?.emoji || "👥"}</p>
        <p style={{ fontSize: 22, fontWeight: 700, color: "#fff", margin: "0 0 6px" }}>Te invitaron a</p>
        <p style={{ fontSize: 26, fontWeight: 800, color: "#4F7FFA", margin: "0 0 8px" }}>{account?.name}</p>
        <p style={{ fontSize: 14, color: "#ffffff66", margin: 0 }}>Iniciá sesión o creá una cuenta para unirte</p>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 24px 40px" }}>

        {/* Google */}
        <button onClick={handleGoogle} disabled={authLoading}
          style={{ width: "100%", padding: 16, borderRadius: 16, background: "#fff", color: "#1a1a2e", border: "none", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: SF, display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 16, opacity: authLoading ? 0.7 : 1 }}>
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continuar con Google
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1, height: 1, background: "#333" }} />
          <span style={{ color: "#ffffff44", fontSize: 13 }}>o con email</span>
          <div style={{ flex: 1, height: 1, background: "#333" }} />
        </div>

        {/* Email step */}
        {step === "email" && (
          <>
            <input type="email" value={email} onChange={e => { setEmail(e.target.value); setAuthError(""); }}
              onKeyDown={e => e.key === "Enter" && handleCheckEmail()}
              placeholder="tu@email.com" autoFocus autoComplete="email"
              style={inputStyle} />
            {authError && <p style={{ color: "#ff6b6b", fontSize: 13, margin: "-8px 0 12px" }}>{authError}</p>}
            <button onClick={handleCheckEmail} disabled={authLoading || !email} style={{ ...btnPrimary, opacity: (!email || authLoading) ? 0.6 : 1 }}>
              {authLoading ? "Verificando..." : "Continuar"}
            </button>
          </>
        )}

        {/* Login step */}
        {step === "login" && (
          <>
            <div style={{ background: "#4F7FFA22", border: "1px solid #4F7FFA44", borderRadius: 12, padding: "10px 14px", marginBottom: 12 }}>
              <p style={{ margin: 0, fontSize: 13, color: "#ffffffbb" }}>📧 {email}</p>
            </div>
            <input type="password" value={password} onChange={e => { setPassword(e.target.value); setAuthError(""); }}
              onKeyDown={e => e.key === "Enter" && handleLogin()}
              placeholder="Contraseña" autoFocus autoComplete="current-password"
              style={inputStyle} />
            {authError && <p style={{ color: "#ff6b6b", fontSize: 13, margin: "-8px 0 12px" }}>{authError}</p>}
            <button onClick={handleLogin} disabled={authLoading || !password} style={{ ...btnPrimary, opacity: (!password || authLoading) ? 0.6 : 1 }}>
              {authLoading ? "Iniciando sesión..." : "Iniciar sesión"}
            </button>
            {resetSent
              ? <p style={{ color: "#2ecc71", fontSize: 13, textAlign: "center" }}>✓ Email de recuperación enviado</p>
              : <button onClick={handleReset} disabled={authLoading} style={{ background: "none", border: "none", color: "#4F7FFA", fontSize: 13, cursor: "pointer", fontFamily: SF, width: "100%", textAlign: "center", padding: "8px 0" }}>
                  Olvidé mi contraseña
                </button>
            }
            <button onClick={() => { setStep("email"); setPassword(""); setAuthError(""); }}
              style={{ background: "none", border: "none", color: "#ffffff44", fontSize: 13, cursor: "pointer", fontFamily: SF, width: "100%", textAlign: "center", padding: "4px 0" }}>
              ← Cambiar email
            </button>
          </>
        )}

        {/* Register step */}
        {step === "register" && (
          <>
            <div style={{ background: "#4F7FFA22", border: "1px solid #4F7FFA44", borderRadius: 12, padding: "10px 14px", marginBottom: 12 }}>
              <p style={{ margin: 0, fontSize: 13, color: "#ffffffbb" }}>📧 {email}</p>
            </div>
            <input type="password" value={password} onChange={e => { setPassword(e.target.value); setAuthError(""); }}
              placeholder="Contraseña (mín. 6 caracteres)" autoFocus autoComplete="new-password"
              style={inputStyle} />
            <input type="password" value={confirm} onChange={e => { setConfirm(e.target.value); setAuthError(""); }}
              onKeyDown={e => e.key === "Enter" && handleRegister()}
              placeholder="Confirmar contraseña" autoComplete="new-password"
              style={inputStyle} />
            {authError && <p style={{ color: "#ff6b6b", fontSize: 13, margin: "-8px 0 12px" }}>{authError}</p>}
            <button onClick={handleRegister} disabled={authLoading || !password || !confirm} style={{ ...btnPrimary, opacity: (!password || !confirm || authLoading) ? 0.6 : 1 }}>
              {authLoading ? "Creando cuenta..." : "Crear cuenta y unirme"}
            </button>
            <button onClick={() => { setStep("email"); setPassword(""); setConfirm(""); setAuthError(""); }}
              style={{ background: "none", border: "none", color: "#ffffff44", fontSize: 13, cursor: "pointer", fontFamily: SF, width: "100%", textAlign: "center", padding: "4px 0" }}>
              ← Cambiar email
            </button>
          </>
        )}
      </div>
    </div>
  );
}