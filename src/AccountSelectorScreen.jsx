import { useState, useRef } from "react";
import { collection, addDoc, doc, setDoc, deleteDoc } from "firebase/firestore";
import { db } from "./firebase";
import { useTheme } from "./theme.jsx";

const FONT = `'DM Sans', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif`;

const DIVISION_SYSTEMS = [
  { id: "proportional", label: "Proporcional al ingreso", icon: "📊", desc: "Ideal para parejas que conviven. Cada uno aporta según su sueldo." },
  { id: "50_50",        label: "Partes iguales",          icon: "⚖️", desc: "Cada uno paga exactamente la mitad." },
  { id: "informativo",  label: "Gastos en común",         icon: "🤝", desc: "Registrá y gestioná gastos sin calcular quién le debe a quién." },
];

const MEMBER_COLORS = ["#4F7FFA","#FA4F7F","#2ecc71","#f39c12","#9b59b6","#1abc9c"];

function MenuIcon({ color = "#ffffffcc" }) {
  return (
    <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
      <rect x="1.5" y="1.5" width="27" height="27" rx="7.5" stroke={color} strokeWidth="2"/>
      <line x1="8" y1="10" x2="22" y2="10" stroke={color} strokeWidth="2" strokeLinecap="round"/>
      <line x1="8" y1="15" x2="22" y2="15" stroke={color} strokeWidth="2" strokeLinecap="round"/>
      <line x1="8" y1="20" x2="22" y2="20" stroke={color} strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

function SwipeableAccountRow({ acc, onSelect, onDeleteRequest, colors }) {
  const [swipeX, setSwipeX]  = useState(0);
  const [swiped, setSwiped]  = useState(false);
  const startX               = useRef(null);
  const isDragging           = useRef(false);
  const DELETE_THRESHOLD     = 80;

  const onTouchStart = (e) => {
    startX.current     = e.touches[0].clientX;
    isDragging.current = true;
  };
  const onTouchMove = (e) => {
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
    <div style={{ position: "relative", marginBottom: 12, borderRadius: 20, overflow: "hidden" }}>
      {/* Botón eliminar detrás */}
      <div style={{
        position: "absolute", right: 0, top: 0, bottom: 0, width: DELETE_THRESHOLD,
        background: "#e74c3c", display: "flex", alignItems: "center", justifyContent: "center",
        borderRadius: "0 20px 20px 0",
      }}>
        <button
          onClick={(e) => { e.stopPropagation(); onDeleteRequest(acc.id); }}
          style={{ background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: 0 }}>
          <span style={{ fontSize: 20 }}>🗑️</span>
          <span style={{ fontSize: 10, color: "#fff", fontWeight: 700, fontFamily: FONT }}>Eliminar</span>
        </button>
      </div>

      {/* Fila deslizable */}
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={() => { if (swiped) { setSwipeX(0); setSwiped(false); } else { onSelect(acc.id); } }}
        style={{
          transform: `translateX(-${swipeX}px)`,
          transition: isDragging.current ? "none" : "transform 0.3s ease",
          background: colors.card, borderRadius: 20, padding: "18px 20px",
          border: `1px solid ${colors.cardBorder}`, boxShadow: colors.shadow,
          display: "flex", alignItems: "center", gap: 14,
          cursor: "pointer", position: "relative", zIndex: 1,
        }}>
        <div style={{
          width: 48, height: 48, borderRadius: 16,
          background: acc.type === "shared" ? "#4F7FFA18" : "#2ecc7118",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0,
        }}>
          {acc.type === "shared" ? "👥" : "👤"}
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ margin: "0 0 4px", fontWeight: 700, fontSize: 16, color: colors.text, fontFamily: FONT }}>{acc.name}</p>
          <p style={{ margin: 0, fontSize: 12, color: colors.textMuted, fontFamily: FONT }}>
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

  const [step,           setStep]          = useState("list");
  const [accountName,    setAccountName]   = useState("");
  const [accountType,    setAccountType]   = useState("shared");
  const [divisionSystem, setDivisionSystem]= useState("proportional");
  const [saving,         setSaving]        = useState(false);
  const [confirmDelete,  setConfirmDelete] = useState(null);
  // Estado local para reflejar eliminaciones inmediatamente sin esperar al padre
  const [deletedIds,     setDeletedIds]    = useState([]);

  const visibleAccounts = accounts.filter(a => !deletedIds.includes(a.id));

  // Integrantes
  const [members,       setMembers]       = useState([{ name: "", color: MEMBER_COLORS[0] }]);
  const [newMemberName, setNewMemberName] = useState("");

  const addMember = () => {
    const trimmed = newMemberName.trim();
    if (!trimmed) return;
    const color = MEMBER_COLORS[members.length % MEMBER_COLORS.length];
    setMembers(prev => [...prev, { name: trimmed, color }]);
    setNewMemberName("");
  };
  const removeMember     = (idx) => setMembers(prev => prev.filter((_, i) => i !== idx));
  const updateMemberName = (idx, val) => setMembers(prev => prev.map((m, i) => i === idx ? { ...m, name: val } : m));

  const handleCreate = async () => {
    if (!accountName.trim()) return;
    setSaving(true);
    const validMembers = members.filter(m => m.name.trim());
    const ref = await addDoc(collection(db, "accounts"), {
      name: accountName, type: accountType, divisionSystem,
      ownerId: user.uid, memberIds: [user.uid],
      memberLabels: validMembers.map((m, i) => ({
        id: `label_${i}`, name: m.name.trim(), color: m.color, linkedUid: null,
      })),
      currency: "ARS", createdAt: new Date().toISOString(),
    });
    await setDoc(doc(db, "users", user.uid), {
      accountIds: [...accounts.map(a => a.id), ref.id],
    }, { merge: true });
    setSaving(false);
    onCreated(ref.id);
  };

  // FIX: marcar como eliminada en estado local ANTES de llamar Firestore
  // Así el row desaparece inmediatamente y no queda colgado
  const handleDeleteConfirmed = async () => {
    if (!confirmDelete) return;
    const idToDelete = confirmDelete;
    setConfirmDelete(null);
    setDeletedIds(prev => [...prev, idToDelete]);   // ocultar inmediatamente
    try {
      await deleteDoc(doc(db, "accounts", idToDelete));
      await setDoc(doc(db, "users", user.uid), {
        accountIds: accounts.filter(a => a.id !== idToDelete).map(a => a.id),
      }, { merge: true });
    } catch (err) {
      console.error("Error eliminando cuenta:", err);
      setDeletedIds(prev => prev.filter(id => id !== idToDelete)); // revertir si falla
    }
  };

  const goToMembers = () => {
    if (!accountName.trim()) return;
    if (accountType === "shared") setStep("members");
    else handleCreate();
  };

  const inputStyle = {
    width: "100%", padding: "13px 14px", borderRadius: 14,
    border: `2px solid ${colors.inputBorder}`, fontSize: 15, marginBottom: 14,
    fontFamily: FONT, outline: "none", boxSizing: "border-box",
    color: colors.inputText, background: colors.input,
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: colors.bg, fontFamily: FONT,
      overflowY: "auto",
      paddingBottom: "env(safe-area-inset-bottom)",
      paddingLeft:   "env(safe-area-inset-left)",
      paddingRight:  "env(safe-area-inset-right)",
      boxSizing: "border-box",
    }}>
      <style>{`* { box-sizing: border-box; }`}</style>

      {/* HEADER */}
      <div style={{
        position: "sticky", top: 0, zIndex: 50, background: colors.headerBg,
        paddingTop: "calc(env(safe-area-inset-top) + 12px)",
        paddingBottom: 16, paddingLeft: 20, paddingRight: 20,
      }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 14,
          background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.13)",
          borderRadius: 20, padding: "16px 16px",
        }}>
          <button style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", flexShrink: 0 }}>
            <MenuIcon />
          </button>
          <div style={{ flex: 1 }}>
            <p style={{ color: "#ffffff44", fontSize: 10, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", margin: "0 0 3px", fontFamily: FONT }}>X-penses</p>
            <p style={{ fontSize: 16, fontWeight: 700, color: "#fff", margin: 0, fontFamily: FONT }}>Mis X-penses</p>
          </div>
          <button style={{ background: "rgba(255,255,255,0.10)", border: "1px solid rgba(255,255,255,0.13)", borderRadius: 50, width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, padding: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffffcc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 01-3.46 0"/>
            </svg>
          </button>
        </div>
        {step === "list" && (
          <p style={{ color: "#ffffff44", fontSize: 12, margin: "10px 2px 0", fontStyle: "italic", fontFamily: FONT }}>
            Deslizá a la izquierda para eliminar
          </p>
        )}
      </div>

      <div style={{ padding: 20 }}>

        {/* ── LISTA ── */}
        {step === "list" && (
          <>
            {visibleAccounts.length === 0 && (
              <div style={{ textAlign: "center", padding: "40px 20px", color: colors.textMuted }}>
                <p style={{ fontSize: 48, margin: "0 0 12px" }}>📂</p>
                <p style={{ fontSize: 16, fontWeight: 600, color: colors.text, margin: "0 0 6px", fontFamily: FONT }}>No tenés cuentas todavía</p>
                <p style={{ fontSize: 14, margin: 0, fontFamily: FONT }}>Creá tu primera cuenta para empezar</p>
              </div>
            )}

            {visibleAccounts.map(acc => (
              <SwipeableAccountRow
                key={acc.id}
                acc={acc}
                colors={colors}
                onSelect={onSelect}
                onDeleteRequest={(id) => setConfirmDelete(id)}
              />
            ))}

            <button onClick={() => setStep("create")}
              style={{ width: "100%", padding: 16, borderRadius: 16, background: "linear-gradient(135deg,#4F7FFA,#3a6ae8)", color: "#fff", border: "none", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: FONT, marginTop: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <span style={{ fontSize: 20 }}>+</span> Nueva cuenta
            </button>
          </>
        )}

        {/* ── CREAR ── */}
        {step === "create" && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <button onClick={() => setStep("list")} style={{ background: colors.card, border: `2px solid ${colors.inputBorder}`, borderRadius: 12, padding: "8px 14px", fontSize: 13, cursor: "pointer", fontFamily: FONT, color: colors.text }}>← Volver</button>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 17, color: colors.text, fontFamily: FONT }}>Nueva cuenta</p>
            </div>

            <div style={{ background: colors.card, borderRadius: 20, padding: 18, marginBottom: 12, boxShadow: colors.shadow, border: `1px solid ${colors.cardBorder}` }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: colors.textMuted, marginBottom: 6, letterSpacing: 0.6, textTransform: "uppercase", fontFamily: FONT }}>Nombre</p>
              <input value={accountName} onChange={e => setAccountName(e.target.value)} placeholder="Ej: Casa, Vacaciones..." style={{ ...inputStyle, marginBottom: 0 }} autoFocus />
            </div>

            <div style={{ background: colors.card, borderRadius: 20, padding: 18, marginBottom: 12, boxShadow: colors.shadow, border: `1px solid ${colors.cardBorder}` }}>
              <p style={{ fontSize: 17, fontWeight: 600, margin: "0 0 14px", color: colors.text, fontFamily: FONT }}>Tipo de cuenta</p>
              <div style={{ display: "flex", gap: 10 }}>
                {[["personal","👤","Personal","Solo para vos"],["shared","👥","Compartida","Con otros"]].map(([val,icon,lbl,desc]) => (
                  <button key={val} onClick={() => setAccountType(val)} style={{ flex: 1, padding: 14, borderRadius: 14, border: "2px solid", cursor: "pointer", fontFamily: FONT, textAlign: "left", borderColor: accountType === val ? "#4F7FFA" : colors.inputBorder, background: accountType === val ? "#4F7FFA11" : colors.input }}>
                    <p style={{ fontSize: 22, margin: "0 0 4px" }}>{icon}</p>
                    <p style={{ margin: "0 0 2px", fontWeight: 600, fontSize: 13, color: accountType === val ? "#4F7FFA" : colors.text, fontFamily: FONT }}>{lbl}</p>
                    <p style={{ margin: 0, fontSize: 11, color: colors.textMuted, fontFamily: FONT }}>{desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {accountType === "shared" && (
              <div style={{ background: colors.card, borderRadius: 20, padding: 18, marginBottom: 12, boxShadow: colors.shadow, border: `1px solid ${colors.cardBorder}` }}>
                <p style={{ fontSize: 17, fontWeight: 600, margin: "0 0 4px", color: colors.text, fontFamily: FONT }}>División de gastos</p>
                <p style={{ fontSize: 13, color: colors.textMuted, margin: "0 0 14px", fontFamily: FONT }}>¿Cómo quieren manejar los gastos compartidos?</p>
                {DIVISION_SYSTEMS.map(s => (
                  <button key={s.id} onClick={() => setDivisionSystem(s.id)} style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "2px solid", cursor: "pointer", fontFamily: FONT, textAlign: "left", marginBottom: 8, display: "flex", alignItems: "center", gap: 10, borderColor: divisionSystem === s.id ? "#4F7FFA" : colors.inputBorder, background: divisionSystem === s.id ? "#4F7FFA11" : colors.input }}>
                    <span style={{ fontSize: 20 }}>{s.icon}</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: divisionSystem === s.id ? "#4F7FFA" : colors.text, fontFamily: FONT }}>{s.label}</p>
                      <p style={{ margin: "2px 0 0", fontSize: 11, color: colors.textMuted, fontFamily: FONT }}>{s.desc}</p>
                    </div>
                    {divisionSystem === s.id && <span style={{ color: "#4F7FFA", fontSize: 18 }}>✓</span>}
                  </button>
                ))}
              </div>
            )}

            <button onClick={goToMembers} disabled={saving || !accountName.trim()}
              style={{ width: "100%", padding: 16, borderRadius: 16, background: saving || !accountName.trim() ? "#aaa" : "linear-gradient(135deg,#4F7FFA,#3a6ae8)", color: "#fff", border: "none", fontSize: 16, fontWeight: 600, cursor: saving || !accountName.trim() ? "default" : "pointer", fontFamily: FONT, marginTop: 8 }}>
              {accountType === "shared" ? "Siguiente → Integrantes" : saving ? "Creando..." : "Crear cuenta →"}
            </button>
            <div style={{ height: 40 }} />
          </>
        )}

        {/* ── INTEGRANTES ── */}
        {step === "members" && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
              <button onClick={() => setStep("create")} style={{ background: colors.card, border: `2px solid ${colors.inputBorder}`, borderRadius: 12, padding: "8px 14px", fontSize: 13, cursor: "pointer", fontFamily: FONT, color: colors.text }}>← Volver</button>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 17, color: colors.text, fontFamily: FONT }}>Integrantes</p>
            </div>
            <p style={{ fontSize: 13, color: colors.textMuted, margin: "0 0 20px", fontFamily: FONT }}>
              Agregá los nombres. Cada uno podrá vincular su Google cuando acepte la invitación.
            </p>

            <div style={{ background: colors.card, borderRadius: 20, padding: 18, marginBottom: 12, boxShadow: colors.shadow, border: `1px solid ${colors.cardBorder}` }}>
              {members.map((m, idx) => (
                <div key={idx} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 18, background: m.color + "33", border: `2px solid ${m.color}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: m.color, fontFamily: FONT }}>{m.name ? m.name[0].toUpperCase() : "?"}</span>
                  </div>
                  <input value={m.name} onChange={e => updateMemberName(idx, e.target.value)}
                    placeholder={idx === 0 ? "Tu nombre (vos)" : `Integrante ${idx + 1}`}
                    style={{ flex: 1, padding: "10px 12px", borderRadius: 12, border: `2px solid ${colors.inputBorder}`, fontSize: 14, fontFamily: FONT, outline: "none", color: colors.inputText, background: colors.input, boxSizing: "border-box" }} />
                  {members.length > 1 && (
                    <button onClick={() => removeMember(idx)} style={{ background: colors.dangerBg, border: "none", borderRadius: 10, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 16, color: colors.danger, flexShrink: 0 }}>×</button>
                  )}
                </div>
              ))}
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <input value={newMemberName} onChange={e => setNewMemberName(e.target.value)} onKeyDown={e => e.key === "Enter" && addMember()}
                  placeholder="Agregar integrante..."
                  style={{ flex: 1, padding: "10px 12px", borderRadius: 12, border: `2px dashed ${colors.inputBorder}`, fontSize: 14, fontFamily: FONT, outline: "none", color: colors.inputText, background: colors.input, boxSizing: "border-box" }} />
                <button onClick={addMember} style={{ background: "#4F7FFA", border: "none", borderRadius: 12, width: 42, height: 42, fontSize: 22, color: "#fff", cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
              </div>
            </div>

            <div style={{ background: "#4F7FFA11", borderRadius: 14, padding: "12px 14px", marginBottom: 16, display: "flex", gap: 10 }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>💡</span>
              <p style={{ margin: 0, fontSize: 12, color: colors.textMuted, fontFamily: FONT, lineHeight: 1.5 }}>
                Después de crear la cuenta podés invitar a cada integrante. Al aceptar, vincularán su Google al nombre que les corresponde.
              </p>
            </div>

            <button onClick={handleCreate} disabled={saving || members.filter(m => m.name.trim()).length === 0}
              style={{ width: "100%", padding: 16, borderRadius: 16, background: saving ? "#aaa" : "linear-gradient(135deg,#4F7FFA,#3a6ae8)", color: "#fff", border: "none", fontSize: 16, fontWeight: 600, cursor: saving ? "default" : "pointer", fontFamily: FONT }}>
              {saving ? "Creando..." : "Crear cuenta →"}
            </button>
            <div style={{ height: 40 }} />
          </>
        )}
      </div>

      {/* Modal confirmar eliminación */}
      {confirmDelete && (() => {
        const acc = visibleAccounts.find(a => a.id === confirmDelete) || accounts.find(a => a.id === confirmDelete);
        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
            <div style={{ background: colors.card, borderRadius: 24, padding: 24, width: "100%", maxWidth: 340, fontFamily: FONT, border: `1px solid ${colors.cardBorder}` }}>
              <p style={{ fontSize: 40, textAlign: "center", margin: "0 0 12px" }}>🗑️</p>
              <p style={{ fontSize: 18, fontWeight: 700, color: colors.text, margin: "0 0 6px", textAlign: "center", fontFamily: FONT }}>¿Eliminar cuenta?</p>
              {acc?.name && <p style={{ fontSize: 15, fontWeight: 700, color: "#4F7FFA", margin: "0 0 8px", textAlign: "center", fontFamily: FONT }}>{acc.name}</p>}
              <p style={{ fontSize: 13, color: colors.textMuted, margin: "0 0 24px", textAlign: "center", lineHeight: 1.5, fontFamily: FONT }}>Se van a borrar todos los datos. Esta acción no se puede deshacer.</p>
              <button onClick={handleDeleteConfirmed} style={{ width: "100%", padding: 14, borderRadius: 14, background: "#e74c3c", color: "#fff", border: "none", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: FONT, marginBottom: 8 }}>Sí, eliminar</button>
              <button onClick={() => setConfirmDelete(null)} style={{ width: "100%", padding: 14, borderRadius: 14, background: colors.pill, color: colors.textMuted, border: "none", fontSize: 15, cursor: "pointer", fontFamily: FONT }}>Cancelar</button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
