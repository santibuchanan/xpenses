import { useTheme } from "../theme.jsx";
import { FONT } from "../constants/ui.js";

// Genera array de "YYYY-MM" desde min hasta max inclusive
export function monthsBetween(min, max) {
  const result = [];
  let [y, m] = min.split('-').map(Number);
  const [ey, em] = max.split('-').map(Number);
  while (y < ey || (y === ey && m <= em)) {
    result.push(`${y}-${String(m).padStart(2, '0')}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return result;
}

const MAX_DOTS = 7;

// Barra de navegación de meses: label centrado + dots de paginación.
// Si solo hay 1 mes disponible, solo muestra el label (sin dots).
export default function MonthNavBar({ selectedMonth, minMonth, todayMonth, setSelectedMonth }) {
  const { colors } = useTheme();
  const allMonths = monthsBetween(minMonth, todayMonth);

  const label = (() => {
    const raw = new Date(selectedMonth + "-02").toLocaleString("es-AR", { month: "long", year: "numeric" });
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  })();

  // Ventana deslizante: activo siempre centrado cuando hay más de MAX_DOTS
  let dotsMonths = allMonths;
  if (allMonths.length > MAX_DOTS) {
    const activeIdx = Math.max(0, allMonths.indexOf(selectedMonth));
    const half = Math.floor(MAX_DOTS / 2);
    let start = Math.max(0, activeIdx - half);
    let end = start + MAX_DOTS;
    if (end > allMonths.length) {
      end = allMonths.length;
      start = Math.max(0, end - MAX_DOTS);
    }
    dotsMonths = allMonths.slice(start, end);
  }

  return (
    <div style={{ textAlign: "center", padding: "12px 0 8px" }}>
      <p style={{ margin: "0 0 8px", fontSize: 15, fontWeight: 700, color: colors.text, fontFamily: FONT, letterSpacing: -0.2 }}>
        {label}
      </p>
      {allMonths.length > 1 && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 6 }}>
          {dotsMonths.map(month => {
            const active = month === selectedMonth;
            return (
              <button
                key={month}
                type="button"
                onClick={() => setSelectedMonth(month)}
                style={{
                  width:  active ? 8 : 6,
                  height: active ? 8 : 6,
                  borderRadius: "50%",
                  background: active ? "#4F7FFA" : colors.divider,
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                  transition: "all 0.2s",
                  flexShrink: 0,
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
