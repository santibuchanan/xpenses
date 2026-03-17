# X-penses 💸

App mobile-first de gastos compartidos para grupos y parejas. Divide gastos, simplifica deudas y registra pagos de forma clara y ordenada.

**Demo:** https://xpenses-seven.vercel.app

---

## Funcionalidades

- 👥 Cuentas compartidas o personales
- 💰 División proporcional por salario o partes iguales
- 🔗 Invites con link permanente y reutilizable
- 📊 Gráficos de gastos por categoría y mes
- 🏠 Gastos fijos mensuales
- ⚖️ Saldos simplificados con algoritmo greedy
- 🌙 Modo oscuro / claro / automático
- 🔔 Notificaciones en tiempo real

---

## Stack

- **Frontend:** React + Vite
- **Backend:** Firebase (Firestore + Auth)
- **Deploy:** Vercel

---

## Desarrollo local

```bash
npm install
npm run dev
```

---

## Deploy

El deploy es automático desde la rama `main` via Vercel.

```bash
git push origin main
```

---

## Arquitectura

Ver `src/ARCHITECTURE.md` para documentación detallada de contratos de datos, zonas frágiles y estado conocido por pantalla.
