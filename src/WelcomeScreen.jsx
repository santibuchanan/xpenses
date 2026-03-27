import { useState, useEffect, useRef } from "react";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "./firebase";

const SF = `-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', sans-serif`;

const SLIDES = [
  {
    emoji: "💼",
    title: "Tu plata, tu control",
    color: "#4F7FFA",
    desc: "Creá cuentas personales para tus gastos propios, o compartidas con tu pareja, compañeros de casa o amigos. Cada cuenta es un mundo aparte.",
    detail: "Podés tener tantas cuentas como quieras. Tus gastos personales nunca se mezclan con los compartidos. Cada cuenta tiene su propio historial, saldos y configuración.",
    expandable: true,
  },
  {
    emoji: "⚖️",
    title: "Tres formas de compartir",
    color: "#a78bfa",
    desc: null,
    items: [
      { label: "Partes iguales", text: "Cada uno paga lo mismo." },
      { label: "Proporcional", text: "Quien gana más, aporta más." },
      { label: "Pozo común", text: "Registran todo junto sin preocuparse por quién debe qué. Ideal para familias donde lo importante es el historial." },
    ],
    expandable: false,
  },
  {
    emoji: "🏠",
    title: "Una cuenta para cada vínculo",
    color: "#2ecc71",
    desc: '"Ordinario" para los gastos de todos los días. "Para otro" cuando pagás algo que le corresponde a otra persona. "Extraordinario" para gastos puntuales.',
    detail: "Ordinario: supermercado, compras, salidas. Para otro: le pagaste algo a tu pareja y querés que quede registrado. Extraordinario: viaje, arreglo del baño, regalo de cumple.",
    expandable: true,
  },
  {
    emoji: "📅",
    title: "Los fijos, en piloto automático",
    color: "#FA4F7F",
    desc: "Configurá tus gastos recurrentes una sola vez — alquiler, Netflix, internet — y aparecen solos cada mes. Cargás la fecha de pago y la app te recuerda antes de que venza.",
    detail: "Definís el monto, la categoría, la fecha de vencimiento y a quién le corresponde. Cada mes se generan automáticamente y recibís una notificación antes del vencimiento. Podés editarlos o pausarlos cuando quieras.",
    expandable: true,
  },
  {
    emoji: "📊",
    title: "Ves adónde va la plata",
    color: "#f59e0b",
    desc: "Gráficos por categoría, por mes y por persona. Sabés exactamente en qué gastaron más y cómo fue cambiando con el tiempo.",
    detail: "Tortas, barras, evolución mensual. Filtrá por período o por categoría. Ideal para detectar en qué están gastando de más y tomar decisiones juntos.",
    expandable: true,
  },
  {
    emoji: "🗂️",
    title: "Las categorías que uses vos",
    color: "#34d399",
    desc: "Vienen categorías listas para usar — comida, transporte, salud — pero podés desactivar las que no usás y quedarte solo con las que tienen sentido para tu vida.",
    detail: "Cada cuenta puede tener su propio set de categorías activas. Menos ruido, más claridad. Lo que no usás, no aparece.",
    expandable: true,
  },
];

