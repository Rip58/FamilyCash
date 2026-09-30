# Plantilla Noche

PWA para controlar la plantilla del turno de noche: quién viene, dónde trabaja, qué tareas hace y por qué falta. Plan completo en [`PLAN.md`](PLAN.md); reglas de trabajo en [`CLAUDE.md`](CLAUDE.md).

Stack: Next.js (App Router) · TypeScript estricto · Tailwind 4 · Prisma 7 · Postgres (Neon en producción).

## Desarrollo local

Requisitos: Node 22 y un Postgres accesible.

```bash
npm install                 # instala y ejecuta `prisma generate` (postinstall)
cp .env.example .env        # y rellena los valores (ver abajo)
npx prisma migrate dev      # crea/actualiza el esquema
npx prisma db seed          # estados, departamentos, secciones y los 22 empleados (idempotente)
npm run dev                 # http://localhost:3000
```

Comprobaciones antes de cada commit:

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

## Variables de entorno

| Variable | Uso |
|---|---|
| `DATABASE_URL` | Conexión de la app. En Neon, la cadena **pooled** (host con `-pooler`). |
| `DIRECT_URL` | Conexión directa (sin pooler) para migraciones y seed. En local, igual que `DATABASE_URL`. |
| `APP_PASSWORD` | Contraseña única de acceso (se usa mientras no exista `Settings.passwordHash`). |
| `AUTH_SECRET` | Secreto para firmar la cookie de sesión (`openssl rand -hex 32`). |

Ejemplo local: `postgresql://app:app@localhost:5432/plantilla`.

## Base de datos y Neon

Se usa el cliente estándar de Prisma 7 con el adaptador `@prisma/adapter-pg` (driver `pg`) tanto en local como en Neon: es lo más simple y funciona igual en ambos. En Vercel, usa la cadena **pooled** de Neon en `DATABASE_URL` para no agotar conexiones. El cliente se genera en `lib/generated/prisma` (ignorado por git; se regenera en `postinstall`). La configuración de Prisma está en `prisma.config.ts` (migraciones con `DIRECT_URL`).

## Deploy en Vercel + Neon

1. Crea una base de datos en [Neon](https://neon.tech) y copia las dos cadenas: **pooled** y **directa**.
2. Importa el repositorio en Vercel (Framework: Next.js). El script `vercel-build` (`prisma migrate deploy && next build`) aplica las migraciones en cada deploy; Vercel lo usa automáticamente si existe.
3. En *Settings → Environment Variables* añade `DATABASE_URL` (pooled), `DIRECT_URL` (directa), `APP_PASSWORD` y `AUTH_SECRET`.
4. Tras el primer deploy, ejecuta el seed **una sola vez** desde tu máquina con las variables de producción:
   ```bash
   DIRECT_URL="<cadena directa de Neon>" npx prisma db seed
   ```
5. Abre la URL de Vercel e inicia sesión con `APP_PASSWORD`.

Recomendado: mantener el repositorio **privado** (contiene nombres reales).

## Instalar en iPhone

1. Abre la URL de la app en **Safari**.
2. Toca **Compartir** (cuadrado con flecha).
3. Elige **Añadir a pantalla de inicio** y confirma.

Se abrirá a pantalla completa como una app. La sesión dura 90 días.

## Estructura relevante

- `lib/dates.ts` — toda la lógica de fechas (`Europe/Madrid`, días como `"YYYY-MM-DD"`).
- `lib/schedule.ts` — funciones puras: `getEffectiveDay`, `getDayRoster`, `getWeekGrid`.
- `lib/queries.ts` — carga desde Prisma y llama a las funciones puras.
- `lib/auth.ts`, `lib/password.ts`, `app/actions/auth.ts`, `proxy.ts` — autenticación por contraseña única.
- `components/ui/*` — BottomSheet, Segmented, Chip, TimeInput, Card, TabBar.

> Nota: en Next.js 16 la convención `middleware.ts` se llama `proxy.ts`; hace el mismo trabajo (protege las rutas salvo `/login`, assets, manifest e iconos).
