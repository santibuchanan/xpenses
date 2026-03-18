/**
 * AccountSelectorScreen.jsx
 * Lista de cuentas del usuario + tabs de notificaciones y perfil.
 * La creación de nueva cuenta fue extraída a CreateAccountScreen.jsx
 */
import { useState, useRef } from "react";
import { collection, doc, setDoc, deleteDoc } from "firebase/firestore";
import { db } from "./firebase";
import { useTheme } from "./theme.jsx";
import { useNotif, SwipeableNotifRow } from "./notifications.jsx";
import CreateAccountScreen from "./CreateAccountScreen";

const FONT = `'DM Sans', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif`;

// ── SwipeableAccountRow ───────────────────────────────────────────────────────

function SwipeableAccountRow({ acc, onSelect, onDeleteRequest, colors }) {
  const [swipeX, setSwipeX] = useState(0);
  const startX              = { current: null };
  const isDragging          = { current: false };
  const DELETE_THRESHOLD    = 80;

  const onTouchStart = (e) => {
    startX.current     = e.touches[0].clientX;
    isDragging.current = true;
  };
  const onTouchMove = (e) => {
    if (!isDragging.current || startX.current === null) return;
    const diff = startX.current - e.touches[0].clientX;
    if (diff > 0) setSwipeX(Math.min(diff, DELETE_THRESHOLD + 20));
    else if (diff < -10) setSwipeX(0);
  };
  const onTouchEnd = () => {
    isDragging.current = false;
    if (swipeX > DELETE_THRESHOLD / 2) {
      setSwipeX(0);
      onDeleteRequest(acc.id);
    } else {
      setSwipeX(0);
    }
    startX.current = null;
  };

  const memberLabels   = acc.memberLabels || [];
  const unlinkedCount  = memberLabels.filter(l => !l.linkedUid).length;
  const totalMembers   = (acc.memberIds?.length || 1) + unlinkedCount;

  return (
    <div style={{ position: "relative", marginBottom: 12, borderRadius: 20, overflow: "hidden" }}>
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={() => onSelect(acc.id)}
        style={{
          transform: `translateX(-${swipeX}px)`,
          transition: isDragging.current ? "none" : "transform 0.3s ease",
          background: colors.card, borderRadius: 20, padding: "18px 20px",
          border: `1px solid ${colors.cardBorder}`, boxShadow: colors.shadow,
          display: "flex", alignItems: "center", gap: 14,
          cursor: "pointer", position: "relative", zIndex: 1,
        }}
      >
        <div style={{
          width: 48, height: 48, borderRadius: 16,
          background: acc.type === "pozo" ? "#f39c1218" : acc.type === "shared" ? "#4F7FFA18" : "#2ecc7118",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0,
        }}>
          {acc.emoji || (acc.type === "pozo" ? "🪣" : acc.type === "shared" ? "👥" : "👤")}
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ margin: "0 0 4px", fontWeight: 700, fontSize: 16, color: colors.text, fontFamily: FONT }}>{acc.name}</p>
          <p style={{ margin: 0, fontSize: 12, color: colors.textMuted, fontFamily: FONT }}>
            {acc.type === "pozo" ? "Pozo Común" : acc.type === "shared" ? "Compartida" : "Personal"} · {totalMembers} miembro{totalMembers !== 1 ? "s" : ""}
          </p>
        </div>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 18l6-6-6-6"/>
        </svg>
      </div>
    </div>
  );
}

// ── ProfileTab ────────────────────────────────────────────────────────────────

