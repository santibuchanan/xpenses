# Instrucciones para Claude Code — X-penses

## Git
- Siempre trabajar en la rama `main`
- Antes de empezar cualquier tarea: `git checkout main && git pull origin main`
- Al terminar: `git add -A && git commit -m "tipo: descripción" && git push origin main`
- Nunca dejar commits sin pushear
- Prefijos: `feat:` / `fix:` / `refactor:` / `chore:`

## Proyecto
- **Repo local:** `/Users/santi/xpenses`
- **Deploy:** https://xpenses-seven.vercel.app (automático desde Vercel al pushear a main)
- **Firebase project:** xpenses-305ee
- **Stack:** React + Vite + Firebase (Firestore + Auth + Storage) + VitePWA

## Reglas OBLIGATORIAS antes de tocar cualquier archivo
1. Leer `src/ARCHITECTURE.md` antes de modificar zonas frágiles
2. Leer cada archivo antes de editarlo — NUNCA editar desde memoria
3. `type="button"` en todos los botones no-submit
4. Textos de UI siempre en español rioplatense, sin tecnicismos
5. Nunca colores hardcodeados — usar `colors` de `useTheme()`

---

## Zonas frágiles — leer ARCHITECTURE.md antes de tocar

| Archivo | Zona | Riesgo |
|---------|------|--------|
| `utils/normalizeMembers.js` | `buildAllMembers()` | Rompe AddExpenseModal, SaldosScreen, HomeScreen |
| `hooks/useBalances.js` | `calcSaldos()` | Afecta saldos en HomeScreen y SaldosScreen |
| `hooks/useBalances.js` | `calcSaldosAcumulados()` | Usada en hero de HomeScreen — no reemplazar por calcSaldos() |
| `App.jsx` | `inviteIdFromUrl`, listeners, hashchange | Lee hash al montar + escucha `hashchange` para PWA abierta — no re-ejecuta el parse inicial |
| `App.jsx` | `selectedMonth` state | Estado global de mes — se resetea al cambiar de cuenta; pasado como prop a las 3 pantallas |
| `App.jsx` | `AppHeader` búsqueda global | `searchQuery` state en AppInner, pasado a HomeScreen — no duplicar lógica de búsqueda en la pantalla |
| `constants/categories.js` | `DEFAULT_CATEGORIES` | Cambiar afecta toda la app |
| `constants/features.js` | `ATTACHMENTS_ENABLED` | Feature flag central — cambiar a `true` activa adjuntos (requiere plan Blaze) |
| `vite.config.js` | workbox config | Puede romper Firebase Auth con PWA |

---

## Contratos de datos críticos

### allMembers (el más importante)
```js
{ uid: string, name: string, color: string, _isLabel: boolean }
// uid SIEMPRE presente — para labels es l.id
// Usar _isLabel solo para excluir de notificaciones, NO de cálculos de saldo
// NUNCA usar m.id directamente — siempre m.uid
```

### Expense
```js
{ id, accountId, concept, amount, type, category, date, month,
  paidBy, forWhom[], owner, deleted, createdBy, createdAt,
  attachments: string[] }  // URLs de Firebase Storage — [] o ausente si no tiene
// Soft delete SIEMPRE: deleted: true — nunca borrado físico
// Montos con precisión r2: Math.round(n * 100) / 100
// paidBy: string (uid, pagador único) | Array<{uid, amount}> (multi-pagador)
//   → NUNCA asumir que es string — usar getPaidEntries() de useBalances.js
//   → calcSaldos(), getAmountPaidBy(), applyPaidBy() ya son retrocompatibles
// attachments: UI dormida hasta upgrade a Blaze — ver constants/features.js
```

### Account
```js
{ id, name, emoji, type, divisionSystem, ownerId, memberIds[],
  memberLabels[], currency, disabledCategories[],
  categoryBudgets: { _total?: number, [catId: string]: number },  // disponible en todos los tipos
  accountOrder: string[],  // orden manual de cuentas en AccountSelectorScreen (drag & drop)
  createdAt }
```

### FixedExpense
```js
{ id, name, amount, dueDay, shared, startDate, createdBy, category,
  payments: { [month: "YYYY-MM"]: { paid: boolean, paidBy: string } } }
// category: string | null — retrocompat: null = sin categoría, no suma en Top Categorías ni pie chart
// startDate filtra visibilidad: solo fijos con startDate.slice(0,7) <= selectedMonth son visibles
```

### Salary — dónde vive y dónde leer
- **`memberLabels`** es la fuente primaria de salary para miembros vinculados ajenos
- **`users/{uid}`** es la fuente del propio usuario (también escrito al editar Mi Perfil)
- Si el miembro editado es el usuario actual (`linkedUid === currentUser.uid`): escribir en AMBOS
- `realMembers` en HomeScreen/SaldosScreen enriquece `m.salary` con `memberLabels[linkedUid]?.salary ?? m.salary`
- `salaryUpdatedAt: "YYYY-MM-DD"` se guarda en `memberLabels` y `users/{uid}` solo cuando el valor cambia; visible en SettingsScreen solo si es del mes actual

