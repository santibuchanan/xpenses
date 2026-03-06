import { useState, useRef } from "react";
import { useTheme } from "./theme.jsx";

const SF = `-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', sans-serif`;

// Convierte "yyyy-mm-dd" → "dd-mm-yyyy"
export function toDisplay(val) {
  if (!val) return "";
  const [y, m, d] = val.split("-");
  if (!y || !m || !d) return val;
  return `${d}-${m}-${y}`;
}

// Convierte "dd-mm-yyyy" → "yyyy-mm-dd"
export function toISO(val) {
  if (!val) return "";
  const [d, m, y] = val.split("-");
  if (!d || !m || !y) return val;
  return `${y}-${m}-${d}`;
}

export default function DateInput({ value, onChange, style = {} }) {
  const { colors } = useTheme();
  const [display, setDisplay] = useState(toDisplay(value));
  const hiddenRef = useRef(null);

  // Sincronizar display si el padre cambia `value` (ej: al abrir otro gasto en edición)
  useEffect(() => {
    setDisplay(toDisplay(value));
  }, [value]);

  // Máscara automática: agrega "-" mientras escribís
  const handleChange = (e) => {
    let raw = e.target.value.replace(/[^0-9]/g, "");
    if (raw.length > 8) raw = raw.slice(0, 8);
    let masked = raw;
    if (raw.length > 2) masked = raw.slice(0, 2) + "-" + raw.slice(2);
    if (raw.length > 4) masked = raw.slice(0, 2) + "-" + raw.slice(2, 4) + "-" + raw.slice(4);
    setDisplay(masked);
    if (raw.length === 8) onChange(toISO(masked));
  };

  // Cuando el picker nativo cambia
  const handlePickerChange = (e) => {
    const iso = e.target.value; // yyyy-mm-dd
    setDisplay(toDisplay(iso));
    onChange(iso);
  };

  const inputStyle = {
    width: "100%", padding: "13px 14px", borderRadius: 14,
    border: `2px solid ${colors.inputBorder}`, fontSize: 15,
    fontFamily: SF, outline: "none", boxSizing: "border-box",
    color: colors.inputText, background: colors.input,
    ...style
  };

  return (
    <div style={{ position: "relative", marginBottom: 14 }}>
      <input
        type="text"
        inputMode="numeric"
        placeholder="dd-mm-yyyy"
        value={display}
        onChange={handleChange}
        style={{ ...inputStyle, paddingRight: 44 }}
      />
      {/* Ícono calendario que abre el picker nativo oculto */}
      <button
        type="button"
        onClick={() => hiddenRef.current?.showPicker?.() || hiddenRef.current?.click()}
        style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 4, color: colors.textMuted, fontSize: 20 }}
      >
        📅
      </button>
      <input
        ref={hiddenRef}
        type="date"
        value={value}
        onChange={handlePickerChange}
        style={{ position: "absolute", opacity: 0, pointerEvents: "none", width: 1, height: 1, top: 0, left: 0 }}
      />
    </div>
  );
}