export default function WelcomeScreen({ onEnter, onEmailClick }) {
  const [visible, setVisible] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [expandedSlide, setExpandedSlide] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const touchStartX = useRef(null);
  const slideDir = useRef("right");

  useEffect(() => {
    setTimeout(() => setVisible(true), 80);
  }, []);

  const goTo = (i) => {
    slideDir.current = i > currentSlide ? "right" : "left";
    setCurrentSlide(i);
    setExpandedSlide(null);
  };

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (delta < -50 && currentSlide < SLIDES.length - 1) goTo(currentSlide + 1);
    else if (delta > 50 && currentSlide > 0) goTo(currentSlide - 1);
    touchStartX.current = null;
  };

  const handleSlideClick = () => {
    const s = SLIDES[currentSlide];
    if (!s.expandable) return;
    setExpandedSlide(expandedSlide === currentSlide ? null : currentSlide);
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

  const s = SLIDES[currentSlide];
  const isExpanded = expandedSlide === currentSlide;

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
        @keyframes slideInLeft { from { opacity:0; transform:translateX(-48px); } to { opacity:1; transform:translateX(0); } }
        @keyframes float { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-8px); } }
        @keyframes orb1 { 0%,100%{transform:translate(0,0) scale(1);} 33%{transform:translate(30px,-20px) scale(1.1);} 66%{transform:translate(-20px,15px) scale(0.95);} }
        @keyframes orb2 { 0%,100%{transform:translate(0,0) scale(1);} 33%{transform:translate(-25px,20px) scale(0.9);} 66%{transform:translate(20px,-15px) scale(1.05);} }
        @keyframes pulse { 0%,100%{opacity:0.5;transform:scale(1);} 50%{opacity:1;transform:scale(1.08);} }
        .slide-in-right { animation: slideInRight 0.32s cubic-bezier(0.34,1.56,0.64,1) forwards; }
        .slide-in-left { animation: slideInLeft 0.32s cubic-bezier(0.34,1.56,0.64,1) forwards; }
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
          <p style={{ fontSize:13, fontWeight:600, letterSpacing:2.5, textTransform:"uppercase", color:"#4F7FFA", margin:"0 0 12px", textAlign:"center" }}>Cuentas claras conservan todo!</p>
          <h1 style={{ fontSize:34, fontWeight:800, color:"#fff", margin:"0 0 12px", lineHeight:1.1, letterSpacing:-1.5, textAlign:"center" }}>Que la plata no sea<br />motivo de pelea</h1>
          <p style={{ fontSize:14, color:"#ffffff66", lineHeight:1.6, margin:0 }}>Gastos compartidos de manera simple y ordenada, justa y automática.</p>
        </div>

        {/* Carousel */}
        <div style={{ opacity:visible?1:0, animation:visible?"fadeUp 0.7s ease 0.15s forwards":"none", marginBottom:24 }}>
          {/* Slide card */}
          <div
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onClick={handleSlideClick}
            style={{ touchAction:"pan-y", cursor: s.expandable ? "pointer" : "default" }}
          >
            <div
              key={currentSlide}
              className={slideDir.current === "right" ? "slide-in-right" : "slide-in-left"}
              style={{
                padding:"18px 18px", borderRadius:20,
                background:`linear-gradient(135deg,${s.color}18,${s.color}08)`,
                border:`1px solid ${s.color}30`,
                transition:"min-height 0.3s ease",
              }}
            >
              {/* Header */}
              <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom: s.items || isExpanded ? 14 : 0 }}>
                <div style={{ width:48, height:48, borderRadius:14, background:`${s.color}22`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, flexShrink:0 }}>
                  {s.emoji}
                </div>
                <div style={{ flex:1 }}>
                  <p style={{ margin:"0 0 4px", fontSize:15, fontWeight:700, color:"#fff" }}>{s.title}</p>
                  {s.desc && <p style={{ margin:0, fontSize:12, color:"#ffffff77", lineHeight:1.4 }}>{s.desc}</p>}
                </div>
                {s.expandable && (
                  <div style={{ fontSize:16, color:`${s.color}99`, flexShrink:0, transition:"transform 0.25s ease", transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}>▾</div>
                )}
              </div>

              {/* Expandido: detalle */}
              {isExpanded && s.detail && (
                <p style={{ margin:0, fontSize:12, color:"#ffffffaa", lineHeight:1.6, paddingTop:4, borderTop:`1px solid ${s.color}20` }}>
                  {s.detail}
                </p>
              )}

              {/* Slide 2: items siempre visibles */}
              {s.items && (
                <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  {s.items.map((item) => (
                    <div key={item.label} style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
                      <div style={{ width:6, height:6, borderRadius:3, background:s.color, flexShrink:0, marginTop:5 }} />
                      <p style={{ margin:0, fontSize:12, color:"#ffffffaa", lineHeight:1.5 }}>
                        <span style={{ color:"#fff", fontWeight:600 }}>{item.label}:</span> {item.text}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Dots */}
          <div style={{ display:"flex", gap:6, justifyContent:"center", marginTop:14 }}>
            {SLIDES.map((_,i) => (
              <button key={i} type="button" onClick={() => goTo(i)}
                style={{ width:currentSlide===i?22:7, height:7, borderRadius:4, background:currentSlide===i?"#4F7FFA":"#ffffff22", border:"none", cursor:"pointer", padding:0, transition:"all 0.35s ease" }} />
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

          <button className="btn-press" onClick={onEmailClick} disabled={loading}
            style={{ width:"100%", padding:"16px 20px", borderRadius:18, background:"#1c1c2e", border:"1px solid #ffffff22", cursor:loading?"default":"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:12, fontFamily:SF, fontWeight:700, fontSize:16, color:"#ffffff", opacity:loading?0.5:1, marginBottom:12, boxShadow:"0 4px 20px rgba(0,0,0,0.3)" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <rect x="2" y="4" width="20" height="16" rx="3" stroke="#ffffff" strokeWidth="1.8"/>
              <path d="M2 8l10 7 10-7" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            Continuar con email
          </button>

          <button className="btn-press" onClick={handleShare}
            style={{ width:"100%", padding:"13px 20px", borderRadius:18, background:"transparent", border:"1px solid #ffffff12", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:10, fontFamily:SF, fontWeight:500, fontSize:13, color:"#ffffff44", marginBottom:20 }}>
            Compartir X-penses
          </button>

          {error && <p style={{ color:"#ff6b6b", fontSize:13, textAlign:"center", margin:"-12px 0 14px" }}>{error}</p>}

          <div style={{ display:"flex", alignItems:"center", gap:8, justifyContent:"center" }}>
            <div style={{ width:6, height:6, borderRadius:3, background:"#2ecc71", animation:"pulse 2s ease infinite" }} />
            <p style={{ margin:0, fontSize:12, color:"#ffffff33" }}>Gratis · Sin publicidad · Tus datos son tuyos</p>
          </div>

          <div style={{ textAlign:"center", marginTop:16 }}>
            <a href="/privacy.html" target="_blank" rel="noopener noreferrer"
              style={{ fontSize:11, color:"#ffffff22", textDecoration:"none", fontFamily:SF }}>
              Política de Privacidad
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
