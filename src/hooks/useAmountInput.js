/**
 * useAmountInput
 * Maneja input de montos con formateo y parseado.
 *
 * FIX CRÍTICO (v3):
 * El bug era que el displayValue formateado ("1.250") se re-enviaba al onChange
 * como e.target.value en el siguiente keystroke. El punto de miles era
 * interpretado como separador decimal → "1.250" → intRaw="1", decRaw="250" → $1.25
 *
 * Solución: el state guarda SOLO dígitos puros sin formato. El onChange
 * SIEMPRE extrae solo los dígitos del valor ingresado, ignorando puntos/comas
 * que vengan de miles ya formateados. El separador decimal se detecta solo
 * cuando el usuario lo tipea explícitamente al final del string.
 */
import { useState } from "react";

export function useAmountInput(initial = "") {
  // State: dígitos enteros puros + dígitos decimales + si hay separador decimal
  const parseInitial = (v) => {
    if (v === "" || v == null) return { intDigits: "", decDigits: "", hasDecSep: false };
    const s = String(v);
    // Normalizar: tratar coma como punto decimal
    const normalized = s.replace(",", ".");
    const [intPart = "", decPart] = normalized.split(".");
    return {
      intDigits: intPart.replace(/\D/g, ""),
      decDigits: decPart != null ? decPart.replace(/\D/g, "").slice(0, 2) : "",
      hasDecSep: decPart != null,
    };
  };

  const [state, setState] = useState(() => parseInitial(initial));

  const onChange = (e) => {
    const raw = e.target.value;

    // Caso vacío
    if (!raw || raw === "") {
      setState({ intDigits: "", decDigits: "", hasDecSep: false });
      return;
    }

    // PASO 1: ¿el usuario está escribiendo un separador decimal?
    // Detectar si el ÚLTIMO carácter es coma o punto
    const lastChar = raw[raw.length - 1];
    const userTypedDecSep = lastChar === "," || lastChar === ".";

    // PASO 2: Separar en parte entera y decimal
    // Buscamos el ÚLTIMO punto o coma que no sea separador de miles.
    // Criterio: si hay UNA sola coma/punto, es decimal.
    // Si hay más de una, el último es decimal y los anteriores son miles.
    const commas = (raw.match(/,/g) || []).length;
    const dots   = (raw.match(/\./g) || []).length;
    const totalSeps = commas + dots;

    let intRaw = "";
    let decRaw = "";
    let hasDecSep = false;

    if (totalSeps === 0 || userTypedDecSep) {
      // Sin separadores: solo extraer dígitos
      intRaw = raw.replace(/\D/g, "");
      hasDecSep = userTypedDecSep;
    } else {
      // Buscar la posición del separador decimal (el último separador)
      const lastCommaIdx = raw.lastIndexOf(",");
      const lastDotIdx   = raw.lastIndexOf(".");
      const lastSepIdx   = Math.max(lastCommaIdx, lastDotIdx);

      const beforeSep = raw.slice(0, lastSepIdx);
      const afterSep  = raw.slice(lastSepIdx + 1);

      // ¿Es realmente decimal o es solo miles?
      // Si después del último sep hay exactamente 3 dígitos (y nada más), 
      // probablemente es un separador de miles, no decimal.
      // Pero si el usuario lo tipeo explícitamente como último char antes de borrar,
      // lo tratamos como decimal. Usamos heurística: si afterSep tiene 0-2 dígitos → decimal.
      const afterDigits = afterSep.replace(/\D/g, "");

      if (afterDigits.length <= 2) {
        // Tratar como separador decimal
        intRaw = beforeSep.replace(/\D/g, "");
        decRaw = afterDigits;
        hasDecSep = true;
      } else {
        // Tratar como separador de miles — ignorarlo, extraer todos los dígitos
        intRaw = raw.replace(/\D/g, "");
        hasDecSep = false;
      }
    }

    // Limpiar ceros a la izquierda en parte entera
    if (intRaw.length > 1 && intRaw[0] === "0") {
      intRaw = intRaw.replace(/^0+/, "") || "";
    }

    // Limitar decimales a 2
    decRaw = decRaw.slice(0, 2);

    setState({ intDigits: intRaw, decDigits: decRaw, hasDecSep });
  };

  // Formatear parte entera con separador de miles (punto en es-AR)
  const formatInt = (digits) => {
    if (!digits) return "";
    return parseInt(digits, 10).toLocaleString("es-AR", { maximumFractionDigits: 0 });
  };

  // displayValue: lo que se muestra en el input
  const displayValue = (() => {
    if (!state.intDigits && !state.hasDecSep) return "";
    const intFormatted = state.intDigits ? formatInt(state.intDigits) : "0";
    if (!state.hasDecSep) return intFormatted;
    return `${intFormatted},${state.decDigits}`;
  })() ?? "";

  // numericValue: para cálculos
  const numericValue = (() => {
    if (!state.intDigits && !state.hasDecSep) return 0;
    const intPart = parseInt(state.intDigits || "0", 10);
    const decPart = state.decDigits ? parseFloat(`0.${state.decDigits}`) : 0;
    return intPart + decPart;
  })();

  const formatted = displayValue;
  const reset = () => setState({ intDigits: "", decDigits: "", hasDecSep: false });
  const set   = (v) => setState(parseInitial(v));
  const onFocus = () => {};
  const onBlur  = () => {};

  return { displayValue, numericValue, formatted, onChange, onFocus, onBlur, reset, set, raw: state.intDigits };
}