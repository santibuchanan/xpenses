import { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext({});

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setIsDark(mq.matches);
    const handler = (e) => setIsDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const colors = isDark ? {
    bg: "#0f0f13",
    card: "#1a1a2e",
    cardBorder: "#ffffff0a",
    text: "#f0f0f0",
    textMuted: "#888",
    textSubtle: "#555",
    input: "#252535",
    inputBorder: "#ffffff14",
    inputText: "#f0f0f0",
    navBg: "#1a1a2e",
    navBorder: "#ffffff0a",
    pill: "#252535",
    shadow: "0 2px 12px rgba(0,0,0,0.3)",
    headerBg: "linear-gradient(140deg, #0a0a14 0%, #0a1628 100%)",
    divider: "#ffffff0f",
    tagBg: (color) => color + "33",
    statBg: (color) => color + "22",
    danger: "#ff6b6b",
    dangerBg: "#ff6b6b18",
    success: "#2ecc71",
    successBg: "#2ecc7118",
  } : {
    bg: "#f7f8fc",
    card: "#ffffff",
    cardBorder: "transparent",
    text: "#1a1a2e",
    textMuted: "#888",
    textSubtle: "#aaa",
    input: "#fafafa",
    inputBorder: "#e8e8e8",
    inputText: "#1a1a2e",
    navBg: "#ffffff",
    navBorder: "#f0f0f0",
    pill: "#f0f0f0",
    shadow: "0 2px 12px rgba(0,0,0,0.05)",
    headerBg: "linear-gradient(140deg, #1a1a2e 0%, #0f3460 100%)",
    divider: "#f0f0f0",
    tagBg: (color) => color + "22",
    statBg: (color) => color + "14",
    danger: "#e74c3c",
    dangerBg: "#fee",
    success: "#2ecc71",
    successBg: "#2ecc7118",
  };

  return (
    <ThemeContext.Provider value={{ isDark, colors }}>
      <div style={{ background: colors.bg, minHeight: "100vh" }}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

// Currency config
export const CURRENCIES = {
  ARS: { symbol: "$", name: "Peso argentino", locale: "es-AR", code: "ARS" },
  USD: { symbol: "US$", name: "Dólar estadounidense", locale: "en-US", code: "USD" },
  EUR: { symbol: "€", name: "Euro", locale: "de-DE", code: "EUR" },
};

export function formatAmount(n, currencyCode = "ARS") {
  const cur = CURRENCIES[currencyCode] || CURRENCIES.ARS;
  return new Intl.NumberFormat(cur.locale, {
    style: "currency", currency: cur.code, maximumFractionDigits: 0
  }).format(n || 0);
}