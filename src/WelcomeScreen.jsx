import { useState, useEffect, useRef } from "react";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "./firebase";

const SF = `-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', sans-serif`;

const FEATURES = [
  { icon: "⚖️", title: "Saldos en tiempo real", desc: "Sabés al instante quién debe qué, sin hacer cuentas a mano.", color: "#4F7FFA" },
  { icon: "📊", title: "División inteligente", desc: "Proporcional al ingreso o partes iguales. Justo para cada pareja.", color: "#a78bfa" },
  { icon: "🗂️", title: "Múltiples cuentas", desc: "Casa, vacaciones, viaje. Cada gasto en su lugar.", color: "#2ecc71" },
  { icon: "🔔", title: "Notificaciones al instante", desc: "Tu pareja carga un gasto y vos lo ves en segundos.", color: "#FA4F7F" },
];

export default function WelcomeScreen({ onEnter }) {
  const [visible, setVisible] = useState(false);
  const [activeFeature, setActiveFeature] = useState(0);
  const [animDir, setAnimDir] = useState("in");
  const [displayedFeature, setDisplayedFeature] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const intervalRef = useRef(null);

  useEffect(() => {
    setTimeout(() => setVisible(true), 80);
    startInterval();
    return () => clearInterval(intervalRef.current);
  }, []);

  const startInterval = () => {
    intervalRef.current = setInterval(advanceFeature, 3000);
  };

  const advanceFeature = () => {
    setAnimDir("out");
    setTimeout(() => {
      setDisplayedFeature(prev => {
        const next = (prev + 1) % FEATURES.length;
        setActiveFeature(next);
        return next;
      });
      setAnimDir("in");
    }, 320);
  };

  const goToFeature = (i) => {
    clearInterval(intervalRef.current);
    setAnimDir("out");
    setTimeout(() => {
      setDisplayedFeature(i);
      setActiveFeature(i);
      setAnimDir("in");
      startInterval();
    }, 320);
  };

  const handleGoogle = async () => {
    setLoading(true);
    setError("");
    try {
      await signInWithPopup(auth, googleProvider);
      onEnter();
    } catch (e) {
      setError("No se pudo iniciar sesión. Intentá de nuevo.");
      setLoading(false);
    }
  };

  const handleShare = () => {
    const url = window.location.origin;
    if (navigator.share) {
      navigator.share({ title: "X-penses", text: "¡Usá X-penses para llevar tus gastos compartidos! 💸", url });
    } else {
      navigator.clipboard.writeText(url);
      alert("¡Link copiado al portapapeles!");
    }
  };

  const f = FEATURES[displayedFeature];

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "#08090d",
      display: "flex", flexDirection: "column",
      fontFamily: SF, overflowY: "auto", overflowX: "hidden",
      paddingTop: "env(safe-area-inset-top)",
      paddingBottom: "env(safe-area-inset-bottom)",
      paddingLeft: "env(safe-area-inset-left)",
      paddingRight: "env(safe-area-inset-right)",
    }}>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:translateY(0); } }
        @keyframes slideInRight { from { opacity:0; transform:translateX(48px); } to { opacity:1; transform:translateX(0); } }
        @keyframes slideOutLeft { from { opacity:1; transform:translateX(0); } to { opacity:0; transform:translateX(-48px); } }
        @keyframes float { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-8px); } }
        @keyframes orb1 { 0%,100%{transform:translate(0,0) scale(1);} 33%{transform:translate(30px,-20px) scale(1.1);} 66%{transform:translate(-20px,15px) scale(0.95);} }
        @keyframes orb2 { 0%,100%{transform:translate(0,0) scale(1);} 33%{transform:translate(-25px,20px) scale(0.9);} 66%{transform:translate(20px,-15px) scale(1.05);} }
        @keyframes pulse { 0%,100%{opacity:0.5;transform:scale(1);} 50%{opacity:1;transform:scale(1.08);} }
        .feature-slide-in { animation: slideInRight 0.32s cubic-bezier(0.34,1.56,0.64,1) forwards; }
        .feature-slide-out { animation: slideOutLeft 0.32s ease forwards; }
        .btn-press:active { transform: scale(0.97); }
      `}</style>

      {/* Orbs */}
      <div style={{ position:"absolute", top:-100, left:-80, width:360, height:360, borderRadius:"50%", background:"radial-gradient(circle,#4F7FFA22 0%,transparent 70%)", animation:"orb1 12s ease-in-out infinite", pointerEvents:"none" }} />
      <div style={{ position:"absolute", top:200, right:-100, width:280, height:280, borderRadius:"50%", background:"radial-gradient(circle,#FA4F7F18 0%,transparent 70%)", animation:"orb2 15s ease-in-out infinite", pointerEvents:"none" }} />
      <div style={{ position:"absolute", bottom:100, left:"20%", width:200, height:200, borderRadius:"50%", background:"radial-gradient(circle,#4F7FFA14 0%,transparent 70%)", animation:"orb1 18s ease-in-out infinite reverse", pointerEvents:"none" }} />
      <div style={{ position:"absolute", inset:0, pointerEvents:"none", backgroundImage:`linear-gradient(rgba(79,127,250,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(79,127,250,0.04) 1px,transparent 1px)`, backgroundSize:"40px 40px" }} />

      {/* Contenido */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", padding:"0 24px", width:"100%", boxSizing:"border-box", position:"relative", zIndex:1 }}>

        {/* Logo */}
        <div style={{ paddingTop:40, opacity:visible?1:0, animation:visible?"fadeUp 0.6s ease forwards":"none", display:"flex", alignItems:"center", gap:14, marginBottom:32 }}>
          <img src="/logo.png" alt="X-penses" style={{ width:54, height:54, borderRadius:16, boxShadow:"0 8px 24px rgba(0,0,0,0.4)", animation:"float 4s ease-in-out infinite" }} />
          <span style={{ fontSize:26, fontWeight:800, color:"#fff", letterSpacing:-0.5 }}>X-penses</span>
        </div>

        {/* Headline */}
        <div style={{ opacity:visible?1:0, animation:visible?"fadeUp 0.7s ease 0.05s forwards":"none", marginBottom:28 }}>
          <p style={{ fontSize:13, fontWeight:600, letterSpacing:2.5, textTransform:"uppercase", color:"#4F7FFA", margin:"0 0 12px" }}>Finanzas claras, cortito y al pie</p>
          <h1 style={{ fontSize:34, fontWeight:800, color:"#fff", margin:"0 0 12px", lineHeight:1.1, letterSpacing:-1.5 }}>Que la plata no sea<br />motivo de pelea</h1>
          <p style={{ fontSize:14, color:"#ffffff66", lineHeight:1.6, margin:0 }}>Gastos compartidos de manera simple y ordenada, justa y automática.</p>
        </div>

        {/* Feature card */}
        <div style={{ opacity:visible?1:0, animation:visible?"fadeUp 0.7s ease 0.15s forwards":"none", marginBottom:24 }}>
          <div style={{ position:"relative", minHeight:96, overflow:"hidden" }}>
            <div key={displayedFeature} className={animDir==="in"?"feature-slide-in":"feature-slide-out"}
              style={{ display:"flex", alignItems:"center", gap:16, padding:"16px 18px", borderRadius:20, background:`linear-gradient(135deg,${f.color}18,${f.color}08)`, border:`1px solid ${f.color}30` }}>
              <div style={{ width:48, height:48, borderRadius:14, background:`${f.color}22`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, flexShrink:0 }}>{f.icon}</div>
              <div>
                <p style={{ margin:"0 0 3px", fontSize:15, fontWeight:700, color:"#fff" }}>{f.title}</p>
                <p style={{ margin:0, fontSize:12, color:"#ffffff77", lineHeight:1.4 }}>{f.desc}</p>
              </div>
            </div>
          </div>
          <div style={{ display:"flex", gap:6, justifyContent:"center", marginTop:12 }}>
            {FEATURES.map((_,i) => (
              <button key={i} onClick={() => goToFeature(i)} style={{ width:activeFeature===i?22:7, height:7, borderRadius:4, background:activeFeature===i?"#4F7FFA":"#ffffff22", border:"none", cursor:"pointer", padding:0, transition:"all 0.35s ease" }} />
            ))}
          </div>
        </div>

        {/* Botones */}
        <div style={{ opacity:visible?1:0, animation:visible?"fadeUp 0.7s ease 0.25s forwards":"none", paddingBottom:40 }}>
          <button className="btn-press" onClick={handleGoogle} disabled={loading}
            style={{ width:"100%", padding:"16px 20px", borderRadius:18, background:"#fff", border:"none", cursor:loading?"default":"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:12, fontFamily:SF, fontWeight:700, fontSize:16, color:"#1a1a2e", opacity:loading?0.7:1, marginBottom:12, boxShadow:"0 4px 20px rgba(0,0,0,0.3)" }}>
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {loading ? "Iniciando sesión..." : "Continuar con Google"}
          </button>

          <div style={{ display:"flex", alignItems:"center", gap:12, margin:"4px 0 12px" }}>
            <div style={{ flex:1, height:1, background:"#ffffff14" }} />
            <span style={{ fontSize:12, color:"#ffffff33", fontWeight:600 }}>o</span>
            <div style={{ flex:1, height:1, background:"#ffffff14" }} />
          </div>

          <button className="btn-press" onClick={handleShare}
            style={{ width:"100%", padding:"14px 20px", borderRadius:18, background:"transparent", border:"1px solid #ffffff18", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:10, fontFamily:SF, fontWeight:600, fontSize:15, color:"#ffffffbb", marginBottom:20 }}>
            Compartir X-penses
          </button>

          {error && <p style={{ color:"#ff6b6b", fontSize:13, textAlign:"center", margin:"-12px 0 14px" }}>{error}</p>}

          <div style={{ display:"flex", alignItems:"center", gap:8, justifyContent:"center" }}>
            <div style={{ width:6, height:6, borderRadius:3, background:"#2ecc71", animation:"pulse 2s ease infinite" }} />
            <p style={{ margin:0, fontSize:12, color:"#ffffff33" }}>Gratis · Sin publicidad · Tus datos son tuyos</p>
          </div>
        </div>
      </div>
    </div>
  );
}