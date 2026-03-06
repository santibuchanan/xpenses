import { useTheme } from "../../theme.jsx";

const FONT = `'DM Sans', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif`;

export function Card({ children, style = {} }) {
  const { colors } = useTheme();
  return (
    <div style={{
      background: colors.card, borderRadius: 20, padding: 18, marginBottom: 12,
      boxShadow: colors.shadow, border: `1px solid ${colors.cardBorder}`, ...style,
    }}>
      {children}
    </div>
  );
}

export function Tag({ color, children }) {
  return (
    <span style={{
      background: color + "22", color, fontSize: 10, fontWeight: 700,
      padding: "3px 8px", borderRadius: 20, fontFamily: FONT,
    }}>
      {children}
    </span>
  );
}

export function SectionTitle({ children, style = {} }) {
  const { colors } = useTheme();
  return (
    <p style={{ fontSize: 20, fontWeight: 700, margin: "22px 0 10px", color: colors.text, fontFamily: FONT, ...style }}>
      {children}
    </p>
  );
}

export function StatPill({ label, value, color }) {
  const { colors } = useTheme();
  return (
    <div style={{ background: color + "14", borderRadius: 14, padding: "12px 14px", flex: 1 }}>
      <p style={{ margin: "0 0 3px", fontSize: 10, color, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, fontFamily: FONT }}>{label}</p>
      <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: colors.text, fontFamily: FONT }}>{value}</p>
    </div>
  );
}

export function Spinner({ text = "Cargando..." }) {
  const { colors } = useTheme();
  return (
    <div style={{ textAlign: "center", padding: 60, color: colors.textMuted, fontSize: 14, fontFamily: FONT }}>
      {text}
    </div>
  );
}

/** Handle visual de bottom sheet */
export function SheetHandle({ colors }) {
  return (
    <div style={{ width: 36, height: 4, background: colors.divider, borderRadius: 2, margin: "0 auto" }} />
  );
}
