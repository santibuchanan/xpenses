# X-penses — Arquitectura y Contratos de Datos

> **Propósito de este documento:** Referencia de arquitectura que debe consultarse antes de cada sprint. Su objetivo es evitar regresiones: si un cambio toca una zona marcada como "frágil" o modifica un contrato de datos, debe ser tratado con especial cuidado y verificado explícitamente.

**Última actualización:** Sprint 5  
**Deploy:** https://xpenses-seven.vercel.app  
**Firebase project:** xpenses-305ee

---

## Índice

1. [Estructura de archivos](#1-estructura-de-archivos)
2. [Contratos de datos](#2-contratos-de-datos)
3. [Flujo de datos principal](#3-flujo-de-datos-principal)
4. [Descripción por archivo](#4-descripción-por-archivo)
5. [Zonas frágiles](#5-zonas-frágiles)
6. [Lógicas compartidas y dónde viven](#6-lógicas-compartidas-y-dónde-viven)
7. [Estado conocido por pantalla](#7-estado-conocido-por-pantalla)
8. [Pendientes técnicos](#8-pendientes-técnicos)

---

## 1. Estructura de archivos

```
src/
├── App.jsx                          ← Orquestador principal + HomeScreen + SaldosScreen + GraficosScreen + modales inline
├── AccountSelectorScreen.jsx        ← Pantalla de selección y creación de cuentas (pre-login)
├── AddExpenseModal.jsx              ← (en components/expenses/) Modal para agregar gasto
├── ConfigScreen.jsx                 ← Pantalla de configuración inicial al crear cuenta
├── SettingsScreen.jsx               ← Pantalla de ajustes de cuenta existente
├── EditExpenseModal.jsx             ← Modal para editar gasto existente
├── AuthScreen.jsx                   ← Pantalla de login (Google)
├── EmailAuthScreen.jsx              ← Pantalla de login con email/contraseña
├── WelcomeScreen.jsx                ← Pantalla de bienvenida (antes de autenticarse)
├── InviteScreen.jsx                 ← Pantalla de invitación de miembros
├── DateInput.jsx                    ← Componente reutilizable de input de fecha
├── firebase.js                      ← Configuración de Firebase (db, auth)
├── theme.jsx                        ← useTheme hook + CURRENCIES + formatAmount
├── notifications.jsx                ← NotifProvider + useNotif + componentes de notificaciones
├── constants/
│   └── categories.js                ← DEFAULT_CATEGORIES (fuente única de categorías)
├── hooks/
│   ├── useExpenses.js               ← Lógica de add/edit/delete de gastos + markFixedPaid
│   ├── useAmountInput.js            ← Hook para input de montos con formato
│   ├── useSwipeSheet.js             ← Hook para bottom sheets con swipe-to-close
│   └── removeMember.js             ← Función para remover miembros de una cuenta
└── components/
    └── expenses/
        ├── AddExpenseModal.jsx      ← Modal principal de carga de gastos
        └── SwipeableExpenseRow.jsx  ← Fila de gasto con swipe para editar/eliminar
```

---

## 2. Contratos de datos

> ⚠️ Esta sección es la más importante. Antes de modificar cualquier componente, verificar que el contrato de los datos que recibe y emite no cambie.

### 2.1 Member (usuario real de Firestore)

Origen: colección `users/{uid}`

```js
{
  uid:          string,   // ID del usuario en Firebase Auth
  name:         string,   // Nombre para mostrar
  displayName:  string,   // (legacy) nombre de Google
  email:        string,
  color:        string,   // Hex color asignado en la cuenta, ej: "#4F7FFA"
  photo:        string,   // URL de foto de perfil (puede ser undefined)
  salary:       number,   // Solo en cuentas proporcionales (puede ser undefined)
  setupDone:    boolean,  // Si completó el onboarding
  accountIds:   string[], // IDs de cuentas a las que pertenece
}
```

### 2.2 MemberLabel (integrante no vinculado)

Origen: `account.memberLabels[]`

```js
{
  id:        string,         // ID local, ej: "label_0"
  name:      string,
  color:     string,
  linkedUid: string | null,  // null si todavía no aceptó la invitación
  salary:    number,         // Solo en cuentas proporcionales (puede ser undefined)
}
```

### 2.3 allMembers (normalizado — el más importante)

> ⚠️ **Zona de riesgo crítica.** Este array se construye en `App.jsx` y se pasa a casi todos los componentes. Cualquier cambio en su forma rompe múltiples pantallas.

Se construye en `App.jsx` combinando `members` (reales) + `memberLabels` no vinculados:

```js
// Lógica actual en App.jsx
const allMembers = [
  ...members,
  ...memberLabels
    .filter(l => !l.linkedUid && !members.some(m => m.uid === l.id))
    .map(l => ({ uid: l.id, name: l.name, color: l.color, _isLabel: true })),
];
```

**Forma garantizada de cada elemento de `allMembers`:**
```js
{
  uid:      string,   // SIEMPRE presente — para labels es l.id
  name:     string,   // SIEMPRE presente
  color:    string,   // SIEMPRE presente
  _isLabel: boolean,  // true si es un label no vinculado, false/undefined si es usuario real
  // Pueden existir otros campos (photo, salary, email) pero NO se puede asumir su presencia
}
```

**Componentes que reciben `allMembers`:**
- `HomeScreen` → filtra por `_isLabel` para `realMembers` en `calcSaldos`
- `SaldosScreen` → usa directamente como `members` en `calcSaldos`
- `AddExpenseModal` → normaliza internamente con `.uid = m.uid || m.id`
- `MarkPaidModal` (en App.jsx) → normaliza internamente con `.uid = m.uid || m.id`
- `EditExpenseModal` → usa para mostrar nombres en paidBy/forWhom
- `SwipeableExpenseRow` → usa para mostrar nombre del pagador

> 🔴 **Problema activo:** `AddExpenseModal` y `MarkPaidModal` re-normalizan `allMembers` internamente (`m.uid || m.id`) porque no confían en que el array ya esté normalizado. Si `allMembers` en `App.jsx` cambia su forma, esta re-normalización puede ocultar el bug en lugar de revelarlo.

### 2.4 Account

Origen: colección `accounts/{id}`

```js
{
  id:                  string,
  name:                string,
  emoji:               string,
  type:                "personal" | "shared",
  divisionSystem:      "proportional" | "50_50" | "informativo",
  ownerId:             string,
  memberIds:           string[],    // UIDs de usuarios reales vinculados
  memberLabels:        MemberLabel[],
  currency:            string,      // Código ISO, ej: "ARS"
  disabledCategories:  string[],    // IDs de DEFAULT_CATEGORIES desactivadas
  createdAt:           string,      // ISO date string
}
```

### 2.5 Expense

Origen: colección `expenses/` (filtrada por `accountId`)

```js
{
  id:        string,
  accountId: string,
  concept:   string,
  amount:    number,
  type:      "hogar" | "personal" | "mio" | "extraordinary",
  category:  string,           // ID de categoría (DEFAULT o custom)
  date:      string,           // "YYYY-MM-DD"
  month:     string,           // "YYYY-MM"
  paidBy:    string,           // uid del pagador
  forWhom:   string[],         // uids de destinatarios (para type "personal")
  owner:     string,           // uid del dueño (para type "mio")
  deleted:   boolean,          // soft delete
  createdBy: string,
  // Para type "extraordinary":
  paid_${uid}: number,         // monto pagado por cada miembro
}
```

### 2.6 FixedExpense

Origen: subcolección `accounts/{id}/fixedExpenses/`

```js
{
  id:        string,
  name:      string,
  amount:    number,
  dueDay:    number,           // día del mes en que vence
  shared:    boolean,          // true = hogar, false = personal
  startDate: string,           // "YYYY-MM-DD" — desde cuándo aplica
  createdBy: string,           // uid del creador
  payments:  {
    [month: string]: {         // "YYYY-MM"
      paid:   boolean,
      paidBy: string,          // uid
    }
  }
}
```

### 2.7 Settlement

Origen: subcolección `accounts/{id}/settlements/`

```js
{
  id:          string,
  debtorUid:   string,
  creditorUid: string,
  amount:      number,
  date:        string,    // "YYYY-MM-DD"
  month:       string,    // "YYYY-MM"
  full:        boolean,   // true = saldo total, false = parcial
  isCorrection: boolean,  // true = generado automáticamente al eliminar un gasto
}
```

### 2.8 Category

Origen: `constants/categories.js` (DEFAULT) + subcolección `accounts/{id}/categories/` (custom)

```js
{
  id:    string,   // ej: "super", "salud", "otros"
  label: string,
  icon:  string,  // emoji
}
```

---

## 3. Flujo de datos principal

```
Firebase Auth
    │
    ▼
App.jsx (AppInner)
    │
    ├── onSnapshot(users/{uid})          → userProfile, accountIds
    ├── onSnapshot(accounts/{id})        → userAccounts
    ├── onSnapshot(users/{memberUid})    → members[]
    ├── onSnapshot(expenses where accountId==) → expenses[]
    ├── onSnapshot(accounts/{id}/fixedExpenses) → fixedExpenses[]
    ├── onSnapshot(accounts/{id}/settlements)   → settlements[]
    └── onSnapshot(accounts/{id}/categories)    → customCategories[]
    │
    ├── [deriva] allMembers = members + memberLabels sin linkedUid
    │
    ├── HomeScreen(expenses, allMembers, fixedExpenses, settlements, ...)
    ├── SaldosScreen(expenses, allMembers, fixedExpenses, settlements, ...)
    ├── GraficosScreen(expenses, fixedExpenses, ...)
    └── SettingsScreen(account, members, allMembers, ...)
```

---

## 4. Descripción por archivo

### `App.jsx` (1445 líneas) ⚠️ Archivo más grande y más riesgoso

Contiene:
- **`calcSaldos()`** — función pura de cálculo de balances. Recibe expenses, fixedExpenses, members, divisionSystem, currentMonth, settlements. Devuelve `{ [uid]: { paid, owes, balance } }`.
- **`AppInner`** — componente raíz con todos los listeners de Firestore y todo el estado global.
- **`HomeScreen`** — pantalla de inicio con hero, resumen del mes, gastos fijos y lista de movimientos.
- **`SaldosScreen`** — pantalla de saldos con tarjetas por miembro y sección de "saldado de cuentas".
- **`GraficosScreen`** — pantalla de gráficos con BarChart comparativo y PieChart por categoría.
- **`MenuPanel`** — panel lateral con perfil, tamaño de letra y opciones globales.
- **`AppHeader`** — header fijo con menú y notificaciones.
- **`MarkPaidModal`** — modal para registrar pago de gasto fijo.
- **`PartialSettleModal`** — modal para saldar deuda parcialmente.
- **`PassDebtModal`** — modal para pasar deuda al mes siguiente.
- **`FixedExpenseHomeRow`** — fila de gasto fijo en la pantalla de inicio.
- **`ClaimIdentityModal`** — modal para que un usuario recién invitado elija su nombre.

> 🔴 Riesgo: Modificar cualquier sección de este archivo puede afectar las otras porque están en el mismo scope. Los componentes comparten constantes (`FONT`, `CAT_COLORS`) y funciones sin exportarlas formalmente.

### `AccountSelectorScreen.jsx` (757 líneas)

Pantalla previa a entrar a una cuenta. Tiene tres tabs: Cuentas, Notificaciones, Perfil.

- **Lista de cuentas** con `SwipeableAccountRow` (swipe para eliminar).
- **Crear cuenta** (`step === "create"`) — formulario de una sola página con nombre, emoji, tipo, división, divisa, categorías e integrantes.
- **`ProfileTab`** — edición de nombre, alias, tema e idioma del usuario.

Props que recibe:
```js
{
  user:        FirebaseUser,
  userProfile: object,        // documento users/{uid}
  accounts:    Account[],
  onSelect:    (id) => void,  // navega a tab "home"
  onCreated:   (id) => void,  // navega a tab "home"
  onSignOut:   () => void,
}
```

### `AddExpenseModal.jsx` (268 líneas)

Modal de carga de nuevo gasto. Se abre desde el botón "+" de la bottom nav.

Props:
```js
{
  onClose:          () => void,
  onAdd:            (expenseData) => Promise<void>,
  currentUser:      FirebaseUser,
  allMembers:       Member[],   // normalizado desde App.jsx
  currency:         string,
  customCategories: Category[],
  isPersonal:       boolean,
}
```

> ⚠️ Re-normaliza `allMembers` internamente. Ver sección 2.3.

### `ConfigScreen.jsx` (310 líneas)

Se muestra cuando `!userProfile?.setupDone`. Permite al usuario crear su primera cuenta. Al guardar, escribe en Firestore y navega al `AccountSelectorScreen`.

> ⚠️ Si se cambia la estructura del documento `accounts/` aquí, hay que verificar que `SettingsScreen` siga siendo compatible (ambos escriben en el mismo documento).

### `SettingsScreen.jsx` (673 líneas)

Pantalla de ajustes de una cuenta existente. Secciones: Cuenta, Integrantes, Categorías, Gastos fijos, Compartir.

Props:
```js
{
  currentUser:  FirebaseUser,
  userProfile:  object,
  account:      Account,
  members:      Member[],     // solo usuarios reales (sin labels)
  allMembers:   Member[],     // reales + labels
  onSignOut:    () => void,
  onSwitchAccount: () => void,
}
```

> ⚠️ Tiene sus propios listeners de Firestore internos (categorías, gastos fijos). Estos **duplican** los listeners de `App.jsx`. Si `App.jsx` ya tiene los datos, `SettingsScreen` los vuelve a escuchar por su cuenta.

### `hooks/useExpenses.js`

Hook que centraliza las operaciones de escritura sobre gastos:
- `addExpense(data)` — escribe en Firestore + envía notificación
- `handleEditSave(expense)` — actualiza gasto existente
- `deleteExpense(expense)` — soft delete (marca `deleted: true`) con lógica de detección de settlements
- `doDeleteExpense(expense, adjustSettlements)` — ejecuta el delete real
- `markFixedPaid(fixedId, paidByUid, month)` — registra pago de gasto fijo

### `hooks/useAmountInput.js`

Hook para inputs de monto:
- Acepta coma y punto como separador decimal
- `displayValue`: raw cuando está enfocado, formateado con miles cuando no
- `numericValue`: número parseado limpio
- `formatted`: string con separador de miles (para mostrar como hint)

### `hooks/useSwipeSheet.js`

Hook para bottom sheets con swipe-to-close:
- Detecta drag hacia abajo desde un handle
- Si supera 100px, llama `onClose()`
- Expone `dragY`, `isDragging`, `handlers`

### `theme.jsx`

- `useTheme()` — devuelve `{ colors, isDark, toggleTheme, setManualTheme }`
- `CURRENCIES` — objeto con todos los datos de divisas (fuente única)
- `formatAmount(n, currency)` — formatea número según locale de la divisa

### `constants/categories.js`

**Fuente única de categorías default.** Array `DEFAULT_CATEGORIES` con `{ id, label, icon }`.

> ⚠️ Si se agrega o modifica una categoría aquí, afecta: `HomeScreen` (filtros), `AddExpenseModal` (selector), `SettingsScreen` (lista), `GraficosScreen` (torta), `ConfigScreen` (selector al crear cuenta).

---

## 5. Zonas frágiles

> Estas son las zonas que históricamente han causado regresiones. Antes de tocar cualquiera de estas áreas, leer el contrato correspondiente y verificar explícitamente que no cambió.

### 🔴 Alta prioridad

| Zona | Archivo | Riesgo |
|------|---------|--------|
| Construcción de `allMembers` | `App.jsx` línea ~1393 | Rompe AddExpenseModal, MarkPaidModal, SaldosScreen, HomeScreen |
| `calcSaldos()` | `App.jsx` línea ~73 | Afecta HomeScreen (hero balance) y SaldosScreen. Cualquier cambio en cómo se cuentan los fixedExpenses o settlements cambia los números en ambas pantallas |
| Listeners de Firestore en `AppInner` | `App.jsx` línea ~1200 | Si se agrega/quita un listener sin limpiar correctamente el anterior, genera memory leaks o datos duplicados |
| `account.disabledCategories` | `App.jsx`, `SettingsScreen`, `ConfigScreen` | La lógica de qué categorías están activas depende de este campo. Se filtra de forma diferente en ConfigScreen (al crear) vs SettingsScreen (al editar) |

### 🟡 Media prioridad

| Zona | Archivo | Riesgo |
|------|---------|--------|
| `fontSize` — preferencia de usuario | `App.jsx` (MenuPanel) + `localStorage` | Al cambiar de cuenta, `App.jsx` sincroniza `acc.fontSize → localStorage`, lo que puede sobreescribir la preferencia del usuario. La lógica está en dos lugares |
| `visibleFixed` — qué fijos son visibles | `HomeScreen` y `SaldosScreen` (código duplicado) | Ambas pantallas filtran `fixedExpenses` con la misma lógica pero de forma independiente. Si se modifica en una, hay que modificar en la otra |
| Listeners duplicados de categorías y fijos | `App.jsx` + `SettingsScreen` | `SettingsScreen` abre sus propios listeners aunque `App.jsx` ya escucha los mismos datos |
| Inicialización de `forWhom` en `AddExpenseModal` | `AddExpenseModal.jsx` línea ~38 | Se inicializa con `memberList` al primer render. Si `allMembers` llega tarde (Firestore aún cargando), `forWhom` queda vacío |

### 🟢 Baja prioridad (monitorear)

| Zona | Archivo | Riesgo |
|------|---------|--------|
| Scroll lock en sheets | Múltiples archivos | Aplicado con `onTouchMove={e => e.preventDefault()}` en cada sheet por separado. No está centralizado |
| `catExpanded` estado inicial | `HomeScreen` en `App.jsx` | El estado está en `false` correctamente, pero si se agrega un `useEffect` que lo modifique puede volver a expandirse |
| Normalización de fecha en `fmtDate()` | `App.jsx` | Asume formato `YYYY-MM-DD`. Si llega un formato diferente desde Firestore, la función devuelve el string sin formatear |

---

## 6. Lógicas compartidas y dónde viven

| Lógica | Dónde vive | Dónde se usa |
|--------|-----------|-------------|
| Cálculo de saldos | `calcSaldos()` en `App.jsx` | `HomeScreen`, `SaldosScreen` |
| Filtro de gastos fijos visibles | Inline en `HomeScreen` y `SaldosScreen` (duplicado) | Ambas pantallas |
| Normalización de `allMembers` | `App.jsx` (construcción) + inline en `AddExpenseModal` y `MarkPaidModal` (re-normalización) | Múltiples componentes |
| Formateo de montos | `formatAmount()` en `theme.jsx` | Todas las pantallas |
| Operaciones de escritura de gastos | `useExpenses.js` | `App.jsx` |
| Input de montos | `useAmountInput.js` | `AddExpenseModal`, `EditExpenseModal` |
| Bottom sheet swipe | `useSwipeSheet.js` | `AddExpenseModal` (otros usan lógica inline) |
| Categorías default | `constants/categories.js` | `App.jsx`, `AddExpenseModal`, `ConfigScreen`, `SettingsScreen` |
| Divisas | `CURRENCIES` en `theme.jsx` | `App.jsx`, `AccountSelectorScreen`, `ConfigScreen`, `SettingsScreen` |

---

## 7. Estado conocido por pantalla

Esta sección refleja el comportamiento **esperado y confirmado** al final del Sprint 5. Usar como referencia para detectar regresiones.

### HomeScreen ✅
- Hero muestra total del mes (gastos normales + fijos) y balance personal
- Pills de filtro muestran solo el emoji de la categoría (sin label)
- "Top categorías" inicia colapsado (`catExpanded = false`)
- Gastos fijos tienen 3 niveles de expansión: sección principal → Hogar → Personal
- En cuentas personales, los fijos se muestran sin subsecciones
- Botón "Pagar ✓" abre `MarkPaidModal` con todos los miembros (reales + labels)
- Settlements del mes se muestran al final de la lista de movimientos

### SaldosScreen ✅
- Tarjeta por miembro con "Pagó", "Le toca" y balance
- En cuentas proporcionales, muestra el porcentaje de la cuenta
- Sección "Saldado de cuentas" con historial de pagos parciales
- Botones "Saldar" y "Saldar parcial" por par deudor/acreedor
- Botón "Pasar saldo al mes siguiente" disponible si hay deudas pendientes
- **No disponible en cuentas personales** (redirige a Home)

### GraficosScreen ✅
- Toggle "Por mes" / "Por tipo"
- "Por tipo" muestra 4 barras: Hogar (azul), Personal (verde), Extra (naranja), Fijos (violeta)
- Fijos en el gráfico = suma de fijos activos ese mes (startDate <= mes), como presupuesto fijo
- Torta por categoría con selector de mes (flechas ← →)
- Excluye gastos con `deleted: true`

### AddExpenseModal ✅
- Default `paidBy` = usuario que carga
- Default `forWhom` = todos los miembros (para tipo "hogar")
- Sin botón X — se cierra con swipe o confirmando descarte
- Altura máxima 82vh
- Monto: raw mientras se escribe, formateado con miles al desenfocarse
- Incluye labels no vinculados en "Pagó" y "Para quién"

### AccountSelectorScreen ✅
- Contador de miembros = `memberIds.length + labels sin linkedUid`
- Botón "+ Nueva cuenta" flotante, siempre visible
- Crear cuenta: todo en una sola página con scroll
- Creador aparece como integrante 0 con su nombre
- Categorías: ninguna por default, mínimo 1 obligatoria
- Al crear/seleccionar cuenta → navega a tab "home"

### SettingsScreen ✅
- Muestra solo categorías activas de la cuenta (las elegidas al crear + custom)
- Sin sección "Tamaño de letra" (movida al MenuPanel)
- Tiene sus propios listeners de Firestore para categorías y gastos fijos

### MenuPanel ✅
- Selector de tamaño de letra: Pequeño / Mediano / Grande
- Guardado en `localStorage` como `expenseFontSize`
- Propagado via `CustomEvent("expenseFontSizeChange")`

---

## 8. Pendientes técnicos

### Deuda técnica conocida

| Item | Impacto | Esfuerzo |
|------|---------|----------|
| `App.jsx` demasiado grande — `HomeScreen`, `SaldosScreen`, `GraficosScreen` deberían ser archivos propios | Cada modificación al archivo pone en riesgo las otras pantallas | Alto |
| `calcSaldos()` debería vivir en `hooks/useBalances.js` | No se puede probar de forma aislada | Medio |
| `allMembers` debería normalizarse con una función centralizada (`normalizeMember()`) en lugar de inline en cada componente | Inconsistencias silenciosas cuando cambia la estructura | Medio |
| Listeners duplicados de `categories` y `fixedExpenses` en `App.jsx` y `SettingsScreen` | Lecturas innecesarias de Firestore | Bajo |
| Scroll lock de sheets no centralizado | Al agregar un nuevo sheet hay que recordar agregarlo manualmente | Bajo |

### Features pendientes

| Feature | Estado | Notas |
|---------|--------|-------|
| Eliminar cuenta de usuario | Pendiente decisión | Requiere: borrar `users/{uid}`, desvincular de cuentas compartidas, eliminar cuentas propias. Tiene impacto en Firestore — definir si es frontend puro o función de backend |
| `fontSize` por dispositivo vs por cuenta | Inconsistencia activa | Al cambiar de cuenta, `App.jsx` sincroniza `acc.fontSize → localStorage`, sobreescribiendo la preferencia del menú |

---

*Este documento debe actualizarse al final de cada sprint reflejando los cambios realizados y el nuevo estado conocido de cada pantalla.*