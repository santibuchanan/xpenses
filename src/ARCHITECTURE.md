# X-penses — Arquitectura y Contratos de Datos

> **Propósito:** Referencia de arquitectura que debe consultarse antes de cada sprint. Evita regresiones en zonas frágiles.

**Última actualización:** Sesión Mar 26, 2026
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
├── App.jsx                          ← Orquestador principal
├── InviteJoinScreen.jsx             ← Flujo de invite autónomo (auth + join en un componente)
├── InviteScreen.jsx                 ← Modal de generación de invite (link permanente reutilizable)
├── AccountSelectorScreen.jsx        ← Selector de cuentas con skeleton loading
├── OnboardingScreen.jsx             ← Bienvenida inicial (3 slides), mostrado una vez por dispositivo
├── ConfigScreen.jsx                 ← Onboarding inicial al crear primera cuenta
├── SettingsScreen.jsx               ← Ajustes de cuenta existente
├── EditExpenseModal.jsx             ← Modal editar gasto
├── AuthScreen.jsx                   ← Login con Google
├── EmailAuthScreen.jsx              ← Login con email/contraseña
├── WelcomeScreen.jsx                ← Pantalla de bienvenida
├── DateInput.jsx                    ← Input de fecha reutilizable
├── firebase.js                      ← Config Firebase (db, auth)
├── theme.jsx                        ← useTheme + CURRENCIES + formatAmount
├── notifications.jsx                ← NotifProvider + useNotif + componentes
├── constants/
│   ├── categories.js                ← DEFAULT_CATEGORIES (fuente única)
│   └── ui.js                        ← FONT, constantes de UI
├── hooks/
│   ├── useAccountData.js            ← userAccounts, account, members, accountsLoading
│   ├── useFirestoreData.js          ← expenses, categories, fixedExpenses, settlements, expensesLoading
│   ├── useBalances.js               ← calcSaldos() con precisión r2 (2 decimales)
│   ├── useExpenses.js               ← addExpense, handleEditSave, deleteExpense, markFixedPaid
│   ├── useSwipeSheet.js             ← Swipe-to-close para bottom sheets
│   ├── useAmountInput.js            ← Input de montos con formato
│   └── removeMember.js             ← Función para remover miembros
├── utils/
│   └── normalizeMembers.js          ← buildAllMembers()
└── screens/
    ├── HomeScreen.jsx               ← Pantalla principal con movimientos y skeleton
    ├── SaldosScreen.jsx             ← Saldos, settlements, historial
    └── GraficosScreen.jsx           ← Gráficos por categoría y mes
