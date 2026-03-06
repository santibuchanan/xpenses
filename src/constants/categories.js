// src/constants/categories.js
// Fuente única de verdad para categorías.
// Importar desde acá en App.jsx, EditExpenseModal.jsx, SettingsScreen.jsx y ConfigScreen.jsx.

export const DEFAULT_CATEGORIES = [
  { id: "super",       label: "Supermercado",          icon: "🛒" },
  { id: "salidas",     label: "Salidas",                icon: "🍕" },
  { id: "servicios",   label: "Impuestos y Servicios",  icon: "💡" },
  { id: "transporte",  label: "Transporte",             icon: "🚗" },
  { id: "salud",       label: "Salud",                  icon: "💊" },
  { id: "ropa",        label: "Ropa y Calzado",         icon: "👗" },
  { id: "hogar",       label: "Hogar",                  icon: "🏠" },
  { id: "otros",       label: "Otros",                  icon: "📦" },
];

// Listado extendido usado en ConfigScreen para selección inicial de categorías
export const ALL_CATEGORIES = [
  ...DEFAULT_CATEGORIES,
  { id: "mascotas",        label: "Mascotas",        icon: "🐶" },
  { id: "viajes",          label: "Viajes",          icon: "✈️" },
  { id: "gimnasio",        label: "Gimnasio",        icon: "🏋️" },
  { id: "educacion",       label: "Educación",       icon: "📚" },
  { id: "tecnologia",      label: "Tecnología",      icon: "📱" },
  { id: "entretenimiento", label: "Entretenimiento", icon: "🎮" },
  { id: "restaurantes",    label: "Restaurantes",    icon: "🍺" },
  { id: "cafe",            label: "Café",            icon: "☕" },
  { id: "regalos",         label: "Regalos",         icon: "🎁" },
  { id: "belleza",         label: "Belleza",         icon: "💈" },
  { id: "suscripciones",   label: "Suscripciones",   icon: "🎵" },
];

// IDs seleccionados por defecto en el setup inicial
export const DEFAULT_SELECTED_CATEGORY_IDS = [
  "super", "salidas", "servicios", "transporte", "salud", "ropa", "hogar", "otros",
];
