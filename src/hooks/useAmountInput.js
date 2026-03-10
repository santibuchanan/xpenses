/**
 * useAmountInput
 * Maneja input de montos con formateo y parseado.
 * 
 * FIX: 
 * - Coma y punto ambos funcionan como separador decimal
 * - displayValue muestra el número formateado con separador de miles mientras se escribe
 * - El valor raw se guarda internamente para el parseo
 */
import { useState, useRef } from "react";

export function useAmountInput(initial = "") {
  // raw: string numérico limpio (solo dígitos + punto decimal)
  const [raw, setRaw] = useState(initial !== "" ? String(initial) : "");
  // isFocused: cuando está enfocado, mostramos el raw; al desenfocarse mostramos el formateado
  const isFocused = useRef(false);
  const [, forceUpdate] = useState(0);

  const onChange = (e) => {
    let val = e.target.value;

    // Eliminar todo excepto dígitos, punto y coma
    val = val.replace(/[^0-9.,]/g, "");

    // Eliminar separadores de miles (puntos) que pudiera haber si el usuario borra caracteres
    // Normalizar: reemplazar coma por punto para el parseo
    // Permitir solo un separador decimal
    const hasComa = val.includes(",");
    const hasPunto = val.includes(".");

    if (hasComa && hasPunto) {
      // Si tiene ambos, el último escrito es el decimal
      // Asumimos que el punto es separador de miles y la coma es decimal
      val = val.replace(/\./g, "").replace(",", ".");
    } else if (hasComa) {
      val = val.replace(",", ".");
    }

    // Solo un punto decimal
    const parts = val.split(".");
    if (parts.length > 2) {
      val = parts[0] + "." + parts.slice(1).join("");
    }

    // Remover ceros a la izquierda innecesarios (pero preservar "0." para decimales)
    if (val.length > 1 && val[0] === "0" && val[1] !== ".") {
      val = val.replace(/^0+/, "") || "0";
    }

    setRaw(val);
  };

  const onFocus = () => {
    isFocused.current = true;
    forceUpdate(n => n + 1);
  };

  const onBlur = () => {
    isFocused.current = false;
    forceUpdate(n => n + 1);
  };

  // Valor numérico limpio
  const numericValue = parseFloat(raw) || 0;

  // Valor formateado con separador de miles (para mostrar)
  const formatted = numericValue > 0
    ? numericValue.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })
    : "";

  // FIX: displayValue muestra el número formateado con miles cuando el campo NO está enfocado
  // Cuando está enfocado, muestra el raw para no interrumpir el tipeo
  const displayValue = isFocused.current
    ? raw
    : (numericValue > 0 ? formatted : raw);

  const reset = () => setRaw("");
  const set   = (v) => setRaw(v !== "" && v != null ? String(v) : "");

  return { displayValue, numericValue, formatted, onChange, onFocus, onBlur, reset, set, raw };
}