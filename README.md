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
| `BLOB_READ_WRITE_TOKEN` | Token de Vercel Blob para las fotos de los avisos. **Vacío en local**: las fotos se guardan en `.uploads/` (ignorada por git). |

Ejemplo local: `postgresql://app:app@localhost:5432/plantilla`.

## Base de datos y Neon

Se usa el cliente estándar de Prisma 7 con el adaptador `@prisma/adapter-pg` (driver `pg`) tanto en local como en Neon: es lo más simple y funciona igual en ambos. En Vercel, usa la cadena **pooled** de Neon en `DATABASE_URL` para no agotar conexiones. El cliente se genera en `lib/generated/prisma` (ignorado por git; se regenera en `postinstall`). La configuración de Prisma está en `prisma.config.ts` (migraciones con `DIRECT_URL`).

## Deploy en Vercel + Neon

1. En Vercel: **Add New → Project → Import** `Rip58/FamilyCash` (Framework: Next.js, sin cambiar nada más).
2. En el proyecto → pestaña **Storage** → **Create** → **Neon** (Postgres) y conéctalo al proyecto. La integración crea `DATABASE_URL` (pooled) y `DATABASE_URL_UNPOOLED` (directa); la app usa la primera y las migraciones la segunda. (Si creas la base en neon.tech a mano, pon `DATABASE_URL` pooled y `DIRECT_URL` directa.)
3. En **Settings → Environment Variables** añade `APP_PASSWORD` (la contraseña de entrada) y `AUTH_SECRET` (cadena aleatoria larga: `openssl rand -base64 32`).
4. Crea también el **Blob** store (ver abajo) para las fotos.
5. **Redeploy**. El script `vercel-build` hace `prisma migrate deploy`, luego el seed y luego `next build`. El seed solo actúa si la base está vacía (primer deploy); después no toca nada, así que lo que borres en Ajustes no vuelve a aparecer.
6. Abre la URL de Vercel en Safari del iPhone, entra con `APP_PASSWORD` y añádela a la pantalla de inicio.

## Fotos de avisos (Vercel Blob)

Los avisos con foto suben las imágenes (comprimidas en el móvil) directamente a Vercel Blob. Para activarlo:

1. En el panel de Vercel abre el proyecto → pestaña **Storage** → **Create Database / Store** → **Blob**.
2. Conecta el store al proyecto (*Connect Project*, entornos Production y Preview). Vercel crea automáticamente la variable `BLOB_READ_WRITE_TOKEN`.
3. Redespliega. Sin esa variable la app usa el modo local (`.uploads/`, solo para desarrollo: en Vercel el disco es efímero).
4. Para probarlo en local con Blob: `vercel env pull .env.local` y arranca de nuevo.

Los archivos llevan un nombre aleatorio no adivinable y la app solo enseña sus URLs a usuarios con sesión. En *Ajustes → Almacenamiento* se ve el nº de avisos/fotos, el espacio aproximado y se pueden borrar los avisos antiguos (también los archivos). Formatos admitidos: JPEG, PNG y WebP, máx. 8 MB (tras comprimir suelen ser ~300 KB).

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
