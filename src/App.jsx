import { useState, useEffect, useRef, useMemo, lazy, Suspense } from "react";
import { doc, getDoc, updateDoc, setDoc, arrayUnion, onSnapshot, deleteDoc } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { db, auth } from "./firebase";
import AuthScreen from "./AuthScreen";
import ConfigScreen from "./ConfigScreen";
import OnboardingScreen from "./OnboardingScreen";
import AccountSelectorScreen from "./AccountSelectorScreen";
import WelcomeScreen from "./WelcomeScreen";
import EmailAuthScreen from "./EmailAuthScreen";
import InviteJoinScreen from "./InviteJoinScreen";
import EditExpenseModal from "./EditExpenseModal";
import { NotifProvider, useNotif, NotifCenter } from "./notifications";
import { useTheme, formatAmount } from "./theme.jsx";
import { useExpenses } from "./hooks/useExpenses.js";
import { useAccountData } from "./hooks/useAccountData.js";
import { useFirestoreData } from "./hooks/useFirestoreData.js";
import AddExpenseModal from "./components/expenses/AddExpenseModal.jsx";

// HomeScreen: eager — es la pantalla inicial
import HomeScreen from "./screens/HomeScreen.jsx";

// Screens no iniciales: lazy — se cargan solo cuando el usuario las abre
const SaldosScreen   = lazy(() => import("./screens/SaldosScreen.jsx"));
const GraficosScreen = lazy(() => import("./screens/GraficosScreen.jsx"));
const SettingsScreen = lazy(() => import("./SettingsScreen"));

// Utilidad centralizada de normalización de miembros
import { buildAllMembers } from "./utils/normalizeMembers.js";
import { DEFAULT_CATEGORIES } from "./constants/categories.js";

const FONT = `'DM Sans', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif`;
const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');`;
const NAV_HEIGHT = 72;
const getCurrentMonth = () => new Date().toISOString().slice(0, 7);

function Spinner({ text = "Cargando..." }) {
  const { colors } = useTheme();
  return <div style={{ textAlign: "center", padding: 60, color: colors.textMuted, fontSize: 14, fontFamily: FONT }}>{text}</div>;
}

function MenuIcon({ color = "#ffffffcc" }) {
  // 3 líneas con la primera más corta (izquierda), estilo menú moderno
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
      <line x1="4" y1="8"  x2="22" y2="8"  stroke={color} strokeWidth="2.2" strokeLinecap="round"/>
      <line x1="4" y1="13" x2="16" y2="13" stroke={color} strokeWidth="2.2" strokeLinecap="round"/>
      <line x1="4" y1="18" x2="22" y2="18" stroke={color} strokeWidth="2.2" strokeLinecap="round"/>
    </svg>
  );
}

function NavIcon({ id, active, color }) {
  const s = active ? 2 : 1.5;
  const c = active ? color : "#aaa";
  if (id === "home")    return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={s} strokeLinecap="round" strokeLinejoin="round"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/><path d="M9 21V12h6v9"/></svg>;
  if (id === "saldos")  return <span style={{ fontSize: 20, lineHeight: "22px", color: c, fontWeight: 800 }}>$</span>;
  if (id === "graficos") return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={s} strokeLinecap="round" strokeLinejoin="round"><path d="M4 20V14M9 20V8M14 20v-5M19 20V4"/></svg>;
  if (id === "ajustes") return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={s} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>;
  return null;
}

