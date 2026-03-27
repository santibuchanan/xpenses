import { useState } from "react";

const FONT = `'DM Sans', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif`;

const SLIDES = [
  {
    emoji: "💸",
    title: "¡Bienvenido/a a X-penses!",
    desc:  "Tomás el control de tus gastos compartidos, de una vez por todas. Sin planillas, sin confusiones.",
    color: "#4F7FFA",
  },
  {
    emoji: "⚖️",
    title: "Sin hacer cuentas",
    desc:  "X-penses calcula automáticamente quién debe qué, en tiempo real y con centavos exactos.",
    color: "#a78bfa",
  },
  {
    emoji: "🚀",
    title: "Todo listo para empezar",
    desc:  "Creá tu primera cuenta en menos de 2 minutos. ¡Empecemos!",
    color: "#2ecc71",
    cta:   "Crear mi cuenta",
  },
];

export default function OnboardingScreen({ user, onDone }) {
  const [step, setStep] = useState(0);
  const slide = SLIDES[step];
  const isLast = step === SLIDES.length - 1;

  const advance = () => {
    if (isLast) { onDone(); return; }
    setStep(s => s + 1);
  };

  const name = user?.displayName?.split(" ")[0] || "";

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "#08090d",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      fontFamily: FONT, padding: "40px 28px",
      paddingTop: "calc(env(safe-area-inset-top) + 40px)",
      paddingBottom: "calc(env(safe-area-inset-bottom) + 32px)",
    }}>

      {/* Orb decorativo */}
      <div style={{ position: "absolute", top: -80, left: -80, width: 300, height: 300, borderRadius: "50%", background: `radial-gradient(circle,${slide.color}18 0%,transparent 70%)`, pointerEvents: "none", transition: "background 0.5s" }} />
      <div style={{ position: "absolute", bottom: -60, right: -60, width: 240, height: 240, borderRadius: "50%", background: `radial-gradient(circle,${slide.color}14 0%,transparent 70%)`, pointerEvents: "none", transition: "background 0.5s" }} />

      {/* Contenido principal */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: "100%", maxWidth: 380, textAlign: "center", position: "relative", zIndex: 1 }}>

        {/* Emoji grande */}
        <div style={{
          width: 110, height: 110, borderRadius: 36,
          background: `${slide.color}18`,
          border: `2px solid ${slide.color}30`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 52, marginBottom: 36,
          transition: "background 0.4s, border-color 0.4s",
        }}>
          {slide.emoji}
        </div>

        {/* Título */}
        <h1 style={{
          fontSize: 28, fontWeight: 800, color: "#fff",
          margin: "0 0 16px", lineHeight: 1.15, letterSpacing: -0.8,
          fontFamily: FONT,
        }}>
          {step === 0 && name ? `¡Hola, ${name}! 👋` : slide.title}
        </h1>

        {/* Descripción */}
        <p style={{
          fontSize: 15, color: "#ffffff77", lineHeight: 1.65,
          margin: 0, fontFamily: FONT,
        }}>
          {slide.desc}
        </p>
      </div>

      {/* Dots */}
      <div style={{ display: "flex", gap: 7, justifyContent: "center", marginBottom: 28, position: "relative", zIndex: 1 }}>
        {SLIDES.map((_, i) => (
          <div key={i} style={{
            width: i === step ? 22 : 7, height: 7, borderRadius: 4,
            background: i === step ? slide.color : "#ffffff22",
            transition: "all 0.35s ease",
          }} />
        ))}
      </div>

      {/* Botones */}
      <div style={{ width: "100%", maxWidth: 380, position: "relative", zIndex: 1 }}>
        <button
          onClick={advance}
          style={{
            width: "100%", padding: "16px 20px", borderRadius: 18,
            background: `linear-gradient(135deg, ${slide.color}, ${slide.color}cc)`,
            color: "#fff", border: "none", fontSize: 16, fontWeight: 700,
            cursor: "pointer", fontFamily: FONT, marginBottom: 12,
            boxShadow: `0 4px 20px ${slide.color}44`,
            transition: "background 0.4s, box-shadow 0.4s",
          }}>
          {slide.cta || "Siguiente"}
        </button>

        {!isLast && (
          <button
            onClick={onDone}
            style={{
              width: "100%", padding: "14px 20px", borderRadius: 18,
              background: "transparent", border: "none",
              color: "#ffffff33", fontSize: 14, cursor: "pointer", fontFamily: FONT,
            }}>
            Saltar
          </button>
        )}
      </div>
    </div>
  );
}