└── components/
    └── expenses/
        ├── AddExpenseModal.jsx      ← Modal agregar gasto
        └── SwipeableExpenseRow.jsx  ← Fila de gasto con swipe
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
  id:        string,         // ID local, ej: "label_1234567890"
  name:      string,
  color:     string,
  linkedUid: string | null,  // null si todavía no aceptó la invitación
  salary:    number,         // Solo en cuentas proporcionales (puede ser undefined)
}
```

### 2.3 allMembers (normalizado — el más importante)

> ⚠️ **Zona de riesgo crítica.** Se construye via `buildAllMembers()` en `utils/normalizeMembers.js`. Cualquier cambio en su forma rompe múltiples pantallas.

**Forma garantizada de cada elemento:**
```js
{
  uid:      string,   // SIEMPRE presente — para labels es l.id
  name:     string,   // SIEMPRE presente
  color:    string,   // SIEMPRE presente
  _isLabel: boolean,  // true si es label no vinculado
  // Pueden existir otros campos (photo, salary, email) pero NO se puede asumir su presencia
}
```

**Regla crítica:** usar `_isLabel` para excluir solo cuando la operación requiere un usuario real de Firebase Auth (notificaciones, auth checks). NO usar para cálculos de saldo — los labels participan en gastos con su uid propio.

**Componentes que reciben `allMembers`:**
- `HomeScreen` → filtra `!!m.uid` para `realMembers` en `calcSaldos`
- `SaldosScreen` → NO filtra — incluye labels porque tienen uid estable
- `useExpenses.getNotificationRecipients(expense)` → switch por tipo: hogar/extraordinary → todos menos creador; personal → solo forWhom menos creador; mio → nadie; filtra `_isLabel`
- `useExpenses.doDeleteExpense` → usa `members` (no allMembers) en settlement correctivo — labels con uid estable participan
- `AddExpenseModal` → normaliza internamente con `.uid = m.uid || m.id`
- `EditExpenseModal` → usa para mostrar nombres en paidBy/forWhom
- `SwipeableExpenseRow` → usa para mostrar nombre del pagador

### 2.4 Account

Origen: colección `accounts/{id}`

```js
{
  id:                  string,
  name:                string,
  emoji:               string,
  type:                "personal" | "shared" | "pozo",
  //   "personal" → cuenta individual, sin saldos, sin tab Saldos
  //   "shared"   → cuenta compartida con saldos entre miembros
  //   "pozo"     → fondo común; solo tipos hogar/extraordinary; sin saldos entre miembros
  divisionSystem:      "proportional" | "50_50" | "pozo",
  //   "pozo" reemplaza "informativo" (migración forward-only)
  ownerId:             string,
  memberIds:           string[],    // UIDs de usuarios reales vinculados
  memberLabels:        MemberLabel[],
  currency:            string,      // Código ISO, ej: "ARS"
  disabledCategories:  string[],    // IDs de DEFAULT_CATEGORIES desactivadas
  categoryBudgets:     { _total?: number, [catId: string]: number },  // Fase 2 — solo en cuentas pozo
  createdAt:           string,      // ISO date string
}
```

> **Regla de derivación:** `type = divisionSystem === "pozo" ? "pozo" : accountType` al crear en `CreateAccountScreen`. Una cuenta con `divisionSystem = "pozo"` guarda `type = "pozo"` en Firestore.

### 2.5 Expense

Origen: colección `expenses/` (filtrada por `accountId`)

```js
{
  id:        string,
  accountId: string,
  concept:   string,
  amount:    number,
  type:      "hogar" | "personal" | "mio" | "extraordinary",
  category:  string,
  date:      string,           // "YYYY-MM-DD"
  month:     string,           // "YYYY-MM"
  paidBy:    string | Array<{uid: string, amount: number}>,
  //   string     → formato viejo (pagador único, uid)
  //   Array      → multi-pagador; cada entrada = {uid, amount} — suma debe igualar expense.amount
  //   ⚠️ calcSaldos() y getAmountPaidBy() son retrocompatibles con ambos formatos
  forWhom:   string[],         // uids de destinatarios (type "personal")
  owner:     string,           // uid del dueño (type "mio")
  deleted:   boolean,          // soft delete
  createdBy: string,
  createdAt: string,           // ISO date string
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
  dueDay:    number,
  shared:    boolean,          // true = hogar, false = personal
  startDate: string,           // "YYYY-MM-DD"
  createdBy: string,
  payments:  {
    [month: string]: {         // "YYYY-MM"
      paid:   boolean,
      paidBy: string,
    }
  }
}
```

### 2.7 Settlement

Origen: subcolección `accounts/{id}/settlements/`

```js
{
  id:           string,
  debtorUid:    string,
  creditorUid:  string,
  amount:       number,
  date:         string,    // "YYYY-MM-DD"
  month:        string,    // "YYYY-MM"
  full:         boolean,   // true = saldo total, false = parcial
  isCorrection: boolean,   // true = generado automáticamente al eliminar un gasto
  createdBy:    string,    // uid del usuario que registró el pago
  createdAt:    string,    // ISO date string
}
```

> **Permisos de eliminación:** puede eliminar un settlement el deudor (`debtorUid`), quien lo creó (`createdBy`) o el owner de la cuenta. Ver `canDeleteSettlement()` en `SaldosScreen`.

### 2.8 Category

Origen: `constants/categories.js` (DEFAULT) + subcolección `accounts/{id}/categories/` (custom)

```js
{
  id:    string,
  label: string,
  icon:  string,  // emoji
}
```

### 2.9 Invite

Origen: colección `invites/`

```js
{
  id:          string,   // formato: "{accountId}_permanent"
  accountId:   string,
  accountName: string,
  createdBy:   string,
  createdAt:   timestamp,
  used:        false,    // siempre false — link permanente reutilizable
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
    ├── useAccountData(accountIds, selectedAccountId, authUser, userProfile)
    │     ├── onSnapshot(accounts/{id})        → userAccounts, accountsLoading
    │     └── onSnapshot(users/{memberUid})    → members[]
    │
    ├── useFirestoreData(account?.id)
    │     ├── onSnapshot(expenses where accountId==) → expenses[], expensesLoading
    │     ├── onSnapshot(accounts/{id}/categories)   → customCategories[]
    │     ├── onSnapshot(accounts/{id}/fixedExpenses) → fixedExpenses[]
    │     └── onSnapshot(accounts/{id}/settlements)  → settlements[]
    │
    ├── buildAllMembers(members, account.memberLabels) → allMembers[]
    │
    ├── HomeScreen(expenses, allMembers, fixedExpenses, settlements, isLoading, ...)
    ├── SaldosScreen(expenses, allMembers, fixedExpenses, settlements, ...)
    ├── GraficosScreen(expenses, fixedExpenses, ...)
    └── SettingsScreen(account, members, allMembers, ...)
```

### Flujo de invite

```
Usuario abre: xpenses-seven.vercel.app/#invite=XXX
    │
    ▼
App.jsx lee hash → inviteIdFromUrl !== null
    │
    ▼
Renderiza InviteJoinScreen (completamente autónomo)
    │
    ├── Carga invite y account desde Firestore
    ├── Muestra: "Te invitaron a {cuenta}"
    ├── Usuario se autentica (Google o email) — onAuthStateChanged interno
    ├── Si hay labels sin vincular → selector "¿Cuál sos vos?"
    └── runTransaction: agrega a memberIds, vincula label, setupDone: true
    │
    ▼
window.location.replace(origin) → recarga app con usuario autenticado
```

---

## 4. Descripción por archivo

### `App.jsx`

Orquestador principal. Contiene:
- **`AppInner`** — componente raíz con estado global, hooks de datos, routing de pantallas
- **`MenuPanel`** — panel lateral con perfil, tema, tamaño de letra
- **`AppHeader`** — header fijo con menú y notificaciones
- **`ClaimIdentityModal`** — modal para elegir identidad al unirse via invite (legacy, usado cuando no hay InviteJoinScreen)

> ⚠️ Riesgo: Modificar cualquier sección puede afectar las otras. `inviteIdFromUrl` se lee del hash al montar — no re-ejecuta.

### `hooks/useAccountData.js`

```js
// Retorna:
{
  userAccounts:    Account[],
  account:         Account | null,
  members:         Member[],
  accountsLoading: boolean,  // false cuando todos los listeners respondieron
}
```

### `hooks/useFirestoreData.js`

```js
// Retorna:
{
  expenses:         Expense[],
  setExpenses:      fn,
  customCategories: Category[],
  fixedExpenses:    FixedExpense[],
  settlements:      Settlement[],
  expensesLoading:  boolean,  // false cuando primer snapshot recibido
}
```

### `hooks/useBalances.js` — `calcSaldos()`

Función pura de cálculo de saldos:
- Precisión r2: `Math.round(n * 100) / 100`
- `splitExact()`: divide con centavos exactos, residuo va al pagador
- Threshold de display: 0.005

```js
calcSaldos(expenses, fixedExpenses, members, divisionSystem, currentMonth, settlements)
// → { [uid]: { paid, owes, balance } }
```

### `hooks/useExpenses.js`

Recibe `allMembers` (además de `members`) para determinar destinatarios de notificaciones.

- `getNotificationRecipients(expense)` — retorna array de members a notificar según `expense.type`
- `addExpense(data)` — escribe en Firestore + notifica según tipo
- `handleEditSave(expense)` — actualiza gasto existente + notifica según tipo
- `deleteExpense(expense)` — soft delete con detección de settlements
- `doDeleteExpense(expense, adjustSettlements)` — delete real
- `markFixedPaid(fixedId, paidByUid, month)` — registra pago de fijo

### `utils/normalizeMembers.js` — `buildAllMembers()`

Construye `allMembers` combinando usuarios reales + labels no vinculados. Garantiza que todos tengan `uid`, `name`, `color`.

### `AccountSelectorScreen.jsx`

Pantalla previa a entrar a una cuenta. Tres tabs: Cuentas, Notificaciones, Perfil.
- Skeleton loading mientras `isLoading` es true
- Estado vacío "No tenés cuentas" solo cuando `!isLoading && accounts.length === 0`
- Íconos y labels por tipo: Personal 👤 verde, Compartida 👥 azul, Pozo Común 🪣 ámbar

Props:
```js
{
  user, userProfile, accounts, onSelect, onCreated, onSignOut,
  isLoading: boolean,  // de accountsLoading en useAccountData
}
```

### `InviteJoinScreen.jsx`

Componente completamente autónomo — maneja todo el flujo de invite sin depender de App.jsx.
- Carga datos del invite y la cuenta
- Autentica al usuario inline (Google o email)
- Si hay labels sin vincular → selector de identidad
- `runTransaction` para join atómico
- Al terminar: `window.location.replace(origin)`

### `SettingsScreen.jsx`

> ⚠️ Tiene sus propios listeners de Firestore para categorías y gastos fijos — duplican los de `useFirestoreData`. Pendiente de limpiar (T1).

### `theme.jsx`

- `useTheme()` → `{ colors, isDark, toggleTheme, setManualTheme }`
- `CURRENCIES` — fuente única de divisas
- `formatAmount(n, currency)` — muestra decimales solo si el monto tiene centavos

### `constants/categories.js`

> ⚠️ Cambiar aquí afecta: HomeScreen, AddExpenseModal, SettingsScreen, GraficosScreen, ConfigScreen.

---

## 5. Zonas frágiles

### 🔴 Alta prioridad

| Zona | Archivo | Riesgo |
|------|---------|--------|
| `buildAllMembers()` | `normalizeMembers.js` | Rompe AddExpenseModal, SaldosScreen, HomeScreen |
| `calcSaldos()` | `useBalances.js` | Afecta HomeScreen (hero) y SaldosScreen |
| `inviteIdFromUrl` | `App.jsx` | Lee hash al montar — no re-ejecuta si cambia |
| Listeners en `AppInner` | `App.jsx` | Sin cleanup correcto → memory leaks o datos duplicados |
| `account.disabledCategories` | `App.jsx`, `SettingsScreen`, `ConfigScreen` | Lógica diferente en create vs edit |
| `isPozo` derivado de `account.type` | `App.jsx`, `HomeScreen`, `SaldosScreen`, modales | Cualquier cambio en el contrato de `type` rompe estas 4 capas |
| `paidBy` dual-format | `useBalances.js`, `expenseFilters.js`, modales | String (viejo) vs Array<{uid,amount}> (nuevo) — usar siempre `getPaidEntries()` / `getAmountPaidBy()` |

### 🟡 Media prioridad

| Zona | Archivo | Riesgo |
|------|---------|--------|
| `accountsLoading` | `useAccountData.js` | Depende de que TODOS los listeners respondan |
| `visibleFixed` | `HomeScreen` y `SaldosScreen` | Lógica duplicada — cambiar en uno no cambia el otro |
| Listeners duplicados | `SettingsScreen.jsx` | Lecturas innecesarias de Firestore |
| `forWhom` inicial | `AddExpenseModal.jsx` | Si allMembers llega tarde, forWhom queda vacío |
| `historyMonth` vs `currentMonth` | `SaldosScreen.jsx` | Son estados independientes; `useEffect` sincroniza al cambiar mes |

### 🟢 Baja prioridad

| Zona | Archivo | Riesgo |
|------|---------|--------|
| Scroll lock de sheets | Múltiples archivos | No centralizado — cada sheet lo maneja por separado |
| `fmtDate()` | Varios | Asume formato `YYYY-MM-DD` |

---

## 6. Lógicas compartidas y dónde viven

| Lógica | Dónde vive | Dónde se usa |
|--------|-----------|-------------|
| Cálculo de saldos | `hooks/useBalances.js` | `HomeScreen`, `SaldosScreen` |
| Normalización de members | `utils/normalizeMembers.js` | `App.jsx` → todos los componentes |
| Filtro de gastos fijos visibles | Inline en `HomeScreen` y `SaldosScreen` (duplicado) | Ambas pantallas |
| Cuánto pagó un uid por un gasto | `getAmountPaidBy()` en `utils/expenseFilters.js` | `HomeScreen` (isPozo), `SaldosScreen` (isPozo) |
| Formateo de montos | `formatAmount()` en `theme.jsx` | Todas las pantallas |
| Operaciones de escritura de gastos | `hooks/useExpenses.js` | `App.jsx` |
| Input de montos | `hooks/useAmountInput.js` | `AddExpenseModal`, `EditExpenseModal` |
| Bottom sheet swipe | `hooks/useSwipeSheet.js` | `AddExpenseModal`, `EditExpenseModal` |
| Categorías default | `constants/categories.js` | Múltiples componentes |
| Divisas | `CURRENCIES` en `theme.jsx` | Múltiples componentes |

---

## 7. Estado conocido por pantalla

### HomeScreen ✅
- Hero muestra total del mes con skeleton `#ffffff33` mientras `isLoading` (width:140/h:36 total, width:100/h:13 balance)
- Para cuentas compartidas (`!isPersonal && !isPozo`): muestra balance personal (a favor / a pagar / Saldado ✓)
- Para Pozo Común (`isPozo`): muestra línea con gastos de cada integrante en el hero; stat pills con gasto por integrante en color del miembro
- Pills de filtro muestran emoji de categoría
- Gastos fijos con subsecciones Hogar/Personal

### SaldosScreen ✅
- **Cuentas shared:** balance neto por miembro, algoritmo greedy, botón Saldar, pasar mes siguiente
  - Botón Saldar con guard `useRef` anti-doble-tap; al saldar total usa `debtPairs` frescos (no estado del modal)
  - Settle modal avanza al siguiente acreedor automáticamente o se cierra si no quedan deudas
  - Historial colapsable con navegación por mes independiente de `currentMonth`
  - Historial agrupado por fecha, distinción visual para filas del usuario actual, eliminación con confirmación
- **Cuentas pozo:** muestra "Resumen del Pozo":
  - Card de total del mes con delta % vs mes anterior
  - Alerta de presupuesto (⚠️ ≥80%, 🚨 ≥100%) si `categoryBudgets._total` configurado
  - Ranking por integrante con % del total
  - Ranking por categoría con delta vs mes anterior, alerta de presupuesto por categoría, barra de progreso
  - Acepta prop `categoryBudgets` desde `account.categoryBudgets`
- No disponible en cuentas personales

### GraficosScreen ✅
- Toggle "Por mes" / "Por tipo"
- Torta por categoría con selector de mes
- Excluye gastos `deleted: true`
- Sección "Presupuesto" (solo si `categoryBudgets` con categorías configuradas): card total del mes con barra de progreso + alertas, cards por categoría con barra de progreso individual
- Acepta prop `categoryBudgets` desde `account.categoryBudgets`

### AddExpenseModal ✅
- Default `paidBy` = usuario que carga (string uid); en modo multi-pagador escribe `Array<{uid,amount}>`
- Default `forWhom` = todos (tipo "hogar")
- Sin botón X — swipe o confirmar descarte
- Se cierra correctamente después de guardar: `onClose()` fuera del try/catch de `onAdd()` (fix Mar 17)
- Tipos en cuentas shared: Ordinario / Para otro / Extraordinario / Para mí
- Tipos en cuentas pozo (`isPozo`): solo Ordinario y Extraordinario
- Toggle "Pago compartido" → modo multi-pagador: inputs por miembro, indicador total rojo/verde
- Validación: bloquea submit si total multi-payer ≠ monto del gasto (diff ≥ 0.01)

### EditExpenseModal ✅
- Mismos tipos con misma lógica `isPozo` que AddExpenseModal
- Sin botón X — swipe o confirmar descarte
- Campo monto con símbolo de moneda
- Toggle "Pago compartido" → modo multi-pagador; inicializa desde `expense.paidBy` si ya es array
- `isDirty` y `canSave()` consideran tanto modo single como multi-payer

### AccountSelectorScreen ✅
- Skeleton loading mientras `accountsLoading`
- Estado vacío solo cuando `!isLoading && accounts.length === 0`
- Pozo Común: fondo ámbar `#f39c1218`, emoji 🪣, label "Pozo Común"

### SettingsScreen ✅
- Salario visible solo en cuentas compartidas proporcionales
- Fix de edición de miembro: busca por `id` (labels) o `linkedUid` (vinculados)
- No duplica miembros al editar
- Sección "Presupuesto" (solo cuentas pozo): muestra total configurado, botón "Configurar/Editar" abre bottom sheet con input total + inputs por categoría; guarda en `account.categoryBudgets` vía `updateDoc`

### MenuPanel ✅
- Tamaño de letra: Pequeño / Mediano / Grande
- `localStorage` como `expenseFontSize`
- No sobreescribe preferencia al cambiar de cuenta (fix aplicado)

### CreateAccountScreen ✅
- Tipo de división: Proporcional / Partes iguales / Pozo Común 🪣
- Al guardar con `divisionSystem = "pozo"`: escribe `type: "pozo"` en Firestore (regla de derivación)
- "Pozo Común" reemplaza "Gastos en común" (`"informativo"`) — migración forward-only

### OnboardingScreen ✅
- 3 slides con emoji, título y descripción; mostrado UNA vez por dispositivo antes de `ConfigScreen`
- Detectado via `localStorage.getItem("xpenses-onboarding-done")` → string "1"
- Solo se muestra cuando `!userProfile?.setupDone && !inviteFlow`
- Slide 1: personalizado con nombre del usuario (`user.displayName.split(" ")[0]`)
- CTA "Saltar" disponible en slides 1 y 2 (va directo a ConfigScreen)
- CTA "Crear mi cuenta →" en slide 3 llama a `onDone()` que setea el flag en localStorage

---

## 8. Pendientes técnicos

| Item | Prioridad | Estado |
|------|-----------|--------|
| Listeners duplicados SettingsScreen (T1) | Media | Pendiente |
| Push notifications (FCM) | Alta | Pendiente |
| Eliminación de cuenta usuario | Media | En debugging Mar 17 — reglas Firestore corregidas, logs agregados |
| `visibleFixed` duplicado en HomeScreen/SaldosScreen | Baja | Deuda técnica |
| Scroll lock de sheets no centralizado | Baja | Deuda técnica |
| MenuPanel: label "Cuenta personal" no contempla pozo | Baja | Cosmético pendiente |
| `SwipeableExpenseRow`: `allMembers.find(m => m.uid === e.paidBy)` rompe con multi-payer (muestra vacío) | Media | Deuda técnica Mar 17 |
| Notificaciones con destinatarios incorrectos — `getNotificationRecipients(expense)` reemplaza `otherMembers()` genérico; switch por tipo (hogar/personal/mio/extraordinary/settlement) | Mar 26 |
| `handleFullSettle` notificaba a todos los miembros en lugar de solo al acreedor | Mar 26 |
| `handlePartialSettle` no enviaba notificación — ahora notifica solo al acreedor | Mar 26 |
| `removeMember.js`: `e.paidBy === memberUid` no maneja array → no detecta pagador en multi-payer | Baja | Deuda técnica Mar 17 |

### ✅ Resueltos en sesiones anteriores

| Item | Sesión |
|------|--------|
| `settlements` faltaba en llamada a `useExpenses()` — warning de borrado nunca se mostraba | Mar 26 |
| `doDeleteExpense`: settlement correctivo omitido en gastos multi-payer — `applyPaidBy()` | Mar 26 |
| HomeScreen ignoraba `disabledCategories` — categorías desactivadas aparecían en filtros | Mar 26 |
| `handlePartialSettle` sin guard `isSubmitting` — susceptible a double-tap | Mar 26 |
| `monthSettlements` y `debtPairs` sin `useMemo` en SaldosScreen | Mar 26 |
| `useAccountData`: miembro sin doc Firestore se descartaba silenciosamente — placeholder | Mar 26 |
| `useFirestoreData`: 4 `onSnapshot` sin error callback — fallos silenciosos | Mar 26 |
| `allMembers` y `activeCategories` sin `useMemo` en App.jsx | Mar 26 |
| `memberIds.join()` order-sensitive en useAccountData — ahora sorted | Mar 26 |
| Onboarding slides (6) en AccountSelectorScreen + tooltips en Home/Saldos + "?" en modales | Mar 26 |
| HomeScreen hero skeleton (width:140/h:36, width:100/h:13) | Mar 18 |
| Settlement history — navegación por mes, distinción visual, eliminación, agrupamiento | Mar 18 |
| Settle modal usa `debtPairs` frescos en lugar de estado previo del modal | Mar 18 |
| Tipo de cuenta "Pozo Común" — `type: "pozo"` en Firestore, UI en 6 componentes | Mar 18 |
| CLAUDE.md con instrucciones git y stack para Claude Code | Mar 18 |
| allMembersLoaded guard en SaldosScreen (evita debtPairs prematuros) | Mar 17 |
| AddExpenseModal frizado en "Guardando..." — fix Tarea 2 | Mar 17 |
| Multi-pagador por gasto — paidBy: string\|Array<{uid,amount}> retrocompat | Mar 17 |
| Onboarding básico 3 slides antes de ConfigScreen | Mar 17 |
| SettleModal auto-avanza al siguiente acreedor | Mar 17 |

---

*Actualizar al final de cada sprint.*