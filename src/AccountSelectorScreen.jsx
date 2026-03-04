import { useState, useRef } from "react";
import { collection, addDoc, doc, setDoc, deleteDoc } from "firebase/firestore";
import { db } from "./firebase";
import { useTheme } from "./theme.jsx";

const SF = `-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', sans-serif`;

const DIVISION_SYSTEMS = [
  { id: "proportional", label: "Proporcional al ingreso", icon: "📊", desc: "Ideal para parejas que conviven. Cada uno aporta según su sueldo." },
  { id: "50_50", label: "Partes iguales", icon: "⚖️", desc: "Cada uno paga exactamente la mitad." },
  { id: "informativo", label: "Gastos en común", icon: "🤝", desc: "Registrá y gestioná gastos sin calcular quién le debe a quién." },
];

// Ícono hamburger dentro de cuadrado redondeado — igual al de la captura
function MenuIcon({ color = "#ffffffcc" }) {
  return (
    <svg width="30" height="30" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1.5" y="1.5" width="27" height="27" rx="7.5" stroke={color} strokeWidth="2"/>
      <line x1="8"  y1="10" x2="22" y2="10" stroke={color} strokeWidth="2" strokeLinecap="round"/>
      <line x1="8"  y1="15" x2="22" y2="15" stroke={color} strokeWidth="2" strokeLinecap="round"/>
      <line x1="8"  y1="20" x2="22" y2="20" stroke={color} strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

// Fila con swipe para eliminar estilo iOS
function SwipeableAccountRow({ acc, onSelect, onDelete, colors }) {
  const [swipeX, setSwipeX] = useState(0);
  const [swiped, setSwiped] = useState(false);
  const startX = useRef(null);
  const rowRef = useRef(null);
  const DELETE_THRESHOLD = 80;

  const onTouchStart = (e) => { startX.current = e.touches[0].clientX; };

  const onTouchMove = (e) => {
    if (startX.current === null) return;
    const diff = startX.current - e.touches[0].clientX;
    if (diff > 0) setSwipeX(Math.min(diff, DELETE_THRESHOLD + 20));
  };

  const onTouchEnd = () => {
    if (swipeX > DELETE_THRESHOLD / 2) { setSwipeX(DELETE_THRESHOLD); setSwiped(true); }
    else { setSwipeX(0); setSwiped(false); }
    startX.current = null;
  };

  const handleClose = () => { setSwipeX(0); setSwiped(false); };

  return (
    <div style={{ position: "relative", marginBottom: 12, borderRadius: 20, overflow: "hidden" }}>
      <div style={{
        position: "absolute", right: 0, top: 0, bottom: 0,
        width: DELETE_THRESHOLD, background: "#e74c3c",
        display: "flex", alignItems: "center", justifyContent: "center",
        borderRadius: "0 20px 20px 0",
      }}>
        <button onClick={(e) => { e.stopPropagation(); onDelete(acc.id); }}
          style={{ background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
          <span style={{ fontSize: 20 }}>🗑️</span>
          <span style={{ fontSize: 10, color: "#fff", fontWeight: 700, fontFamily: SF }}>Eliminar</span>
        </button>
      </div>

      <div
        ref={rowRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          transform: `translateX(-${swipeX}px)`,
          transition: startX.current === null ? "transform 0.3s ease" : "none",
          background: colors.card, borderRadius: 20, padding: "18px 20px",
          border: `1px solid ${colors.cardBorder}`, boxShadow: colors.shadow,
          display: "flex", alignItems: "center", gap: 14,
          cursor: "pointer", position: "relative", zIndex: 1,
        }}
        onClick={() => { if (!swiped) onSelect(acc.id); else handleClose(); }}
      >
        <div style={{ width: 48, height: 48, borderRadius: 16, background: acc.type === "shared" ? "#4F7FFA18" : "#2ecc7118", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>
          {acc.type === "shared" ? "👥" : "👤"}
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ margin: "0 0 4px", fontWeight: 700, fontSize: 16, color: colors.text }}>{acc.name}</p>
          <p style={{ margin: 0, fontSize: 12, color: colors.textMuted }}>
            {acc.type === "shared" ? "Compartida" : "Personal"} · {acc.memberIds?.length || 1} miembro{(acc.memberIds?.length || 1) !== 1 ? "s" : ""}
          </p>
        </div>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 18l6-6-6-6"/>
        </svg>
      </div>
    </div>
  );
}

export default function AccountSelectorScreen({ user, accounts, onSelect, onCreated }) {
  const { colors } = useTheme();
  const [creating, setCreating] = useState(false);
  const [accountName, setAccountName] = useState("");
  const [accountType, setAccountType] = useState("shared");
  const [divisionSystem, setDivisionSystem] = useState("proportional");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const handleCreate = async () => {
    if (!accountName.trim()) return;
    setSaving(true);
    const ref = await addDoc(collection(db, "accounts"), {
      name: accountName, type: accountType, divisionSystem,
      ownerId: user.uid, memberIds: [user.uid],
      currency: "ARS", createdAt: new Date().toISOString(),
    });
    await setDoc(doc(db, "users", user.uid), {
      accountIds: [...accounts.map(a => a.id), ref.id],
    }, { merge: true });
    setSaving(false);
    onCreated(ref.id);
  };

  const handleDeleteConfirmed = async () => {
    if (!confirmDelete) return;
    await deleteDoc(doc(db, "accounts", confirmDelete));
    await setDoc(doc(db, "users", user.uid), {
      accountIds: accounts.filter(a => a.id !== confirmDelete).map(a => a.id)
    }, { merge: true });
    setConfirmDelete(null);
  };

  const inputStyle = {
    width: "100%", padding: "13px 14px", borderRadius: 14,
    border: `2px solid ${colors.inputBorder}`, fontSize: 15, marginBottom: 14,
    fontFamily: SF, outline: "none", boxSizing: "border-box",
    color: colors.inputText, background: colors.input,
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: colors.bg, fontFamily: SF,
      overflowY: "auto",
      paddingBottom: "env(safe-area-inset-bottom)",
      paddingLeft: "env(safe-area-inset-left)",
      paddingRight: "env(safe-area-inset-right)",
      boxSizing: "border-box",
    }}>
      <style>{`* { box-sizing: border-box; }`}</style>

      {/* ── HEADER FIJO ── */}
      <div style={{
        position: "sticky", top: 0, zIndex: 50,
        background: colors.headerBg,
        paddingTop: "calc(env(safe-area-inset-top) + 12px)",
        paddingBottom: 16,
        paddingLeft: 20,
        paddingRight: 20,
      }}>
        {/* Recuadro unificado: menú + título + campana */}
        <div style={{
          display: "flex", alignItems: "center", gap: 14,
          background: "rgba(255,255,255,0.07)",
          border: "1px solid rgba(255,255,255,0.13)",
          borderRadius: 20,
          padding: "16px 16px",
        }}>
          {/* Ícono hamburger (en lugar de foto de perfil) */}
          <button style={{
            background: "none", border: "none", cursor: "pointer",
            padding: 0, display: "flex", alignItems: "center", flexShrink: 0,
          }}>
            <MenuIcon />
          </button>

          {/* Título central */}
          <div style={{ flex: 1 }}>
            <p style={{ color: "#ffffff44", fontSize: 10, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", margin: "0 0 3px" }}>X-penses</p>
            <p style={{ fontSize: 16, fontWeight: 700, color: "#fff", margin: 0, letterSpacing: -0.3 }}>Mis X-penses</p>
          </div>

          {/* Campana */}
          <button style={{
            background: "rgba(255,255,255,0.10)",
            border: "1px solid rgba(255,255,255,0.13)",
            borderRadius: 50, width: 40, height: 40,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", flexShrink: 0, padding: 0,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="#ffffffcc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
          </button>
        </div>

        <p style={{ color: "#ffffff44", fontSize: 12, margin: "10px 2px 0", fontStyle: "italic" }}>
          Deslizá a la izquierda para eliminar
        </p>
      </div>

      {/* ── CONTENIDO ── */}
      <div style={{ padding: 20 }}>
        {!creating ? (
          <>
            {accounts.length === 0 && (
              <div style={{ textAlign: "center", padding: "40px 20px", color: colors.textMuted }}>
                <p style={{ fontSize: 48, margin: "0 0 12px" }}>📂</p>
                <p style={{ fontSize: 16, fontWeight: 600, color: colors.text, margin: "0 0 6px" }}>No tenés cuentas todavía</p>
                <p style={{ fontSize: 14, margin: 0 }}>Creá tu primera cuenta para empezar</p>
              </div>
            )}

            {accounts.map(acc => (
              <SwipeableAccountRow
                key={acc.id} acc={acc} colors={colors}
                onSelect={onSelect} onDelete={(id) => setConfirmDelete(id)}
              />
            ))}

            <button onClick={() => setCreating(true)}
              style={{ width: "100%", padding: 16, borderRadius: 16, background: "linear-gradient(135deg,#4F7FFA,#3a6ae8)", color: "#fff", border: "none", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: SF, marginTop: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <span style={{ fontSize: 20 }}>+</span> Nueva cuenta
            </button>
          </>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <button onClick={() => setCreating(false)}
                style={{ background: colors.card, border: `2px solid ${colors.inputBorder}`, borderRadius: 12, padding: "8px 14px", fontSize: 13, cursor: "pointer", fontFamily: SF, color: colors.text }}>
                ← Volver
              </button>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 17, color: colors.text }}>Nueva cuenta</p>
            </div>

            <div style={{ background: colors.card, borderRadius: 20, padding: 18, marginBottom: 12, boxShadow: colors.shadow, border: `1px solid ${colors.cardBorder}` }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: colors.textMuted, marginBottom: 6, letterSpacing: 0.6, textTransform: "uppercase" }}>Nombre de la cuenta</p>
              <input value={accountName} onChange={e => setAccountName(e.target.value)}
                placeholder="Ej: Casa, Vacaciones, Gastos compartidos..."
                style={{ ...inputStyle, marginBottom: 0 }} autoFocus />
            </div>

            <div style={{ background: colors.card, borderRadius: 20, padding: 18, marginBottom: 12, boxShadow: colors.shadow, border: `1px solid ${colors.cardBorder}` }}>
              <p style={{ fontSize: 17, fontWeight: 600, margin: "0 0 14px", color: colors.text }}>Tipo de cuenta</p>
              <div style={{ display: "flex", gap: 10 }}>
                {[["personal","👤","Personal","Solo para vos"],["shared","👥","Compartida","Con otros"]].map(([val,icon,lbl,desc]) => (
                  <button key={val} onClick={() => setAccountType(val)}
                    style={{ flex: 1, padding: 14, borderRadius: 14, border: "2px solid", cursor: "pointer", fontFamily: SF, textAlign: "left",
                      borderColor: accountType === val ? "#4F7FFA" : colors.inputBorder,
                      background: accountType === val ? "#4F7FFA11" : colors.input }}>
                    <p style={{ fontSize: 22, margin: "0 0 4px" }}>{icon}</p>
                    <p style={{ margin: "0 0 2px", fontWeight: 600, fontSize: 13, color: accountType === val ? "#4F7FFA" : colors.text }}>{lbl}</p>
                    <p style={{ margin: 0, fontSize: 11, color: colors.textMuted }}>{desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {accountType === "shared" && (
              <div style={{ background: colors.card, borderRadius: 20, padding: 18, marginBottom: 12, boxShadow: colors.shadow, border: `1px solid ${colors.cardBorder}` }}>
                <p style={{ fontSize: 17, fontWeight: 600, margin: "0 0 4px", color: colors.text }}>División de gastos</p>
                <p style={{ fontSize: 13, color: colors.textMuted, margin: "0 0 14px" }}>¿Cómo quieren manejar los gastos compartidos?</p>
                {DIVISION_SYSTEMS.map(s => (
                  <button key={s.id} onClick={() => setDivisionSystem(s.id)}
                    style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "2px solid", cursor: "pointer", fontFamily: SF, textAlign: "left", marginBottom: 8, display: "flex", alignItems: "center", gap: 10,
                      borderColor: divisionSystem === s.id ? "#4F7FFA" : colors.inputBorder,
                      background: divisionSystem === s.id ? "#4F7FFA11" : colors.input }}>
                    <span style={{ fontSize: 20 }}>{s.icon}</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: divisionSystem === s.id ? "#4F7FFA" : colors.text }}>{s.label}</p>
                      <p style={{ margin: "2px 0 0", fontSize: 11, color: colors.textMuted }}>{s.desc}</p>
                    </div>
                    {divisionSystem === s.id && <span style={{ color: "#4F7FFA", fontSize: 18 }}>✓</span>}
                  </button>
                ))}
              </div>
            )}

            <button onClick={handleCreate} disabled={saving || !accountName.trim()}
              style={{ width: "100%", padding: 16, borderRadius: 16,
                background: saving || !accountName.trim() ? "#aaa" : "linear-gradient(135deg,#4F7FFA,#3a6ae8)",
                color: "#fff", border: "none", fontSize: 16, fontWeight: 600,
                cursor: saving || !accountName.trim() ? "default" : "pointer", fontFamily: SF, marginTop: 8 }}>
              {saving ? "Creando..." : "Crear cuenta →"}
            </button>
            <div style={{ height: 40 }} />
          </>
        )}
      </div>

      {/* Modal confirmación eliminación */}
      {confirmDelete && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: colors.card, borderRadius: 24, padding: 24, width: "100%", maxWidth: 340, fontFamily: SF, border: `1px solid ${colors.cardBorder}` }}>
            <p style={{ fontSize: 40, textAlign: "center", margin: "0 0 12px" }}>🗑️</p>
            <p style={{ fontSize: 18, fontWeight: 700, color: colors.text, margin: "0 0 8px", textAlign: "center" }}>¿Eliminar cuenta?</p>
            <p style={{ fontSize: 14, color: colors.textMuted, margin: "0 0 24px", textAlign: "center", lineHeight: 1.5 }}>Se van a borrar todos los datos de esta cuenta. Esta acción no se puede deshacer.</p>
            <button onClick={handleDeleteConfirmed}
              style={{ width: "100%", padding: 14, borderRadius: 14, background: "#e74c3c", color: "#fff", border: "none", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: SF, marginBottom: 8 }}>
              Sí, eliminar
            </button>
            <button onClick={() => setConfirmDelete(null)}
              style={{ width: "100%", padding: 14, borderRadius: 14, background: colors.pill, color: colors.textMuted, border: "none", fontSize: 15, cursor: "pointer", fontFamily: SF }}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
