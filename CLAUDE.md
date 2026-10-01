# CLAUDE.md

App PWA de plantilla del turno de noche. El plan completo y el modelo de datos están en `PLAN.md` — léelo antes de tocar código.

## Reglas
- Implementa solo la fase que se te pida en `PLAN.md` §5.
- Stack fijo: Next.js App Router + TypeScript estricto + Tailwind + Prisma + Neon. No añadir otras librerías de estado/UI salvo dnd-kit y zod.
- Toda lógica de fechas pasa por `lib/dates.ts` (zona `Europe/Madrid`). El turno pertenece al día en que empieza.
- El "día efectivo" de un empleado se calcula SOLO con `lib/schedule.ts` (`getEffectiveDay`). No duplicar esa lógica en componentes.
- Mutaciones con Server Actions validadas con zod.
- Móvil primero (390×844), objetivos táctiles ≥ 44px, textos de UI en español.
- La plantilla no calcula nóminas de empleados: registra si viene, dónde, qué tareas hace, por qué falta y las horas extra del cierre del turno. La única nómina es la personal del usuario (pestaña Nómina).

## Comprobaciones antes de commit
`npm run lint && npm run typecheck && npm test && npm run build`

## Notas técnicas (tras Fases 1–2)
- Next.js 16: el middleware se llama `proxy.ts` (export `proxy`).
- Prisma 7 con `@prisma/adapter-pg`. Cliente generado en `lib/generated/prisma` (gitignored, `postinstall`). Importar tipos desde `@/lib/generated/prisma/client`; instancia en `lib/db.ts` (`db`). URL de migraciones en `prisma.config.ts` (`DIRECT_URL`).
- Fechas de turno como `DateStr` "YYYY-MM-DD"; a BD con `toDbDate`, desde BD con `fromDbDate`.
- Carga de datos en `lib/queries.ts` (`loadDayRoster`, `loadWeekGrid`, ...). UI base en `components/ui` (BottomSheet, Segmented, Chip, Tag, TimeInput, Card, cn).
- Dev local: Postgres en `postgresql://app:app@localhost:5432/plantilla`, contraseña de la app `noche`.

## Notas técnicas (Fase 6c: avisos con foto)
- Almacenamiento en `lib/storage.ts` (solo servidor): con `BLOB_READ_WRITE_TOKEN` usa Vercel Blob (subida directa desde el cliente vía `app/api/upload`), sin token guarda en `.uploads/` (gitignored) y sirve con `app/api/files/[...path]` (comprueba sesión; las rutas `.jpg/.png/.webp` no pasan por `proxy.ts`). El cliente usa `uploadPhoto` (`lib/upload.ts`) con el modo expuesto por `StorageModeProvider` en `app/(app)/layout.tsx`.
- Reglas de subida/validación puras en `lib/upload-rules.ts`; compresión en `lib/image-compress.ts`; esquemas zod y utilidades en `lib/reports.ts`; consultas en `lib/report-queries.ts`; acciones en `app/actions/reports.ts`.

## Notas técnicas (Fase 7: pulido)
- Fechas inválidas en `/hoy`, `/semana` e `/informe`: la validación vive en `layout.tsx` de cada segmento (fuera del Suspense de `loading.tsx`) para dar 404 real.
- Arrastre (dnd-kit): `MouseSensor` (distance 4) + `TouchSensor` (delay 200, tolerance 5); las asas usan `touch-manipulation` para que un swipe rápido siga haciendo scroll.
- PWA: `public/sw.js` (registrado por `components/pwa/RegisterSW.tsx` solo en producción) y `public/offline.html`. No cachea HTML ni `/api`. Si añades rutas públicas estáticas, exclúyelas en el `matcher` de `proxy.ts`.
- Zona segura: `.app-main` y `BackHeader` gestionan `safe-area-inset-top`; el layout `(app)` pone una tapa fija bajo la barra de estado.

## Notas técnicas (pasar lista)
- Semana = plan; Hoy = control. `DayEntry.present` (true = ha venido, null = sin confirmar), patch `attendance` en `lib/segments.ts`, acción `setAttendance`. Marcar ✗ cambia el estado del día (`ABSENT`, creado en la migración `attendance` y unificado con el "Faltante" manual en `merge_faltante`), y por tanto también la Semana.
- Avisos de planning: cuando Hoy cambia el estado (patch `status` en `lib/segments.ts`) se guarda el anterior en `DayEntry.plannedStatusTypeId`; `getEffectiveDay` lo expone como `day.planned` (null si cuadra). Semana (`setCellStatus`, copiar semana) y aprobar peticiones lo limpian porque definen el planning.

## Notas técnicas (Nómina personal)
- Pestaña `/nomina` (Registro + Calculadora) y `/ajustes/nomina` (importes y "quién eres"). Lógica pura en `lib/payroll.ts` (céntimos, % ), consultas en `lib/payroll-queries.ts`, acciones en `app/actions/payroll.ts`.
- `Payslip` por mes "YYYY-MM": los campos null se calculan del cuadrante del empleado elegido en `PayrollSettings.employeeId` (vía `getEffectiveDay`).
- Andorra: hora extra por ley = (base + resp.)/173,33 h × (1 + recargo, mín. 40 % art. 58.2 LRL) + nocturnidad/h de noche; mes parcial prorrateado por días/30 (`contractDays`); CASS 6,5 %; IRPF anual en `andorraIrpfAnnualCents` (Llei 5/2014).
- Sueldo del mes completo FIJO (no depende de 28/31 días). Horas extra = fiestas trabajadas (`offDaysWorked`, noches > 5 por semana lunes–domingo, la semana cuenta en el mes de su domingo, solo semanas ya cerradas) × 8 h + horas del cierre. El plus de noche solo baja por vacaciones/baja/faltas. Los días trabajados se deducen en `mergeStats`.

## Notas técnicas (rendimiento)
- Datos de referencia (`getSettings`, `getStatusTypes`, `getDepartments`, `getEmployees`, `getSections`) cacheados con `unstable_cache` (tag `REF_TAG`); `done()` de `app/actions/settings.ts` hace `updateTag(REF_TAG)`. Si añades otra escritura a esas tablas fuera de ahí, invalida el tag. Si una migración cambia esos datos, sube `REF_CACHE_VERSION` (la caché de Vercel sobrevive a los despliegues).
- `experimental.staleTimes.dynamic = 30` en `next.config.ts`: volver a una pestaña reciente no pide nada al servidor.
- Funciones de Vercel en `cdg1` (París, `vercel.json`), junto a la BD (eu-west-3). No cambiar una sin la otra.
- BD en Prisma Postgres: la app conecta por `pooled.db.prisma.io` (PgBouncer, 50 conexiones) y las migraciones por `db.prisma.io` (directa, 10); lo hace `lib/db-url.ts` reescribiendo el host. Pool de `pg` limitado a 4 conexiones por instancia (`lib/db.ts`). Error típico si se rompe: "too many connections for role".
- Cada sección tiene su `loading.tsx` (no uno global en `(app)`, que rompería los 404 de fechas inválidas).

## Notas técnicas (notas de la noche)
- `NightNote` (varias por noche, `employeeId`/`departmentId` opcionales; `kind` INFO | TASK, `doneAt` = tarea hecha; las tareas pendientes de semanas anteriores salen en la Semana del Informe vía `getPendingTasksBefore`), acciones en `app/actions/notes.ts`, lectura `getNightNotes` en `lib/queries.ts`. El Informe las junta con la nota del día (`DayNote`) y las notas de empleado del día (`DayEntry.note`) en "Notas de la noche"; el resumen semanal las agrupa por noche.

