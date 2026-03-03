import { useState, useEffect } from "react";

const SF = `-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', sans-serif`;

const FEATURES = [
  {
    icon: "⚖️",
    title: "Saldos en tiempo real",
    desc: "Sabés al instante quién debe qué, sin hacer cuentas a mano.",
  },
  {
    icon: "📊",
    title: "División inteligente",
    desc: "Proporcional al salario o 50/50. Justo para cada pareja.",
  },
  {
    icon: "🗂️",
    title: "Múltiples cuentas",
    desc: "Casa, vacaciones, viaje. Cada gasto en su lugar.",
  },
  {
    icon: "🔔",
    title: "Notificaciones al instante",
    desc: "Tu pareja carga un gasto y vos lo ves en segundos.",
  },
];

export default function WelcomeScreen({ onEnter }) {
  const [visible, setVisible] = useState(false);
  const [activeFeature, setActiveFeature] = useState(0);

  useEffect(() => {
    setTimeout(() => setVisible(true), 80);
    const interval = setInterval(() => {
      setActiveFeature(prev => (prev + 1) % FEATURES.length);
    }, 2800);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{
      minHeight: "100vh",
      background: "#08090d",
      display: "flex",
      flexDirection: "column",
      fontFamily: SF,
      overflow: "hidden",
      position: "relative",
    }}>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(28px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.08); }
        }
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
        @keyframes orb1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -20px) scale(1.1); }
          66% { transform: translate(-20px, 15px) scale(0.95); }
        }
        @keyframes orb2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(-25px, 20px) scale(0.9); }
          66% { transform: translate(20px, -15px) scale(1.05); }
        }
        .feature-card {
          transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .feature-card.active {
          transform: scale(1.02);
        }
        .enter-btn {
          transition: all 0.2s ease;
        }
        .enter-btn:active {
          transform: scale(0.97);
        }
      `}</style>

      {/* Orbs de fondo */}
      <div style={{
        position: "absolute", top: -100, left: -80,
        width: 360, height: 360, borderRadius: "50%",
        background: "radial-gradient(circle, #4F7FFA22 0%, transparent 70%)",
        animation: "orb1 12s ease-in-out infinite",
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", top: 200, right: -100,
        width: 280, height: 280, borderRadius: "50%",
        background: "radial-gradient(circle, #FA4F7F18 0%, transparent 70%)",
        animation: "orb2 15s ease-in-out infinite",
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", bottom: 100, left: "20%",
        width: 200, height: 200, borderRadius: "50%",
        background: "radial-gradient(circle, #4F7FFA14 0%, transparent 70%)",
        animation: "orb1 18s ease-in-out infinite reverse",
        pointerEvents: "none",
      }} />

      {/* Grid sutil */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        backgroundImage: `
          linear-gradient(rgba(79,127,250,0.04) 1px, transparent 1px),
          linear-gradient(90deg, rgba(79,127,250,0.04) 1px, transparent 1px)
        `,
        backgroundSize: "40px 40px",
      }} />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "0 24px", maxWidth: 430, margin: "0 auto", width: "100%" }}>

        {/* Header */}
        <div style={{
          paddingTop: 64,
          opacity: visible ? 1 : 0,
          animation: visible ? "fadeUp 0.7s ease forwards" : "none",
        }}>
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 48 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 14,
              background: "linear-gradient(135deg, #4F7FFA, #3a6ae8)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 22, boxShadow: "0 8px 24px #4F7FFA44",
              animation: "float 4s ease-in-out infinite",
            }}>💸</div>
            <span style={{ fontSize: 22, fontWeight: 800, color: "#fff", letterSpacing: -0.5 }}>X-penses</span>
          </div>

          {/* Headline */}
          <p style={{
            fontSize: 13, fontWeight: 600, letterSpacing: 2.5,
            textTransform: "uppercase", color: "#4F7FFA",
            margin: "0 0 16px",
          }}>Finanzas claras, cortito y al pie</p>

          <h1 style={{
            fontSize: 38, fontWeight: 800, color: "#fff",
            margin: "0 0 16px", lineHeight: 1.1, letterSpacing: -1.5,
          }}>
            Que la plata no sea motivo de pelea<br />
            <span style={{
              background: "linear-gradient(135deg, #4F7FFA, #a78bfa, #FA4F7F)",
              backgroundSize: "200% auto",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              animation: "shimmer 4s linear infinite",
            }}></span>
          </h1>

          <p style={{
            fontSize: 16, color: "#ffffff66", lineHeight: 1.6,
            margin: "0 0 40px", fontWeight: 400,
          }}>
            Gastos compartidos de manera simple y ordenada! Simple, justa y automática.
          </p>
        </div>

        {/* Features */}
        <div style={{
          opacity: visible ? 1 : 0,
          animation: visible ? "fadeUp 0.7s ease 0.2s forwards" : "none",
          marginBottom: 36,
        }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {FEATURES.map((f, i) => (
              <div
                key={i}
                className={`feature-card ${activeFeature === i ? "active" : ""}`}
                style={{
                  display: "flex", alignItems: "center", gap: 14,
                  padding: "14px 16px", borderRadius: 16,
                  background: activeFeature === i
                    ? "linear-gradient(135deg, rgba(79,127,250,0.15), rgba(79,127,250,0.05))"
                    : "rgba(255,255,255,0.03)",
                  border: `1px solid ${activeFeature === i ? "rgba(79,127,250,0.3)" : "rgba(255,255,255,0.06)"}`,
                  transition: "all 0.4s ease",
                }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                  background: activeFeature === i ? "#4F7FFA22" : "rgba(255,255,255,0.05)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 20, transition: "all 0.4s ease",
                }}>{f.icon}</div>
                <div>
                  <p style={{
                    margin: "0 0 2px", fontSize: 14, fontWeight: 700,
                    color: activeFeature === i ? "#fff" : "#ffffff88",
                    transition: "color 0.4s ease",
                  }}>{f.title}</p>
                  <p style={{
                    margin: 0, fontSize: 12,
                    color: activeFeature === i ? "#ffffff66" : "#ffffff33",
                    transition: "color 0.4s ease", lineHeight: 1.4,
                  }}>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Dots indicadores */}
          <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 14 }}>
            {FEATURES.map((_, i) => (
              <div key={i} style={{
                width: activeFeature === i ? 20 : 6, height: 6, borderRadius: 3,
                background: activeFeature === i ? "#4F7FFA" : "#ffffff22",
                transition: "all 0.4s ease",
              }} />
            ))}
          </div>
        </div>

        {/* CTA */}
        <div style={{
          opacity: visible ? 1 : 0,
          animation: visible ? "fadeUp 0.7s ease 0.35s forwards" : "none",
          paddingBottom: 48,
        }}>
          <button
            className="enter-btn"
            onClick={onEnter}
            style={{
              width: "100%", padding: "18px 0", borderRadius: 18,
              background: "linear-gradient(135deg, #4F7FFA, #3a6ae8)",
              color: "#fff", border: "none", fontSize: 17, fontWeight: 700,
              cursor: "pointer", fontFamily: SF,
              boxShadow: "0 8px 32px #4F7FFA55",
              letterSpacing: -0.3, marginBottom: 14,
            }}>
            Empezar gratis →
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
            <div style={{ width: 6, height: 6, borderRadius: 3, background: "#2ecc71", animation: "pulse 2s ease infinite" }} />
            <p style={{ margin: 0, fontSize: 12, color: "#ffffff44" }}>
              Gratis · Sin publicidad · Tus datos son tuyos
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
