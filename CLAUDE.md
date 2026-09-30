# CLAUDE.md

App PWA de plantilla del turno de noche. El plan completo y el modelo de datos están en `PLAN.md` — léelo antes de tocar código.

## Reglas
- Implementa solo la fase que se te pida en `PLAN.md` §5.
- Stack fijo: Next.js App Router + TypeScript estricto + Tailwind + Prisma + Neon. No añadir otras librerías de estado/UI salvo dnd-kit y zod.
- Toda lógica de fechas pasa por `lib/dates.ts` (zona `Europe/Madrid`). El turno pertenece al día en que empieza.
- El "día efectivo" de un empleado se calcula SOLO con `lib/schedule.ts` (`getEffectiveDay`). No duplicar esa lógica en componentes.
- Mutaciones con Server Actions validadas con zod.
- Móvil primero (390×844), objetivos táctiles ≥ 44px, textos de UI en español.
- Sin horas de nómina ni cálculo de totales de horas: la app solo registra si viene, dónde, qué tareas hace y por qué falta.

## Comprobaciones antes de commit
`npm run lint && npm run typecheck && npm test && npm run build`

## Notas técnicas (tras Fases 1–2)
- Next.js 16: el middleware se llama `proxy.ts` (export `proxy`).
- Prisma 7 con `@prisma/adapter-pg`. Cliente generado en `lib/generated/prisma` (gitignored, `postinstall`). Importar tipos desde `@/lib/generated/prisma/client`; instancia en `lib/db.ts` (`db`). URL de migraciones en `prisma.config.ts` (`DIRECT_URL`).
- Fechas de turno como `DateStr` "YYYY-MM-DD"; a BD con `toDbDate`, desde BD con `fromDbDate`.
- Carga de datos en `lib/queries.ts` (`loadDayRoster`, `loadWeekGrid`, ...). UI base en `components/ui` (BottomSheet, Segmented, Chip, Tag, TimeInput, Card, cn).
- Dev local: Postgres en `postgresql://app:app@localhost:5432/plantilla`, contraseña de la app `noche`.