---

## Reglas de notificaciones

- `hogar` (Ordinario) → todos los miembros de la cuenta MENOS el creador
- `personal` (Para otro) → solo `forWhom` MENOS el creador
- `mio` (Para mí) → nadie
- `extraordinary` → todos los miembros MENOS el creador
- `settlement` → solo el acreedor (`creditorUid`)
- **NUNCA cruzar cuentas** — filtrar siempre por `accountId`
- Labels (`_isLabel: true`) NO reciben notificaciones

---

## Patrones Firebase obligatorios

```js
// Siempre cleanup en listeners
useEffect(() => {
  const unsub = onSnapshot(ref, handler);
  return () => unsub();
}, [dep]);

// Queries siempre filtradas por accountId
query(collection(db, 'expenses'),
  where('accountId', '==', accountId),
  where('deleted', '!=', true)
)

// Operaciones atómicas con runTransaction
await runTransaction(db, async (tx) => { ... });

// updatedAt al modificar cuentas
updatedAt: new Date().toISOString()
```

---

## Patrones UI mobile obligatorios

```js
// Bottom sheets — siempre con useSwipeSheet
const { sheetRef, handleTouchStart, handleTouchMove, handleTouchEnd } = useSwipeSheet(onClose);

// Scroll lock en modales
document.body.style.overflow = 'hidden';   // al abrir
document.body.style.overflow = '';          // al cerrar

// Anti-doble-tap en operaciones críticas
const isSubmitting = useRef(false);
if (isSubmitting.current) return;
isSubmitting.current = true;
// ... operación
isSubmitting.current = false;

// touch-action en zonas con swipe
style={{ touchAction: 'pan-y' }}
```

### Swipe gestures — estándar obligatorio
- `useSwipeSheet` / `useSwipeRow` en `hooks/useSwipeSheet.js` son el estándar para todos los gestos de la app. Todos los modales usan `useSwipeSheet` (threshold 120px). Todas las filas swipeables usan `useSwipeRow` (peekDistance: 80, fullDistance: 180). No implementar swipe manualmente en ningún componente nuevo.

---

## Desktop layout — sprint MP1-12.5 (Apr 16, 2026)

### Patrón establecido como estándar

- **Breakpoint único:** `≥768px` via `useIsDesktop()` (`src/hooks/useIsDesktop.js`)
- **Tablet (`768px`)** mantiene versión mobile — desktop solo en pantallas anchas
- **Swipeables → botón 🗑 al hover:** `opacity: 0` + `onMouseEnter/Leave` en desktop; swipe touch desactivado
- **Bottom sheets → modal centrado:** `alignItems: center, justifyContent: center` en backdrop; `borderRadius: 20, maxWidth` en sheet
- **Swipe horizontal de mes → desactivado en desktop:** guard `if (isDesktop) return` en `handleTouchStart`/`handleTouchEnd` de `HomeScreen` y `GraficosScreen`; `MonthNavBar` cubre la navegación en desktop

### Nuevos archivos creados

| Archivo | Descripción |
|---------|-------------|
| `src/hooks/useIsDesktop.js` | Media query hook — retorna `true` si `window.matchMedia('(min-width: 768px)')` |
| `src/components/desktop/Sidebar.jsx` | Sidebar colapsable (220px expandido, 64px colapsado) con nav vertical, toggle, avatar dropdown |
| `src/components/desktop/AvatarDropdown.jsx` | Dropdown de usuario — toggle tema + cerrar sesión; se abre hacia arriba, cierra con click fuera |

### Tokens de tema usados en desktop (nunca inventar nuevos)

```js
colors.textMuted       // ← usar en lugar de colors.textSecondary (no existe)
colors.cardBorder      // ← usar en lugar de colors.border (no existe)
#4F7FFA                // ← hardcoded para accent (colors.primary no existe)
colors.navBorder       // ← borde del sidebar
```

### Zonas frágiles desktop

| Archivo | Zona | Riesgo |
|---------|------|--------|
| `App.jsx` | Wrapper flex desktop — sidebar + main | Cambiar `flexDirection` o `width` del sidebar rompe el layout |
| `App.jsx` | FAB desktop (`position: fixed, bottom: 32, right: 32`) | No debe solapar con sidebar colapsado |
| `AddExpenseModal` / `EditExpenseModal` | Modal `position: fixed, width: calc(100vw - 220px - 48px)` | Depende del ancho del sidebar expandido (220px) |
| `Sidebar.jsx` | NAV_ITEMS key `"graficos"` | La key es el valor de `tab` state en App.jsx — no cambiar; solo cambiar `label` |

---

## Checklist pre-push (verificar antes de cada push)

