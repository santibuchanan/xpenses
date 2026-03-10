/**
 * useAmountInput
 * Maneja input de montos con formateo y parseado.
 * 
 * Uso:
 *   const { displayValue, numericValue, onChange } = useAmountInput(initialValue);
 *   <input value={displayValue} onChange={onChange} inputMode="decimal" />
 */
import { useState } from "react";

export function useAmountInput(initial = "") {
  // Guardamos el string "crudo" que el usuario escribe
  const [raw, setRaw] = useState(initial !== "" ? String(initial) : "");

  const onChange = (e) => {
    let val = e.target.value;
    // Solo permitir dígitos, punto y coma
    val = val.replace(/[^0-9.,]/g, "");
    // Solo una coma o punto decimal
    const parts = val.split(/[.,]/);
    if (parts.length > 2) val = parts[0] + "." + parts.slice(1).join("");
    setRaw(val);
  };

  // Valor numérico limpio
  const numericValue = parseFloat(raw.replace(",", ".")) || 0;

  // Valor para mostrar en el input (lo que escribe el usuario, sin formatear)
  const displayValue = raw;

  // Preview formateado (para mostrar debajo del input)
  const formatted = numericValue > 0
    ? numericValue.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })
    : "";

  const reset = () => setRaw("");
  const set   = (v) => setRaw(v !== "" && v != null ? String(v) : "");

  return { displayValue, numericValue, formatted, onChange, reset, set, raw };
}