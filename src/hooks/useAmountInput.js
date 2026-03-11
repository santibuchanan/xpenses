/**
 * useAmountInput
 * Maneja input de montos con formateo y parseado.
 *
 * FIX:
 * - Separador de miles visible DENTRO del input mientras se tipea
 * - Coma y punto ambos funcionan como separador decimal
 * - En mobile (inputMode="decimal") la coma del teclado numérico funciona correctamente
 * - El valor raw se guarda internamente para el parseo
 */
import { useState } from "react";

export function useAmountInput(initial = "") {
  // digits: parte entera (string de dígitos puros)
  // decimals: parte decimal (string de dígitos, null = sin parte decimal)
  // hasDecimalSep: el usuario tipió el separador decimal pero puede no tener dígitos aún
  const parseInitial = (v) => {
    if (v === "" || v == null) return { digits: "", decimals: null, hasDecimalSep: false };
    const s = String(v).replace(",", ".");
    const [intPart, decPart] = s.split(".");
    return {
      digits: intPart.replace(/\D/g, "") || "",
      decimals: decPart != null ? decPart.replace(/\D/g, "") : null,
      hasDecimalSep: decPart != null,
    };
  };

  const [state, setState] = useState(() => parseInitial(initial));

  const onChange = (e) => {
    // Normalizar: eliminar todo excepto dígitos, punto y coma
    let val = e.target.value;

    // En algunos teclados mobile el separador llega como "," — normalizarlo
    // Eliminar caracteres no válidos
    val = val.replace(/[^0-9.,]/g, "");

    // Si tiene ambos separadores (1.234,56 o 1,234.56), detectar cuál es decimal
    // Regla: el último separador es el decimal
    const lastComma = val.lastIndexOf(",");
    const lastDot   = val.lastIndexOf(".");

    let intRaw = "";
    let decRaw = null;
    let hasDecimalSep = false;

    if (lastComma === -1 && lastDot === -1) {
      // Solo dígitos
      intRaw = val.replace(/\D/g, "");
    } else {
      const lastSep = Math.max(lastComma, lastDot);
      const sepChar = val[lastSep];
      const beforeSep = val.slice(0, lastSep).replace(/[^0-9]/g, "");
      const afterSep  = val.slice(lastSep + 1).replace(/[^0-9]/g, "");
      intRaw = beforeSep;
      decRaw = afterSep;
      hasDecimalSep = true;
    }

    // Remover ceros a la izquierda innecesarios
    if (intRaw.length > 1 && intRaw[0] === "0") {
      intRaw = intRaw.replace(/^0+/, "") || "0";
    }

    // Limitar decimales a 2 dígitos
    if (decRaw != null && decRaw.length > 2) {
      decRaw = decRaw.slice(0, 2);
    }

    setState({ digits: intRaw, decimals: decRaw, hasDecimalSep });
  };

  // Formatear parte entera con separador de miles (punto)
  const formatInt = (digits) => {
    if (!digits) return "";
    return parseInt(digits, 10).toLocaleString("es-AR", { maximumFractionDigits: 0 });
  };

  // Valor que se muestra en el input SIEMPRE con separador de miles
  const displayValue = (() => {
    if (!state.digits && !state.hasDecimalSep) return "";
    const intFormatted = state.digits ? formatInt(state.digits) : "0";
    if (!state.hasDecimalSep) return intFormatted;
    // Tiene separador decimal — mostrar con coma (estilo es-AR)
    const dec = state.decimals != null ? state.decimals : "";
    return `${intFormatted},${dec}`;
  })();

  // Valor numérico para cálculos
  const numericValue = (() => {
    if (!state.digits && !state.hasDecimalSep) return 0;
    const intPart  = parseInt(state.digits || "0", 10);
    const decPart  = state.decimals ? parseFloat(`0.${state.decimals}`) : 0;
    return intPart + decPart;
  })();

  // Valor formateado para mostrar (igual que displayValue)
  const formatted = displayValue;

  const reset = () => setState({ digits: "", decimals: null, hasDecimalSep: false });
  const set   = (v) => setState(parseInitial(v));

  // onFocus y onBlur son no-ops — el formateado es siempre visible
  const onFocus = () => {};
  const onBlur  = () => {};

  return { displayValue, numericValue, formatted, onChange, onFocus, onBlur, reset, set, raw: state.digits };
}