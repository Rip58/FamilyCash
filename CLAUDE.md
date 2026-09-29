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