function ProfileTab({ user, userProfile, onSignOut, onDeleteAccount, colors }) {
  const { setManualTheme } = useTheme();
  const [editingField,      setEditingField]      = useState(null);
  const [sheetDragY,  setSheetDragY]  = useState(0);
  const sheetDragging = useRef(false);
  const sheetStartY   = useRef(null);
  const onSheetTouchStart = (e) => { sheetStartY.current = e.touches[0].clientY; sheetDragging.current = true; };
  const onSheetTouchMove  = (e) => { if (!sheetDragging.current) return; const dy = e.touches[0].clientY - sheetStartY.current; if (dy > 0) setSheetDragY(dy); };
  const onSheetTouchEnd   = () => { if (sheetDragY > 80) setEditingField(null); else setSheetDragY(0); sheetDragging.current = false; sheetStartY.current = null; };
  const closeSheet = () => { setSheetDragY(0); setEditingField(null); };
  const [fieldValue,        setFieldValue]        = useState("");
  const [saving,            setSaving]            = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting,          setDeleting]          = useState(false);

  const currentTheme = localStorage.getItem("xpenses-theme") || "auto";
  const currentLang  = localStorage.getItem("xpenses-lang")  || "es";

  const displayName = userProfile?.name  || user.displayName || "Usuario";
  const alias       = userProfile?.alias || "";

  const openEdit = (field, current) => { setSheetDragY(0); setEditingField(field); setFieldValue(current || ""); };

  const saveField = async () => {
    setSaving(true);
    if (editingField === "name" || editingField === "alias") {
      await setDoc(doc(db, "users", user.uid), { [editingField]: fieldValue.trim() }, { merge: true });
    } else if (editingField === "theme") {
      if (fieldValue === "auto") { setManualTheme(null); localStorage.removeItem("xpenses-theme"); }
      else { setManualTheme(fieldValue); localStorage.setItem("xpenses-theme", fieldValue); }
      await setDoc(doc(db, "users", user.uid), { theme: fieldValue }, { merge: true });
    } else if (editingField === "language") {
      localStorage.setItem("xpenses-lang", fieldValue);
      await setDoc(doc(db, "users", user.uid), { language: fieldValue }, { merge: true });
    }
    setSaving(false);
    setEditingField(null);
  };

  const themeLabels = { auto: "Automático", dark: "Oscuro", light: "Claro" }; // Modo
  const langLabels  = { es: "Español", en: "English" };

  const fieldRow = (key, label, value, currentVal) => (
    <button key={key} onClick={() => openEdit(key, currentVal)}
      style={{ width: "100%", background: colors.card, border: `1px solid ${colors.cardBorder}`, borderRadius: 16, padding: "14px 16px", marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", fontFamily: FONT, boxShadow: colors.shadow }}>
      <div style={{ textAlign: "left" }}>
        <p style={{ margin: 0, fontSize: 11, color: colors.textMuted, fontWeight: 600, letterSpacing: 0.4, textTransform: "uppercase", fontFamily: FONT }}>{label}</p>
        <p style={{ margin: "3px 0 0", fontSize: 15, color: colors.text, fontWeight: 600, fontFamily: FONT }}>{value}</p>
      </div>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={colors.textMuted} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
    </button>
  );

  return (
    <div style={{ paddingTop: 8 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 16, paddingBottom: 24 }}>
        {user.photoURL
          ? <img src={user.photoURL} style={{ width: 80, height: 80, borderRadius: 40, border: "3px solid #4F7FFA44", marginBottom: 12 }} alt="" />
          : <div style={{ width: 80, height: 80, borderRadius: 40, background: "#4F7FFA22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, marginBottom: 12 }}>👤</div>}
        <p style={{ margin: 0, fontWeight: 700, fontSize: 20, color: colors.text, fontFamily: FONT }}>{displayName}</p>
        {alias && <p style={{ margin: "2px 0 0", fontSize: 13, color: colors.textMuted, fontFamily: FONT }}>@{alias}</p>}
        <p style={{ margin: "4px 0 0", fontSize: 12, color: colors.textMuted, fontFamily: FONT }}>{user.email}</p>
      </div>

      <p style={{ fontSize: 11, fontWeight: 700, color: colors.textMuted, letterSpacing: 1.2, textTransform: "uppercase", margin: "0 0 8px", fontFamily: FONT }}>Mi cuenta</p>
      {fieldRow("name",  "Nombre completo", displayName,            displayName)}
      {fieldRow("alias", "Alias",           alias || "Sin alias",   alias)}

      <p style={{ fontSize: 11, fontWeight: 700, color: colors.textMuted, letterSpacing: 1.2, textTransform: "uppercase", margin: "20px 0 8px", fontFamily: FONT }}>Preferencias</p>
      {fieldRow("theme",    "Modo", themeLabels[currentTheme] || "Automático", currentTheme)}
      {fieldRow("language", "Idioma",      langLabels[currentLang]   || "Español",    currentLang)}

      <button onClick={onSignOut}
        style={{ width: "100%", marginTop: 24, padding: 14, borderRadius: 14, background: "#ff6b6b18", border: "2px solid #ff6b6b44", color: "#ff6b6b", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}>
        Cerrar sesión
      </button>
      <button onClick={() => setShowDeleteConfirm(true)}
        style={{ background: "none", border: "none", cursor: "pointer", marginTop: 16, color: colors.textMuted, fontSize: 12, fontFamily: FONT, textDecoration: "underline", display: "block", width: "100%", textAlign: "center" }}>
        Eliminar mi cuenta
      </button>
      <div style={{ height: 40 }} />

      {showDeleteConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ background: colors.card, borderRadius: 24, padding: 24, width: "100%", maxWidth: 340, fontFamily: FONT, border: `1px solid ${colors.cardBorder}` }}>
            <p style={{ fontSize: 36, textAlign: "center", margin: "0 0 12px" }}>⚠️</p>
            <p style={{ fontSize: 18, fontWeight: 700, color: colors.text, margin: "0 0 8px", textAlign: "center", fontFamily: FONT }}>¿Eliminar tu cuenta?</p>
            <p style={{ fontSize: 13, color: colors.textMuted, margin: "0 0 24px", textAlign: "center", lineHeight: 1.5, fontFamily: FONT }}>
              Se eliminará tu perfil. En cuentas compartidas, tu usuario quedará desvinculado pero el integrante seguirá en la cuenta. Esta acción no se puede deshacer.
            </p>
            <button onClick={async () => { setDeleting(true); await onDeleteAccount(); setDeleting(false); }}
              disabled={deleting}
              style={{ width: "100%", padding: 14, borderRadius: 14, background: "#e74c3c", color: "#fff", border: "none", fontSize: 15, fontWeight: 600, cursor: deleting ? "default" : "pointer", fontFamily: FONT, marginBottom: 8, opacity: deleting ? 0.7 : 1 }}>
              {deleting ? "Eliminando..." : "Sí, eliminar"}
            </button>
            <button onClick={() => setShowDeleteConfirm(false)}
              style={{ width: "100%", padding: 14, borderRadius: 14, background: colors.pill, color: colors.textMuted, border: "none", fontSize: 15, cursor: "pointer", fontFamily: FONT }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {editingField && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 200, display: "flex", alignItems: "flex-end" }}
          onClick={closeSheet}>
          <div
            onClick={e => e.stopPropagation()}
            onTouchStart={onSheetTouchStart}
            onTouchMove={onSheetTouchMove}
            onTouchEnd={onSheetTouchEnd}
            style={{ background: colors.card, borderRadius: "24px 24px 0 0", width: "100%", padding: "0 20px calc(40px + env(safe-area-inset-bottom))", fontFamily: FONT,
              transform: `translateY(${sheetDragY}px)`,
              transition: sheetDragging.current ? "none" : "transform 0.3s ease" }}>
            <div data-handle style={{ padding: "20px 0 4px", cursor: "grab", touchAction: "none" }}>
              <div style={{ width: 36, height: 4, background: colors.divider, borderRadius: 2, margin: "0 auto" }} />
            </div>

            {(editingField === "name" || editingField === "alias") && (
              <>
                <p style={{ fontSize: 17, fontWeight: 700, color: colors.text, margin: "0 0 16px", fontFamily: FONT }}>
                  {editingField === "name" ? "Nombre completo" : "Alias"}
                </p>
                <input autoFocus value={fieldValue} onChange={e => setFieldValue(e.target.value)}
                  placeholder={editingField === "name" ? "Tu nombre" : "Tu alias"}
                  style={{ width: "100%", padding: "13px 14px", borderRadius: 14, border: `2px solid ${colors.inputBorder}`, fontSize: 15, fontFamily: FONT, outline: "none", boxSizing: "border-box", color: colors.inputText, background: colors.input, marginBottom: 16 }} />
                <button onClick={saveField} disabled={saving || !fieldValue.trim()}
                  style={{ width: "100%", padding: 14, borderRadius: 14, background: saving || !fieldValue.trim() ? "#aaa" : "linear-gradient(135deg,#4F7FFA,#3a6ae8)", color: "#fff", border: "none", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>
                  {saving ? "Guardando..." : "Guardar"}
                </button>
              </>
            )}

            {editingField === "theme" && (
              <>
                <p style={{ fontSize: 17, fontWeight: 700, color: colors.text, margin: "0 0 16px", fontFamily: FONT }}>Modo</p>
                {[["auto","Automático"],["dark","Oscuro"],["light","Claro"]].map(([val, lbl]) => (
                  <button key={val} onClick={() => {
                    setFieldValue(val);
                    if (val === "auto") { setManualTheme(null); localStorage.removeItem("xpenses-theme"); }
                    else { setManualTheme(val); localStorage.setItem("xpenses-theme", val); }
                    closeSheet(); // cerrar inmediatamente, sin esperar Firestore
                    setDoc(doc(db, "users", user.uid), { theme: val }, { merge: true }); // fire and forget
                  }}
                    style={{ width: "100%", padding: "14px 16px", borderRadius: 14, border: `2px solid ${fieldValue === val ? "#4F7FFA" : colors.inputBorder}`, background: fieldValue === val ? "#4F7FFA11" : colors.input, marginBottom: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", fontFamily: FONT }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: fieldValue === val ? "#4F7FFA" : colors.text, fontFamily: FONT }}>{lbl}</p>
                    {fieldValue === val && <span style={{ color: "#4F7FFA", fontSize: 18 }}>✓</span>}
                  </button>
                ))}
              </>
            )}

            {editingField === "language" && (
              <>
                <p style={{ fontSize: 17, fontWeight: 700, color: colors.text, margin: "0 0 16px", fontFamily: FONT }}>Idioma</p>
                {[["es","Español",""],["en","English","Próximamente"]].map(([val, lbl, badge]) => (
                  <button key={val} onClick={() => val === "es" && setFieldValue(val)}
                    style={{ width: "100%", padding: "14px 16px", borderRadius: 14, border: `2px solid ${fieldValue === val ? "#4F7FFA" : colors.inputBorder}`, background: fieldValue === val ? "#4F7FFA11" : colors.input, marginBottom: 8, cursor: val === "en" ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", fontFamily: FONT, opacity: val === "en" ? 0.5 : 1 }}>
                    <div>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: colors.text, fontFamily: FONT }}>
                        {lbl} {badge && <span style={{ fontSize: 10, color: "#4F7FFA", fontWeight: 700 }}>{badge}</span>}
                      </p>
                    </div>
                    {fieldValue === val && <span style={{ color: "#4F7FFA", fontSize: 18 }}>✓</span>}
                  </button>
                ))}
                <button onClick={saveField} disabled={saving}
                  style={{ width: "100%", marginTop: 8, padding: 14, borderRadius: 14, background: "linear-gradient(135deg,#4F7FFA,#3a6ae8)", color: "#fff", border: "none", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>
                  {saving ? "Guardando..." : "Guardar"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── AccountSelectorScreen ─────────────────────────────────────────────────────

export default function AccountSelectorScreen({ user, userProfile, accounts, onSelect, onCreated, onSignOut, isLoading }) {
  const { colors } = useTheme();
  const { notifications, unreadCount, markRead, markAllRead, deleteNotif } = useNotif();

  const [showCreate,    setShowCreate]    = useState(false);
  const [activeTab,     setActiveTab]     = useState("cuentas");
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deletedIds,    setDeletedIds]    = useState([]);

  const visibleAccounts = accounts.filter(a => !deletedIds.includes(a.id));

  // ── Handlers ──
  const handleCreated = (accountId) => {
    setShowCreate(false);
    onCreated(accountId, "home");
  };

  const handleDeleteConfirmed = async () => {
    if (!confirmDelete) return;
    const idToDelete = confirmDelete;
    setConfirmDelete(null);
    setDeletedIds(prev => [...prev, idToDelete]);
    try {
      await deleteDoc(doc(db, "accounts", idToDelete));
      await setDoc(doc(db, "users", user.uid), {
        accountIds: accounts.filter(a => a.id !== idToDelete).map(a => a.id),
      }, { merge: true });
    } catch (err) {
      console.error("Error eliminando cuenta:", err);
      setDeletedIds(prev => prev.filter(id => id !== idToDelete));
    }
  };

  const handleDeleteAccount = async () => {
    try {
      const { deleteUser, getAuth } = await import("firebase/auth");
      await import("firebase/firestore").then(async ({ doc: docFn, deleteDoc: deleteFn }) => {
        await deleteFn(docFn(db, "users", user.uid));
      });
      for (const acc of accounts) {
        const labels = acc.memberLabels || [];
        if (labels.some(l => l.linkedUid === user.uid)) {
          const { updateDoc, doc: docFn } = await import("firebase/firestore");
          await updateDoc(docFn(db, "accounts", acc.id), {
            memberLabels: labels.map(l => l.linkedUid === user.uid ? { ...l, linkedUid: null } : l),
            memberIds: (acc.memberIds || []).filter(id => id !== user.uid),
          });
        }
      }
      const auth = getAuth();
      if (auth.currentUser) await deleteUser(auth.currentUser);
    } catch (err) {
      console.error("Error eliminando cuenta:", err);
    }
  };

  // ── Si está en modo creación, mostrar CreateAccountScreen ──
  if (showCreate) {
    return (
      <CreateAccountScreen
        mode="add"
        user={user}
        userProfile={userProfile}
        existingAccounts={accounts}
        onCreated={handleCreated}
        onCancel={() => setShowCreate(false)}
      />
    );
  }

  // ── Vista principal: lista + tabs ──
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
        paddingTop: "calc(env(safe-area-inset-top) + 16px)",
        paddingBottom: 16, paddingLeft: 20, paddingRight: 20,
      }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <img src="/logo.png" style={{ width: 38, height: 38, borderRadius: 10 }} alt=""
            onError={e => { e.target.style.display = "none"; }} />
          <p style={{ fontSize: 17, fontWeight: 800, color: "#fff", margin: 0, fontFamily: FONT, letterSpacing: -0.5 }}>X-penses</p>
        </div>
      </div>

      <div style={{ padding: 20, paddingBottom: 100 }}>

        {/* ── TAB: Notificaciones ── */}
        {activeTab === "notificaciones" && (() => {
          const groups = [];
          const seen = {};
          notifications.forEach(n => {
            const key = n.accountId || "__sin_cuenta__";
            if (!seen[key]) {
              seen[key] = true;
              const acc = accounts.find(a => a.id === key);
              groups.push({ accountId: key, accountName: acc?.name || "Cuenta eliminada", accountEmoji: acc?.emoji || "📂", items: [] });
            }
            groups.find(g => g.accountId === key).items.push(n);
          });

          return (
            <div style={{ paddingTop: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 18, fontWeight: 700, color: colors.text, fontFamily: FONT }}>Notificaciones</span>
                  {unreadCount > 0 && (
                    <span style={{ background: "#4F7FFA", color: "#fff", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 12, fontFamily: FONT }}>{unreadCount}</span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button onClick={markAllRead}
                    style={{ background: "none", border: "none", fontSize: 12, color: "#4F7FFA", fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>
                    Marcar todo leído
                  </button>
                )}
              </div>

              {notifications.length === 0 ? (
                <div style={{ textAlign: "center", padding: "60px 20px", color: colors.textMuted }}>
                  <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.4 }}>🔔</div>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: colors.textMuted, fontFamily: FONT }}>Sin notificaciones</p>
                  <p style={{ margin: "4px 0 0", fontSize: 13, color: colors.textMuted, fontFamily: FONT }}>Acá vas a ver las novedades de tus cuentas</p>
                </div>
              ) : (
                groups.map(group => (
                  <div key={group.accountId} style={{ marginBottom: 20 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, paddingBottom: 8, borderBottom: `2px solid ${colors.divider}` }}>
                      <span style={{ fontSize: 16 }}>{group.accountEmoji}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: colors.textMuted, letterSpacing: 0.4, textTransform: "uppercase", fontFamily: FONT }}>
                        {group.accountName}
                      </span>
                      {group.items.filter(n => !n.read).length > 0 && (
                        <span style={{ background: "#4F7FFA22", color: "#4F7FFA", fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 10, fontFamily: FONT, marginLeft: "auto" }}>
                          {group.items.filter(n => !n.read).length} nueva{group.items.filter(n => !n.read).length > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                    <div style={{ background: colors.card, borderRadius: 16, overflow: "hidden", border: `1px solid ${colors.cardBorder}` }}>
                      {group.items.map(n => (
                        <SwipeableNotifRow key={n.id} n={n} colors={colors} onMarkRead={markRead} onDelete={deleteNotif} />
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          );
        })()}

        {/* ── TAB: Perfil ── */}
        {activeTab === "perfil" && (
          <ProfileTab
            user={user}
            userProfile={userProfile}
            onSignOut={onSignOut}
            onDeleteAccount={handleDeleteAccount}
            colors={colors}
          />
        )}

        {/* ── TAB: Cuentas ── */}
        {activeTab === "cuentas" && (
          <>
            {/* Skeletons mientras cargan las cuentas */}
            {isLoading && [1,2,3].map(i => (
              <div key={i} style={{ background: colors.card, borderRadius: 20, padding: "18px 20px", marginBottom: 12, border: `1px solid ${colors.cardBorder}`, display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 48, height: 48, borderRadius: 16, background: colors.divider, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ width: "60%", height: 14, borderRadius: 7, background: colors.divider, marginBottom: 8 }} />
                  <div style={{ width: "40%", height: 11, borderRadius: 6, background: colors.divider }} />
                </div>
              </div>
            ))}

            {!isLoading && visibleAccounts.length === 0 && (
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
          </>
        )}
      </div>

      {/* ── BOTTOM NAV ── */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 60,
        background: colors.headerBg,
        borderTop: "1px solid rgba(255,255,255,0.10)",
        paddingBottom: "env(safe-area-inset-bottom)",
        display: "flex",
      }}>
        {[
          { id: "cuentas", label: "Mis Cuentas", badge: 0, icon: (active) => (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "#4F7FFA" : "#ffffff66"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="3"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></svg>
          )},
          { id: "notificaciones", label: "Notificaciones", badge: unreadCount, icon: (active) => (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "#4F7FFA" : "#ffffff66"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
          )},
          { id: "perfil", label: "Perfil", badge: 0, icon: (active) => (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? "#4F7FFA" : "#ffffff66"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          )},
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "12px 0", background: "none", border: "none", cursor: "pointer", position: "relative" }}>
            <div style={{ position: "relative" }}>
              {tab.icon(activeTab === tab.id)}
              {tab.badge > 0 && (
                <div style={{ position: "absolute", top: -4, right: -6, background: "#4F7FFA", borderRadius: 10, minWidth: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px" }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: "#fff", fontFamily: FONT }}>{tab.badge}</span>
                </div>
              )}
            </div>
            <span style={{ fontSize: 10, fontWeight: 600, color: activeTab === tab.id ? "#4F7FFA" : "#ffffff66", fontFamily: FONT, letterSpacing: 0.3 }}>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ── Botón flotante + Nueva cuenta (solo en tab cuentas) ── */}
      {activeTab === "cuentas" && (
        <div style={{
          position: "fixed", bottom: "calc(env(safe-area-inset-bottom) + 72px)", left: 20, right: 20, zIndex: 55,
        }}>
          <button type="button" onClick={() => setShowCreate(true)}
            style={{ width: "100%", padding: 16, borderRadius: 16, background: "linear-gradient(135deg,#4F7FFA,#3a6ae8)", color: "#fff", border: "none", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: FONT, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "0 4px 20px rgba(79,127,250,0.5)" }}>
            <span style={{ fontSize: 20 }}>+</span> Nueva cuenta
          </button>
        </div>
      )}

      {/* ── Modal confirmar eliminación ── */}
      {confirmDelete && (() => {
        const acc = visibleAccounts.find(a => a.id === confirmDelete) || accounts.find(a => a.id === confirmDelete);
        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
            <div style={{ background: colors.card, borderRadius: 24, padding: 24, width: "100%", maxWidth: 340, fontFamily: FONT, border: `1px solid ${colors.cardBorder}` }}>
              <p style={{ fontSize: 40, textAlign: "center", margin: "0 0 12px" }}>🗑️</p>
              <p style={{ fontSize: 18, fontWeight: 700, color: colors.text, margin: "0 0 6px", textAlign: "center", fontFamily: FONT }}>¿Eliminar cuenta?</p>
              {acc?.name && <p style={{ fontSize: 15, fontWeight: 700, color: "#4F7FFA", margin: "0 0 8px", textAlign: "center", fontFamily: FONT }}>{acc.name}</p>}
              <p style={{ fontSize: 13, color: colors.textMuted, margin: "0 0 24px", textAlign: "center", lineHeight: 1.5, fontFamily: FONT }}>Se van a borrar todos los datos. Esta acción no se puede deshacer.</p>
              <button onClick={handleDeleteConfirmed}
                style={{ width: "100%", padding: 14, borderRadius: 14, background: "#e74c3c", color: "#fff", border: "none", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: FONT, marginBottom: 8 }}>
                Sí, eliminar
              </button>
              <button onClick={() => setConfirmDelete(null)}
                style={{ width: "100%", padding: 14, borderRadius: 14, background: colors.pill, color: colors.textMuted, border: "none", fontSize: 15, cursor: "pointer", fontFamily: FONT }}>
                Cancelar
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}