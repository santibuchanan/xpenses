import { createContext, useContext, useState } from "react";
import { es } from "./es.js";
import { en } from "./en.js";

const translations = { es, en };
const I18nContext = createContext({});

export function I18nProvider({ children }) {
  const [lang, setLang] = useState(
    localStorage.getItem("xpenses-lang") || "es"
  );

  const t = translations[lang] || translations.es;

  const setLanguage = (l) => {
    setLang(l);
    localStorage.setItem("xpenses-lang", l);
  };

  return (
    <I18nContext.Provider value={{ t, lang, setLanguage }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  return useContext(I18nContext);
}