// ── HEADER ──
function AppHeader({ account, onMenuOpen, onNotifsOpen, unreadCount, colors }) {
  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 60, maxWidth: 500, margin: "0 auto", background: colors.headerBg, paddingTop: "calc(env(safe-area-inset-top) + 12px)", paddingBottom: 14, paddingLeft: 20, paddingRight: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <button onClick={onMenuOpen} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", flexShrink: 0 }}><MenuIcon /></button>
        <div style={{ flex: 1 }}>
          <p style={{ color: "#ffffff55", fontSize: 10, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", margin: "0 0 1px", fontFamily: FONT }}>X-penses</p>
          <p style={{ fontSize: 16, fontWeight: 700, color: "#fff", margin: 0, letterSpacing: -0.3, fontFamily: FONT }}>{account?.name || "Mis cuentas"}</p>
        </div>
        <button onClick={onNotifsOpen} style={{ position: "relative", background: "rgba(255,255,255,0.12)", border: "none", borderRadius: 50, width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, padding: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffffcc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
          {unreadCount > 0 && (
            <div style={{ position: "absolute", top: 5, right: 5, width: 14, height: 14, borderRadius: 7, background: "#FA4F7F", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 8, color: "#fff", fontWeight: 700, fontFamily: FONT }}>{unreadCount > 9 ? "9+" : unreadCount}</span>
            </div>
          )}
        </button>
      </div>
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.15) 30%, rgba(255,255,255,0.15) 70%, transparent)" }} />
    </div>
  );
}

// ── MENU PANEL ──
function MenuPanel({ onClose, currentUser, userProfile, members, account, onSignOut, onSwitchAccount, colors }) {
  const me = members?.find(m => m.uid === currentUser?.uid);
  const meColor = me?.color || "#4F7FFA";
  const { setManualTheme } = useTheme();
  const currentThemeMode = localStorage.getItem("xpenses-theme") || "auto";
  const themeLabels = { auto: "Automático", dark: "Oscuro", light: "Claro" };
  const [showThemePopup, setShowThemePopup] = useState(false);
  const handleTheme = async (val) => {
    if (val === "auto") { setManualTheme(null); localStorage.removeItem("xpenses-theme"); }
    else { setManualTheme(val); localStorage.setItem("xpenses-theme", val); }
    setShowThemePopup(false);
  };
  const startY = useRef(null);
  const [dragY, setDragY] = useState(0);
  const dragging = useRef(false);
  const onTouchStart = (e) => { startY.current = e.touches[0].clientY; dragging.current = true; };
  const onTouchMove  = (e) => { if (!dragging.current) return; const dy = e.touches[0].clientY - startY.current; if (dy > 0) setDragY(dy); };
  const onTouchEnd   = () => { if (dragY > 100) onClose(); else setDragY(0); dragging.current = false; startY.current = null; };

  const handleShare = () => {
    const url = window.location.origin;
    if (navigator.share) navigator.share({ title: "X-penses", text: "Llevá tus gastos compartidos 💸", url });
    else { navigator.clipboard.writeText(url); alert("¡Link copiado!"); }
  };

  const [fontSize, setFontSizeState] = useState(() => localStorage.getItem("expenseFontSize") || "medium");
  const [showFontPopup, setShowFontPopup] = useState(false);
  const handleFontSize = (id) => {
    setFontSizeState(id);
    localStorage.setItem("expenseFontSize", id);
    window.dispatchEvent(new CustomEvent("expenseFontSizeChange", { detail: id }));
    setShowFontPopup(false);
  };
  const fontSizes = [{ id: "small", label: "Pequeño" }, { id: "medium", label: "Mediano" }, { id: "large", label: "Grande" }];
  const fontLabel = fontSizes.find(f => f.id === fontSize)?.label || "Mediano";

  const rows = [
    { icon: "🔀", label: "Cambiar de cuenta", sub: account?.name || "", action: () => { onClose(); onSwitchAccount(); } },
    { icon: "📤", label: "Compartir X-penses", sub: "Invitá a otros a usar la app", action: () => { onClose(); handleShare(); } },
    { icon: "🎨", label: "Modo", sub: themeLabels[currentThemeMode], action: () => setShowThemePopup(true) },
    { icon: "🔡", label: "Tamaño de letra", sub: fontLabel, action: () => setShowFontPopup(true) },
    { icon: "🚪", label: "Cerrar sesión", sub: "", action: () => { onClose(); onSignOut(); }, danger: true },
  ];

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "flex-end" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
        style={{ background: colors.card, borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 500, margin: "0 auto", padding: "20px 20px calc(32px + env(safe-area-inset-bottom))", fontFamily: FONT, transform: `translateY(${dragY}px)`, transition: dragging.current ? "none" : "transform 0.3s ease" }}>
        <div style={{ width: 36, height: 4, background: colors.divider, borderRadius: 2, margin: "0 auto 20px" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", background: colors.pill, borderRadius: 18, marginBottom: 16 }}>
          {currentUser?.photoURL
            ? <img src={currentUser.photoURL} style={{ width: 48, height: 48, borderRadius: 24, border: `2px solid ${meColor}` }} alt="" />
            : <div style={{ width: 48, height: 48, borderRadius: 24, background: meColor + "33", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>👤</div>}
          <div>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 16, color: colors.text, fontFamily: FONT }}>{userProfile?.name || currentUser?.displayName}</p>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: colors.textMuted, fontFamily: FONT }}>{currentUser?.email}</p>
          </div>
        </div>
        <div style={{ padding: "10px 16px", background: "#4F7FFA11", borderRadius: 14, marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20 }}>{account?.emoji || (account?.type === "shared" ? "👥" : "👤")}</span>
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#4F7FFA", fontFamily: FONT }}>{account?.name}</p>
            <p style={{ margin: 0, fontSize: 11, color: colors.textMuted, fontFamily: FONT }}>{account?.type === "shared" ? "Cuenta compartida" : "Cuenta personal"}</p>
          </div>
        </div>

        {rows.map((r, i) => (
          <button key={i} onClick={r.action} style={{ width: "100%", background: "none", border: "none", borderRadius: 14, padding: "13px 16px", marginBottom: 4, display: "flex", alignItems: "center", gap: 14, cursor: "pointer", fontFamily: FONT, textAlign: "left" }}>
            <span style={{ fontSize: 22, width: 32 }}>{r.icon}</span>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: r.danger ? colors.danger : colors.text, fontFamily: FONT }}>{r.label}</p>
              {r.sub && <p style={{ margin: "2px 0 0", fontSize: 12, color: colors.textMuted, fontFamily: FONT }}>{r.sub}</p>}
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={colors.textMuted} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
          </button>
        ))}

        {showFontPopup && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
            onClick={() => setShowFontPopup(false)}>
            <div onClick={e => e.stopPropagation()}
              style={{ background: colors.card, borderRadius: 20, padding: 24, width: "100%", maxWidth: 320, fontFamily: FONT }}>
              <p style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700, color: colors.text, fontFamily: FONT }}>🔡 Tamaño de letra</p>
              {fontSizes.map(f => (
                <button key={f.id} onClick={() => handleFontSize(f.id)}
                  style={{ width: "100%", padding: "13px 16px", borderRadius: 14, border: "2px solid", marginBottom: 8, cursor: "pointer", fontFamily: FONT, textAlign: "left", display: "flex", alignItems: "center", justifyContent: "space-between",
                    borderColor: fontSize === f.id ? "#4F7FFA" : colors.inputBorder,
                    background: fontSize === f.id ? "#4F7FFA11" : colors.input,
                    color: fontSize === f.id ? "#4F7FFA" : colors.text,
                    fontWeight: fontSize === f.id ? 700 : 500 }}>
                  {f.label}
                  {fontSize === f.id && <span style={{ color: "#4F7FFA" }}>✓</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        {showThemePopup && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
            onClick={() => setShowThemePopup(false)}>
            <div onClick={e => e.stopPropagation()}
              style={{ background: colors.card, borderRadius: 20, padding: 24, width: "100%", maxWidth: 320, fontFamily: FONT }}>
              <p style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700, color: colors.text, fontFamily: FONT }}>🎨 Modo</p>
              {[["auto","Automático"],["dark","Oscuro"],["light","Claro"]].map(([val, lbl]) => {
                const active = currentThemeMode === val;
                return (
                  <button key={val} onClick={() => handleTheme(val)}
                    style={{ width: "100%", padding: "13px 16px", borderRadius: 14, border: "2px solid", marginBottom: 8, cursor: "pointer", fontFamily: FONT, textAlign: "left", display: "flex", alignItems: "center", justifyContent: "space-between",
                      borderColor: active ? "#4F7FFA" : colors.inputBorder,
                      background: active ? "#4F7FFA11" : colors.input,
                      color: active ? "#4F7FFA" : colors.text,
                      fontWeight: active ? 700 : 500 }}>
                    {lbl}
                    {active && <span style={{ color: "#4F7FFA" }}>✓</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── INSTALL BANNER (Android/Chrome only) ──
function InstallBanner() {
  const [prompt, setPrompt] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // No mostrar si ya está instalada como PWA
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    // No mostrar si el usuario ya la descartó
    if (localStorage.getItem('xpenses-install-dismissed')) return;

    const handler = (e) => {
      e.preventDefault();
      setPrompt(e);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!visible) return null;

  const handleInstall = async () => {
    if (!prompt) return;
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') setVisible(false);
    setPrompt(null);
  };

  const handleDismiss = () => {
    setVisible(false);
    localStorage.setItem('xpenses-install-dismissed', '1');
  };

  return (
    <div style={{
      position: 'fixed', bottom: 80, left: 0, right: 0, zIndex: 200,
      display: 'flex', justifyContent: 'center', padding: '0 16px',
      pointerEvents: 'none',
    }}>
      <div style={{
        background: '#1a1b21', border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 16, padding: '12px 16px', display: 'flex',
        alignItems: 'center', gap: 12, maxWidth: 360, width: '100%',
        boxShadow: '0 4px 24px rgba(0,0,0,0.4)', pointerEvents: 'auto',
      }}>
        <img src="/logo.png" alt="" style={{ width: 36, height: 36, borderRadius: 8, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#fff', fontFamily: FONT }}>Instalar X-penses</p>
          <p style={{ margin: '2px 0 0', fontSize: 11, color: '#ffffff77', fontFamily: FONT }}>Accedé rápido desde tu pantalla de inicio</p>
        </div>
        <button onClick={handleInstall} style={{
          background: '#4F7FFA', border: 'none', borderRadius: 10, padding: '8px 14px',
          color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: FONT, flexShrink: 0,
        }}>
          Instalar
        </button>
        <button onClick={handleDismiss} style={{
          background: 'none', border: 'none', color: '#ffffff55', cursor: 'pointer',
          fontSize: 18, lineHeight: 1, padding: '4px', flexShrink: 0,
        }}>
          ×
        </button>
      </div>
    </div>
  );
}

// ── CLAIM IDENTITY MODAL ──
function ClaimIdentityModal({ claimData, onClaim, onSkip, colors }) {
  const { memberLabels, accountData } = claimData;
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const handleClaim = async () => { if (!selected) return; setLoading(true); await onClaim(selected); setLoading(false); };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 300, display: "flex", alignItems: "flex-end" }}>
      <div style={{ background: colors.card, borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 500, margin: "0 auto", padding: "24px 20px calc(40px + env(safe-area-inset-bottom))", fontFamily: FONT }}>
        <div style={{ width: 36, height: 4, background: colors.divider, borderRadius: 2, margin: "0 auto 24px" }} />
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <p style={{ fontSize: 40, margin: "0 0 10px" }}>👋</p>
          <p style={{ fontSize: 20, fontWeight: 700, color: colors.text, margin: "0 0 6px", fontFamily: FONT }}>¡Te invitaron a <span style={{ color: "#4F7FFA" }}>{accountData.name}</span>!</p>
          <p style={{ fontSize: 14, color: colors.textMuted, margin: 0, fontFamily: FONT, lineHeight: 1.5 }}>Elegí tu nombre para que los demás te reconozcan</p>
        </div>
        <div style={{ marginBottom: 20 }}>
          {memberLabels.map(label => (
            <button key={label.id} onClick={() => setSelected(label.id)}
              style={{ width: "100%", padding: "14px 16px", borderRadius: 16, border: "2px solid", marginBottom: 8, cursor: "pointer", fontFamily: FONT, textAlign: "left", display: "flex", alignItems: "center", gap: 14, borderColor: selected === label.id ? label.color || "#4F7FFA" : colors.inputBorder, background: selected === label.id ? (label.color || "#4F7FFA") + "14" : colors.input }}>
              <div style={{ width: 44, height: 44, borderRadius: 22, flexShrink: 0, background: (label.color || "#4F7FFA") + "33", border: `2px solid ${label.color || "#4F7FFA"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 18, fontWeight: 700, color: label.color || "#4F7FFA", fontFamily: FONT }}>{label.name[0].toUpperCase()}</span>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 16, color: selected === label.id ? (label.color || "#4F7FFA") : colors.text, fontFamily: FONT }}>{label.name}</p>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: colors.textMuted, fontFamily: FONT }}>Miembro de {accountData.name}</p>
              </div>
              {selected === label.id && <div style={{ width: 24, height: 24, borderRadius: 12, background: label.color || "#4F7FFA", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><span style={{ color: "#fff", fontSize: 14 }}>✓</span></div>}
            </button>
          ))}
        </div>
        <button onClick={handleClaim} disabled={!selected || loading} style={{ width: "100%", padding: 16, borderRadius: 16, border: "none", background: !selected || loading ? "#aaa" : "linear-gradient(135deg,#4F7FFA,#3a6ae8)", color: "#fff", fontSize: 16, fontWeight: 700, cursor: !selected || loading ? "default" : "pointer", fontFamily: FONT, marginBottom: 10 }}>
          {loading ? "Uniéndome..." : "¡Soy yo, unirme!"}
        </button>
        <button onClick={onSkip} style={{ width: "100%", padding: 14, borderRadius: 14, border: "none", background: colors.pill, color: colors.textMuted, fontSize: 14, cursor: "pointer", fontFamily: FONT }}>Mi nombre no está en la lista</button>
      </div>
    </div>
  );
}

// ── APP INNER ──
function AppInner() {
  const { colors, toggleTheme, isDark } = useTheme();
  const { unreadCount } = useNotif();
  const [authUser, setAuthUser]         = useState(undefined);
  const [userProfile, setUserProfile]   = useState(null);
  const [initializing, setInitializing] = useState(true);
  const [tab, setTab]                   = useState("home");
  const [showAdd, setShowAdd]           = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [showNotifs, setShowNotifs]     = useState(false);
  const [showMenu, setShowMenu]         = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState(null);
  const [showWelcome, setShowWelcome]   = useState(false);
  const [showEmailAuth, setShowEmailAuth] = useState(false);
  const [pendingInviteId, setPendingInviteId] = useState(null);
  const [claimData, setClaimData]       = useState(null);
  const [accountIds, setAccountIds]     = useState([]);
  // Onboarding: se muestra una vez por dispositivo a usuarios nuevos (antes de ConfigScreen)
  const [onboardingDone, setOnboardingDone] = useState(() => !!localStorage.getItem("xpenses-onboarding-done"));
  const currentMonth = getCurrentMonth();

  // ── Hooks de datos — reemplazan todos los useEffects inline de App.jsx ──
  // useAccountData: maneja userAccounts, account activa y members[].
  // FIX PROBLEMA RAÍZ B2/B7: seed inmediato del usuario actual en members[]
  // antes de que resuelvan los listeners de Firestore, eliminando la ventana
  // de tiempo en que allMembers llegaba vacío a AddExpenseModal/EditExpenseModal.
  const { userAccounts, account, members, accountsLoading } = useAccountData(
    accountIds, selectedAccountId, authUser, userProfile
  );

  // useFirestoreData: maneja expenses, categories, fixedExpenses, settlements.
  // Expenses tiene filtro de 6 meses para minimizar lecturas de Firestore.
  const {
    expenses, setExpenses,
    customCategories,
    fixedExpenses,
    settlements,
    expensesLoading,
  } = useFirestoreData(account?.id);

  // Detectar invite en URL — usa hash (#invite=XXX) para sobrevivir redirects
  const [inviteIdFromUrl] = useState(() => {
    // Intentar desde hash primero (más confiable)
    const hash = window.location.hash;
    const hashMatch = hash.match(/[#&]invite=([^&]+)/);
    if (hashMatch) {
      window.history.replaceState({}, "", window.location.pathname);
      return hashMatch[1];
    }
    // Fallback: query param
    const params = new URLSearchParams(window.location.search);
    const id = params.get("invite");
    if (id) window.history.replaceState({}, "", window.location.pathname);
    return id || null;
  });

  // Si la PWA está en background y el usuario abre un link de invite, el hash
  // puede llegar después del montaje inicial. Recargamos limpio para que
  // inviteIdFromUrl se inicialice con el hash correcto.
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash.startsWith("#invite=")) {
        window.location.reload();
      }
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  useEffect(() => {
    if (!authUser) return;
    // Leer directamente de localStorage — más confiable que el state
    const inviteId = pendingInviteId || localStorage.getItem("pendingInviteId");
    if (!inviteId) return;
    const processInvite = async () => {
      try {
        const inviteSnap = await getDoc(doc(db, "invites", inviteId));
        if (!inviteSnap.exists()) return;
        const invite = inviteSnap.data();
        const accountId = invite.accountId;
        // Si el invite ya fue usado, verificar si el usuario ya es miembro y redirigir
        if (invite.used) {
          const accountSnap2 = await getDoc(doc(db, "accounts", accountId));
          if (accountSnap2.exists() && accountSnap2.data().memberIds?.includes(authUser.uid)) {
            localStorage.removeItem("pendingInviteId");
            setPendingInviteId(null);
            setSelectedAccountId(accountId);
          }
          return;
        }
        const accountSnap = await getDoc(doc(db, "accounts", accountId));
        if (!accountSnap.exists()) return;
        const accountData = accountSnap.data();
        const labels = accountData.memberLabels || [];
        const unlinked = labels.filter(l => !l.linkedUid);
        if (unlinked.length > 0) {
          setClaimData({ inviteId, accountId, accountData, memberLabels: unlinked });
          setPendingInviteId(null);
          return;
        }
        await finishJoinAccount({ inviteId, accountId, accountData, claimedLabelId: null });
        setPendingInviteId(null);
      } catch (err) { console.error("Error procesando invitación:", err); }
    };
    processInvite();
  }, [pendingInviteId, authUser, showWelcome]);

  const finishJoinAccount = async ({ inviteId, accountId, accountData, claimedLabelId }) => {
    try {
      const memberIds = accountData.memberIds || [];
      if (!memberIds.includes(authUser.uid)) await updateDoc(doc(db, "accounts", accountId), { memberIds: arrayUnion(authUser.uid) });
      if (claimedLabelId) {
        const updatedLabels = (accountData.memberLabels || []).map(l => l.id === claimedLabelId ? { ...l, linkedUid: authUser.uid } : l);
        await updateDoc(doc(db, "accounts", accountId), { memberLabels: updatedLabels });
        const labelName = (accountData.memberLabels || []).find(l => l.id === claimedLabelId)?.name;
        if (labelName) await setDoc(doc(db, "users", authUser.uid), { name: labelName }, { merge: true });
      }
      const userSnap = await getDoc(doc(db, "users", authUser.uid));
      const existingIds = userSnap.exists() ? (userSnap.data().accountIds || []) : [];
      // setupDone: true — el usuario llegó por invitación, no necesita onboarding
      if (!existingIds.includes(accountId)) await setDoc(doc(db, "users", authUser.uid), { accountIds: [...existingIds, accountId], setupDone: true }, { merge: true });
      else await setDoc(doc(db, "users", authUser.uid), { setupDone: true }, { merge: true });
      // Link reutilizable — nunca se marca como usado
      setClaimData(null);
      setPendingInviteId(null);
      localStorage.removeItem("pendingInviteId");
      setSelectedAccountId(accountId);
    } catch (err) { console.error("Error al unirse:", err); }
  };

  useEffect(() => {
    return onAuthStateChanged(auth, user => {
      setUserProfile(null);
      setAccountIds([]);
      setSelectedAccountId(null);
      setAuthUser(user || null);
      if (!user) {
        setInitializing(false);
        setShowWelcome(true);
        setShowEmailAuth(false);
      } else {
        setInitializing(true);
        // Recuperar invite pendiente al autenticarse
        const saved = localStorage.getItem("pendingInviteId");
        if (saved) setPendingInviteId(saved);
      }
    });
  }, []);

  useEffect(() => {
    if (!authUser) return;
    return onSnapshot(doc(db, "users", authUser.uid), snap => {
      const data = snap.data();
      setUserProfile(data || null);
      setAccountIds(data?.accountIds || (data?.accountId ? [data.accountId] : [authUser.uid]));
      setInitializing(false);
    });
  }, [authUser]);


  // ── allMembers normalizado — fuente única via buildAllMembers() ──
  // Todos los componentes que reciben allMembers pueden confiar en que
  // cada elemento tiene { uid, name, color, _isLabel } garantizados.
  const allMembers = useMemo(
    () => buildAllMembers(members, account?.memberLabels),
    [members, account?.memberLabels]
  );

  // Categorías activas = DEFAULT sin las desactivadas + custom de la subcolección
  const activeCategories = useMemo(() => {
    const disabled = account?.disabledCategories || [];
    const activeDefaults = DEFAULT_CATEGORIES.filter(c => !disabled.includes(c.id));
    return [...activeDefaults, ...(customCategories || [])];
  }, [account?.disabledCategories, customCategories]);

  // FIX: visibleFixed calculado una vez aquí — HomeScreen y SaldosScreen lo reciben como prop
  const visibleFixed = useMemo(
    () => (fixedExpenses || []).filter(f => f.shared || f.createdBy === authUser?.uid),
    [fixedExpenses, authUser?.uid]
  );

  const [deleteWarning, setDeleteWarning] = useState(null);
  const { sendNotification } = useNotif();
  const { addExpense, handleEditSave, deleteExpense, doDeleteExpense, markFixedPaid } = useExpenses({
    authUser, account, allMembers, members, expenses, settlements,
    currentMonth, setExpenses, setEditingExpense,
    setDeleteWarning, sendNotification,
  });

  const handleSignOut = async () => { await signOut(auth); setUserProfile(null); setShowWelcome(true); };

  const handleDeleteAccount = async () => {
    if (!authUser) return;
    const uid = authUser.uid;
    try {
      for (const acc of userAccounts) {
        const isOwner  = acc.ownerId === uid;
        const isMember = (acc.memberIds || []).includes(uid);

        if (isOwner) {
          await deleteDoc(doc(db, "accounts", acc.id));
        } else if (isMember) {
          // Solo intentar updateDoc si realmente somos miembro — evita permission-denied
          // en cuentas huérfanas que quedaron en accountIds sin relación real
          const updatedMemberIds = acc.memberIds.filter(id => id !== uid);
          const updatedLabels = (acc.memberLabels || []).map(l =>
            l.linkedUid === uid ? { ...l, linkedUid: null } : l
          );
          await updateDoc(doc(db, "accounts", acc.id), {
            memberIds: updatedMemberIds,
            memberLabels: updatedLabels,
          });
        }
        // Si no somos ni owner ni member: cuenta huérfana, se saltea silenciosamente
      }
      await deleteDoc(doc(db, "users", uid));
      await signOut(auth);
      setUserProfile(null);
      setSelectedAccountId(null);
      setShowWelcome(true);
    } catch (e) {
      console.error("[deleteAccount] ERROR:", e.code, e.message, e);
    }
  };

  useEffect(() => {
    if (account?.type === "personal" && tab === "saldos") setTab("home");
  }, [account?.type, tab]);

  // Si hay invite en URL, mostrar InviteJoinScreen que maneja todo el flujo
  if (inviteIdFromUrl) return (
    <InviteJoinScreen
      inviteId={inviteIdFromUrl}
      onJoined={(accountId) => {
        setSelectedAccountId(accountId);
        setTab("home");
      }}
      onError={(msg) => {
        console.error("Invite error:", msg);
        // Redirigir a la app normal si falla
        window.location.replace(window.location.origin);
      }}
    />
  );

  if (initializing) return <Spinner text="Cargando..." />;
  if (authUser === undefined) return <Spinner text="Iniciando X-penses..." />;
  if (showWelcome && showEmailAuth) return <EmailAuthScreen onBack={() => setShowEmailAuth(false)} onEnter={() => { setShowEmailAuth(false); setShowWelcome(false); }} />;
  if (showWelcome) return <WelcomeScreen onEnter={() => setShowWelcome(false)} onEmailClick={() => setShowEmailAuth(true)} />;
  if (!authUser) return <AuthScreen />;
  // Si hay un invite pendiente, no mostrar ConfigScreen — el usuario llegó por invitación
  // y va a ser agregado a una cuenta existente, no necesita crear una nueva.
  if (!userProfile?.setupDone && !pendingInviteId && !claimData && !inviteIdFromUrl) {
    if (!onboardingDone) return (
      <OnboardingScreen
        user={authUser}
        onDone={() => { localStorage.setItem("xpenses-onboarding-done", "1"); setOnboardingDone(true); }}
      />
    );
    return <ConfigScreen user={authUser} onDone={() => {}} />;
  }
  if (!selectedAccountId && accountsLoading) return <Spinner text="Cargando cuentas..." />;
  if (!selectedAccountId) return (
    <AccountSelectorScreen
      user={authUser} userProfile={userProfile} accounts={userAccounts}
      onSelect={(id) => { setSelectedAccountId(id); setTab("home"); }}
      onCreated={(id) => { setSelectedAccountId(id); setTab("home"); }}
      onSignOut={handleSignOut}
      onDeleteAccount={handleDeleteAccount}
      isLoading={accountsLoading}
    />
  );

  const accountExpenses = expenses;
  const isPersonal = account?.type === "personal";

  const NAV_LEFT = isPersonal
    ? [{ id: "home", label: "Inicio" }, { id: "graficos", label: "Gráficos" }]
    : [{ id: "home", label: "Inicio" }, { id: "saldos", label: "Saldos" }];
  const NAV_RIGHT = isPersonal
    ? [{ id: "ajustes", label: "Ajustes" }]
    : [{ id: "graficos", label: "Gráficos" }, { id: "ajustes", label: "Ajustes" }];

  return (
    <div style={{ width: "100%", maxWidth: 500, margin: "0 auto", background: colors.bg, minHeight: "100dvh", position: "relative", fontFamily: FONT, paddingLeft: "env(safe-area-inset-left)", paddingRight: "env(safe-area-inset-right)", boxSizing: "border-box", overflowX: "hidden" }}>
      <style>{`
        ${FONT_IMPORT}
        *, *::before, *::after { box-sizing: border-box; }
        html, body, #root { width: 100%; min-height: 100dvh; margin: 0; padding: 0; font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif; }
        body { -webkit-font-smoothing: antialiased; }
        input, button, select, textarea { font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif; }
        ::-webkit-scrollbar { display: none; }
      `}</style>

      <AppHeader account={account} onMenuOpen={() => setShowMenu(true)} onNotifsOpen={() => setShowNotifs(true)} unreadCount={unreadCount} colors={colors} />

      <div style={{ paddingBottom: NAV_HEIGHT + 20, minHeight: "100dvh" }}>
        {tab === "home" && <HomeScreen expenses={accountExpenses} currentUser={authUser} allMembers={allMembers} account={account} currentMonth={currentMonth} customCategories={customCategories} visibleFixed={visibleFixed} onEdit={setEditingExpense} onDelete={deleteExpense} onMarkFixedPaid={markFixedPaid} settlements={settlements} isLoading={expensesLoading} />}
        <Suspense fallback={<Spinner text="Cargando..." />}>
          {tab === "saldos"   && <SaldosScreen expenses={accountExpenses} visibleFixed={visibleFixed} members={allMembers} account={account} currentMonth={currentMonth} currentUser={authUser} onAddExpense={addExpense} settlements={settlements} customCategories={activeCategories} categoryBudgets={account?.categoryBudgets} />}
          {tab === "graficos" && <GraficosScreen expenses={accountExpenses} account={account} customCategories={customCategories} fixedExpenses={fixedExpenses} categoryBudgets={account?.categoryBudgets} />}
          {tab === "ajustes"  && <SettingsScreen currentUser={authUser} userProfile={userProfile} account={account} members={members} allMembers={allMembers} customCategories={customCategories} fixedExpenses={fixedExpenses} onSignOut={handleSignOut} onSwitchAccount={() => setSelectedAccountId(null)} />}
        </Suspense>
      </div>

      {/* Bottom Nav */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, width: "100%", maxWidth: 500, margin: "0 auto", zIndex: 40 }}>
        <div style={{ position: "absolute", top: -28, left: "50%", transform: "translateX(-50%)", zIndex: 41 }}>
          <button onClick={() => setShowAdd(true)} style={{ width: 64, height: 64, borderRadius: 32, background: "linear-gradient(135deg,#4F7FFA,#3a6ae8)", border: "4px solid " + colors.navBg, color: "#fff", fontSize: 30, cursor: "pointer", boxShadow: "0 6px 24px #4F7FFA88", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
        </div>
        <div style={{ background: colors.navBg, borderTop: `1px solid ${colors.navBorder}`, display: "flex", alignItems: "center", padding: `10px 0 calc(16px + env(safe-area-inset-bottom))`, boxShadow: "0 -4px 20px rgba(0,0,0,0.08)" }}>
          {NAV_LEFT.map(n => (
            <button key={n.id} onClick={() => setTab(n.id)} style={{ flex: 1, background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, fontFamily: FONT, padding: "2px 0" }}>
              <NavIcon id={n.id} active={tab === n.id} color="#4F7FFA" />
              <span style={{ fontSize: 9, fontWeight: tab === n.id ? 700 : 500, letterSpacing: 0.2, color: tab === n.id ? "#4F7FFA" : colors.textSubtle, textTransform: "uppercase", fontFamily: FONT }}>{n.label}</span>
            </button>
          ))}
          <div style={{ flex: 1 }} />
          {NAV_RIGHT.map(n => (
            <button key={n.id} onClick={() => setTab(n.id)} style={{ flex: 1, background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, fontFamily: FONT, padding: "2px 0" }}>
              <NavIcon id={n.id} active={tab === n.id} color="#4F7FFA" />
              <span style={{ fontSize: 9, fontWeight: tab === n.id ? 700 : 500, letterSpacing: 0.2, color: tab === n.id ? "#4F7FFA" : colors.textSubtle, textTransform: "uppercase", fontFamily: FONT }}>{n.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Modales */}
      {showAdd && <AddExpenseModal onClose={() => setShowAdd(false)} onSaved={() => setTab("home")} onAdd={addExpense} currentUser={authUser} allMembers={allMembers} currency={account?.currency || "ARS"} customCategories={activeCategories} isPersonal={isPersonal} isPozo={account?.type === "pozo"} accountId={account?.id} />}
      {editingExpense && <EditExpenseModal expense={editingExpense} members={allMembers} customCategories={activeCategories} currentUser={authUser} isPozo={account?.type === "pozo"} onClose={() => setEditingExpense(null)} onSave={handleEditSave} />}
      {showNotifs && <NotifCenter onClose={() => setShowNotifs(false)} />}
      {showMenu && <MenuPanel onClose={() => setShowMenu(false)} currentUser={authUser} userProfile={userProfile} members={members} account={account} onSignOut={handleSignOut} onSwitchAccount={() => setSelectedAccountId(null)} onDeleteAccount={handleDeleteAccount} colors={colors} />}

      {deleteWarning && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 300, display: "flex", alignItems: "flex-end" }}>
          <div style={{ background: colors.card, borderRadius: "24px 24px 0 0", width: "100%", padding: "24px 20px calc(40px + env(safe-area-inset-bottom))", fontFamily: FONT }}>
            <div style={{ width: 36, height: 4, background: colors.divider, borderRadius: 2, margin: "0 auto 20px" }} />
            <p style={{ fontSize: 18, fontWeight: 700, color: colors.text, margin: "0 0 8px", fontFamily: FONT }}>⚠️ Hay settlements registrados</p>
            <p style={{ fontSize: 14, color: colors.textMuted, margin: "0 0 6px", fontFamily: FONT, lineHeight: 1.5 }}>Este gasto afecta saldos que ya fueron saldados parcialmente este mes.</p>
            <div style={{ background: colors.pill, borderRadius: 12, padding: "10px 14px", marginBottom: 20 }}>
              <p style={{ margin: 0, fontSize: 13, color: colors.text, fontFamily: FONT, fontWeight: 600 }}>
                🗑️ {deleteWarning.expense.concept} — {formatAmount(deleteWarning.expense.amount, account?.currency || "ARS")}
              </p>
            </div>
            <button onClick={() => doDeleteExpense(deleteWarning.expense, true)} style={{ width: "100%", padding: 15, borderRadius: 14, background: "#e74c3c", color: "#fff", border: "none", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: FONT, marginBottom: 8 }}>
              🗑️ Eliminar y ajustar saldos automáticamente
            </button>
            <button onClick={() => doDeleteExpense(deleteWarning.expense, false)} style={{ width: "100%", padding: 14, borderRadius: 14, background: colors.pill, color: colors.text, border: "none", fontSize: 14, cursor: "pointer", fontFamily: FONT, marginBottom: 8 }}>
              Eliminar sin ajustar settlements
            </button>
            <button onClick={() => setDeleteWarning(null)} style={{ width: "100%", padding: 14, borderRadius: 14, background: "none", color: colors.textMuted, border: "none", fontSize: 14, cursor: "pointer", fontFamily: FONT }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      <InstallBanner />

      {claimData && (
        <ClaimIdentityModal claimData={claimData} colors={colors}
          onClaim={(labelId) => finishJoinAccount({ inviteId: claimData.inviteId, accountId: claimData.accountId, accountData: claimData.accountData, claimedLabelId: labelId })}
          onSkip={() => finishJoinAccount({ inviteId: claimData.inviteId, accountId: claimData.accountId, accountData: claimData.accountData, claimedLabelId: null })} />
      )}
    </div>
  );
}

export default function App() {
  return (
    <NotifProvider>
      <AppInner />
    </NotifProvider>
  );
}