### Auth
- [ ] Solo `signInWithPopup` — nunca `signInWithRedirect`
- [ ] `vite.config.js` tiene `navigateFallbackDenylist: [/^\/__\/auth\//]` en workbox

### Miembros
- [ ] `buildAllMembers()` no modificado sin revisar ARCHITECTURE.md
- [ ] Todos los `allMembers` tienen `uid`, `name`, `color`
- [ ] Labels participan en cálculos pero NO en notificaciones

### Gastos y saldos
- [ ] Soft delete (`deleted: true`), nunca borrado físico
- [ ] Montos con precisión r2
- [ ] `formatAmount()` de theme.jsx para mostrar montos
- [ ] `paidBy` puede ser string o Array — nunca asumir tipo, usar `getPaidEntries()`
- [ ] Multi-pagador: suma de amounts debe igualar `expense.amount`

### Notificaciones
- [ ] Reglas de destinatarios correctas por tipo de gasto
- [ ] Filtro por `accountId` — nunca cruzar cuentas

### UI
- [ ] `type="button"` en todos los botones no-submit
- [ ] Modales con scroll lock
- [ ] Bottom sheets con `useSwipeSheet`
- [ ] Textos en español rioplatense

### Gastos fijos
- [ ] `category` en FixedExpense: `string | null` — retrocompat con fijos sin campo
- [ ] `monthVisibleFixed` filtrado por `f.startDate?.slice(0,7) <= selectedMonth`
- [ ] `catTotals` (HomeScreen) y `pieData` (GraficosScreen) suman fijos con `category`

### Firebase
- [ ] Todos los listeners tienen cleanup (`return unsub`)
- [ ] Queries filtran por `accountId`

---

## Errores conocidos

- **"Unable to process request due to missing initial state"** → VitePWA interfiriendo con Firebase Auth. Fix: `navigateFallbackDenylist: [/^\/__\/auth\//]` en workbox de vite.config.js
- **Modal se queda en "Guardando..."** → `onClose()` no se llama después de guardar. Siempre llamar onClose en el finally.
- **Claude Code no puede pushear** → Iniciar siempre con `cd /Users/santi/xpenses && claude`

---

## Feature flags (constants/features.js)

| Flag | Default | Descripción |
|------|---------|-------------|
| `ATTACHMENTS_ENABLED` | `false` | Adjuntar fotos/PDFs a gastos. Requiere Firebase Storage (plan Blaze). Cambiar a `true` activa UI en AddExpenseModal, EditExpenseModal y ícono 📎 en SwipeableExpenseRow. |

---

## Navegación por mes (Apr 7, 2026)

- `selectedMonth` vive en `App.jsx` (AppInner) — estado global `"YYYY-MM"`, se resetea al cambiar de cuenta
- Pasado como prop `selectedMonth` + `setSelectedMonth` a `HomeScreen`, `SaldosScreen`, `GraficosScreen`
- `MonthNavBar` (`src/components/MonthNavBar.jsx`) — label capitalizado + dots deslizantes (máx. 7), tap navega
- Swipe horizontal (delta > 50px) en mobile para cambiar de mes — **desactivado en desktop** (`if (isDesktop) return` en `handleTouchStart`/`handleTouchEnd`)
- `historyMonth` (SaldosScreen) y `pieMonthIdx`/`barMonthIdx` (GraficosScreen) eliminados
- SaldosScreen: botón Saldar oculto en meses históricos; badge "Saldado en {mes}" en deudas pasadas

## Pendientes técnicos activos

- Listeners duplicados en SettingsScreen (T1)
- Íconos PWA no se muestran
- `removeMember.js`: maneja array paidBy pero no redistribuye el monto del miembro eliminado entre los restantes (deuda técnica menor)
- `calcSaldos()` puede mostrar $0 en mes histórico si los settlements fueron registrados en otro mes
- **Adjuntos en gastos** — código completo en `useExpenses.js`, `AddExpenseModal`, `EditExpenseModal`, `SwipeableExpenseRow`. Dormido con `ATTACHMENTS_ENABLED=false`. Activar cuando se haga upgrade a Firebase Blaze + configurar Storage Rules (`/expenses/{expenseId}/{fileName}` allow read/write autenticado)

## Patrones de eliminación de cuenta (firebase.js)

```js
// deleteUserData(uid) — limpia Firestore con writeBatch:
// memberIds[], memberLabels[], notificaciones, users/{uid}
// ⚠️ Siempre getDoc() antes de batch.delete() para evitar error si el doc no existe

// reauthenticateUser(user, providerId, email?, password?) — re-auth antes de user.delete()
// DeleteAccountModal en SettingsScreen: flujo 2 pasos
//   paso 1 → intenta user.delete() directo
//   paso 2 → solo si Firebase retorna auth/requires-recent-login
//   Después del delete: limpia localStorage (pendingInviteId, etc.) y recarga
```