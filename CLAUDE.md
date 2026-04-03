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
- **Stack:** React + Vite + Firebase (Firestore + Auth) + VitePWA

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
| `App.jsx` | `inviteIdFromUrl`, listeners, hashchange | Lee hash al montar + escucha `hashchange` para PWA abierta — no re-ejecuta el parse inicial |
| `App.jsx` | `selectedMonth` state | Estado global de mes — se resetea al cambiar de cuenta; pasado como prop a las 3 pantallas |
| `constants/categories.js` | `DEFAULT_CATEGORIES` | Cambiar afecta toda la app |
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
  paidBy, forWhom[], owner, deleted, createdBy, createdAt }
// Soft delete SIEMPRE: deleted: true — nunca borrado físico
// Montos con precisión r2: Math.round(n * 100) / 100
// paidBy: string (uid, pagador único) | Array<{uid, amount}> (multi-pagador)
//   → NUNCA asumir que es string — usar getPaidEntries() de useBalances.js
//   → calcSaldos(), getAmountPaidBy(), applyPaidBy() ya son retrocompatibles
```

### Account
```js
{ id, name, emoji, type, divisionSystem, ownerId, memberIds[],
  memberLabels[], currency, disabledCategories[],
  categoryBudgets: { _total?: number, [catId: string]: number },  // disponible en todos los tipos
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

## Navegación por mes (Mar 30, 2026)

- `selectedMonth` vive en `App.jsx` (AppInner) — estado global `"YYYY-MM"`, se resetea al cambiar de cuenta
- Pasado como prop `selectedMonth` + `setSelectedMonth` a `HomeScreen`, `SaldosScreen`, `GraficosScreen`
- `MonthNavBar` (`src/components/MonthNavBar.jsx`) — label capitalizado + dots deslizantes (máx. 7), tap navega
- Swipe horizontal (delta > 50px) en las 3 pantallas para cambiar de mes
- `historyMonth` (SaldosScreen) y `pieMonthIdx`/`barMonthIdx` (GraficosScreen) eliminados
- SaldosScreen: botón Saldar oculto en meses históricos; badge "Saldado en {mes}" en deudas pasadas

## Pendientes técnicos activos

- HomeScreen skeleton loading no funciona correctamente
- Listeners duplicados en SettingsScreen (T1)
- Íconos PWA no se muestran
- `removeMember.js`: maneja array paidBy pero no redistribuye el monto del miembro eliminado entre los restantes (deuda técnica menor)
- `calcSaldos()` puede mostrar $0 en mes histórico si los settlements fueron registrados en otro mes

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