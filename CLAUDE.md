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
- Almacenamiento en `lib/storage.ts` (solo servidor). El cliente (`uploadPhoto`, `lib/upload.ts`) comprime y envía SIEMPRE a `app/api/upload/photo`; el servidor guarda en Vercel Blob si hay credenciales (`lib/blob-auth.ts`: `BLOB_READ_WRITE_TOKEN` o `BLOB_STORE_ID` + OIDC, también con prefijo) y si no en `.uploads/` (gitignored). Se sirven con `app/api/files/[...path]` (comprueba sesión; las rutas `.jpg/.png/.webp` no pasan por `proxy.ts`).
- El almacén Blob es PRIVADO: `put` con `access: "private"` (`saveStoredFile`) y la URL guardada es `/api/files/<pathname>` (`readStoredFile` con `get`). No enlazar URLs de blob directamente.
- En Vercel sin Blob no se pueden guardar fotos (disco de solo lectura): `/api/upload/photo` responde `BLOB_MISSING` y Ajustes → Almacenamiento lo avisa (`blobMissing()`).
- Reglas de subida/validación puras en `lib/upload-rules.ts`; compresión en `lib/image-compress.ts`; esquemas zod y utilidades en `lib/reports.ts`; consultas en `lib/report-queries.ts`; acciones en `app/actions/reports.ts`.

## Notas técnicas (Fase 7: pulido)
- Fechas inválidas en `/hoy`, `/semana` e `/informe`: la validación vive en `layout.tsx` de cada segmento (fuera del Suspense de `loading.tsx`) para dar 404 real.
- Arrastre (dnd-kit): `MouseSensor` (distance 4) + `TouchSensor` (delay 200, tolerance 5); las asas usan `touch-manipulation` para que un swipe rápido siga haciendo scroll.
- PWA: `public/sw.js` (registrado por `components/pwa/RegisterSW.tsx` solo en producción) y `public/offline.html`. Actualizar: `lib/app-update.ts` (`forceUpdate` borra SW y cachés y pasa por `app/api/refresh`, que responde `Clear-Site-Data: "cache"` y vuelve a la página; `finishUpdate` comprueba al volver que ya es la versión nueva y si no reintenta). `components/pwa/UpdateBanner.tsx` (en el layout) avisa de versión nueva al abrir, al volver a la app y cada 10 min. `/api/refresh` no pide sesión (`proxy.ts`). No cachea HTML ni `/api`. Si añades rutas públicas estáticas, exclúyelas en el `matcher` de `proxy.ts`.
- Zona segura: `.app-main` y `BackHeader` gestionan `safe-area-inset-top`; el layout `(app)` pone una tapa fija bajo la barra de estado.

## Notas técnicas (pasar lista)
- EL PLANNING MANDA: `DayEntry.statusTypeId` es SIEMPRE el planning y solo lo cambian Semana (`setCellStatus`, copiar/repetir semana) y las peticiones aprobadas. Hoy NUNCA lo toca.
- Hoy = validar. `DayEntry.present` (true = validado: ha venido o ausencia confirmada; null = sin validar), patch `attendance`, acción `setAttendance`. Si lo real no cuadra (✗ no ha venido, ⇄ en ausentes, estado en la ficha) se guarda en `DayEntry.actualStatusTypeId` (patch `status` en `lib/segments.ts`; elegir el estado del planning lo vuelve a null). Migración `actual_status` (antes era al revés con `plannedStatusTypeId`).
- `getEffectiveDay`: `status` = lo real (actual ?? planning), `planned` = el planning si no cuadra. Hoy, Informe y Nómina usan `status`; Semana (Personas) muestra `planned ?? status` y marca "!" si no cuadra.
- Varios departamentos en una noche: `DayEntry.extraDepartmentIds` (además del principal `departmentId`; migración `extra_departments`). `getEffectiveDay` los da sin repetir el principal; en `getDayRoster` cada departamento tiene `covering` (vienen de otro a cubrirlo) y `staffed` = present + covering, que es lo que cuenta para plazas/vacío. `present` sigue siendo solo los del principal (no duplicar en recuentos). Se eligen en `MoveSheet` (tocar = solo ése; casilla = varios + Guardar) y en la ficha (`toggleDepartment` en `lib/segments.ts`: el primero es el principal).
- Departamentos secundarios (`Department.secondary`, Ajustes → Departamentos; migración `department_secondary` marca los que tienen «comod»/«palet» en el nombre): tareas de todos; vacíos NO son `isEmpty`/`isUnderStaffed` (no salen en Hoy ni avisan en Semana → Días). En Hoy los departamentos vacíos van primero.
- Semana → ⋯ → "Repetir esta semana hasta fin de mes": `remainingMonthWeeks` (semana del mes de su jueves) + `planRepeatWeek` (copia trabaja/fiesta + departamento; no repite ausencias puntuales; respeta las ausencias ya puestas en destino).

## Notas técnicas (Nómina personal)
- Pestaña `/nomina` (Registro + Calculadora) y `/ajustes/nomina` (importes y "quién eres"). Lógica pura en `lib/payroll.ts` (céntimos, % ), consultas en `lib/payroll-queries.ts`, acciones en `app/actions/payroll.ts`.
- `Payslip` por mes "YYYY-MM": los campos null se calculan del cuadrante del empleado elegido en `PayrollSettings.employeeId` (vía `getEffectiveDay`).
- Andorra: hora extra por ley = (base + resp.)/173,33 h × (1 + recargo, mín. 40 % art. 58.2 LRL) + nocturnidad/h de noche; mes parcial prorrateado por días/30 (`contractDays`); CASS 6,5 %; IRPF anual en `andorraIrpfAnnualCents` (Llei 5/2014).
- Previsión del mes en curso (`components/payroll/LiveMonth.tsx`, arriba en Registro): `payForecast` en `lib/payroll.ts` — semanas lunes–domingo con su domingo en el periodo (noches × 8 h, +8 h por noche de más sobre las del contrato), estado cerrada/en curso/prevista/sin planning; las semanas futuras SIN nada en Semana se cuentan como semana normal (L–V o sus fiestas fijas) para no inflar horas extra. Sin datos que rellenar.
- Cierre de nómina (`PayrollSettings.cutoffDay`, por defecto 27; null = mes natural): los datos variables (horas, fiestas trabajadas, ausencias) de cada nómina van del día siguiente al cierre anterior al cierre (`payPeriodDays`, `payMonthOf` en `lib/dates.ts`). Las semanas cuentan en el periodo de su domingo. La nómina "en curso" después del cierre ya es la del mes siguiente.
- Jornada 48 h como la empresa: `PayrollPeriod.gross48Cents` ("salari brut 48 hs" de la propuesta, migración `payroll_gross48`). Plus 48 h = brut48 − (base + resp. + nocturnidad completa) (476,40 € en 2026), prorrateado por semanas a 48 h / semanas del periodo (`MonthStats.weeks`/`weeks48`): mes entero a 48 h = brut48 exacto. Hora extra = plus / (8 h × 52/12) = 13,74 €/h (`week48SupplementCents`, `overtimeRateCents`). Sin brut48, el cálculo anterior. Los valores de la propuesta oficial se cargan con la migración `payroll_gross48_proposta` (solo periodos vacíos con esas fechas). Tests con la tabla oficial (las 4 filas, bruto y neto a 40 h y 48 h) en `tests/payroll.test.ts`.
- La nómina usa SIEMPRE el contrato de 40 h (`CONTRACT_NIGHTS` = 5, `CONTRACT_DAYS_OFF`), no `Settings.daysOffPerWeek` (eso es de la plantilla; con 1 la app creía que el contrato era de 48 h y no sumaba el plus).
- Sueldo del mes completo FIJO (no depende de 28/31 días). Horas extra = fiestas trabajadas (`offDaysWorked`, noches > 5 por semana lunes–domingo, la semana cuenta en el mes de su domingo, solo semanas ya cerradas) × 8 h + horas del cierre. El plus de noche solo baja por vacaciones/baja/faltas. Los días trabajados se deducen en `mergeStats`.

## Notas técnicas (rendimiento)
- Datos de referencia (`getSettings`, `getStatusTypes`, `getDepartments`, `getEmployees`, `getSections`) cacheados con `unstable_cache` (tag `REF_TAG`); `done()` de `app/actions/settings.ts` hace `updateTag(REF_TAG)`. Si añades otra escritura a esas tablas fuera de ahí, invalida el tag. Si una migración cambia esos datos, sube `REF_CACHE_VERSION` (la caché de Vercel sobrevive a los despliegues).
- Navegación instantánea: las pestañas de `TabBar` usan `prefetch={true}` (precarga la página COMPLETA con datos, no solo el esqueleto) y `staleTimes` 300 s en `next.config.ts`. Sin esto cada toque mostraba `loading.tsx` y React lo mantiene ≥ 300 ms. Guardar algo invalida la caché y las pestañas se vuelven a precargar solas; al volver a la app tras > 2 min se hace `router.refresh()`.
- Nada de zod en componentes de cliente: tipos/utilidades sin zod en `lib/report-format.ts` y `lib/planogram-format.ts` (los esquemas siguen en `lib/reports.ts`/`lib/planograms.ts`, que los reexportan). `Toaster`/`notify` viven en `components/ui/toast.tsx` (el layout no debe importar `components/settings/kit.tsx`, que trae dnd-kit).
- Service worker con navigation preload (`public/sw.js`). Pool de `pg` con conexiones vivas 2 min (`lib/db.ts`).
- Funciones de Vercel en `cdg1` (París, `vercel.json`), junto a la BD (eu-west-3). No cambiar una sin la otra.
- BD en Prisma Postgres: la app conecta por `pooled.db.prisma.io` (PgBouncer, 50 conexiones) y las migraciones por `db.prisma.io` (directa, 10); lo hace `lib/db-url.ts` reescribiendo el host. Pool de `pg` limitado a 4 conexiones por instancia (`lib/db.ts`). Error típico si se rompe: "too many connections for role".
- Cada sección tiene su `loading.tsx` (no uno global en `(app)`, que rompería los 404 de fechas inválidas).

## Notas técnicas (notas de la noche)
- `NightNote` (varias por noche, `employeeId`/`departmentId` opcionales; `kind` INFO | TASK, `doneAt` = tarea hecha; las tareas pendientes de semanas anteriores salen en la Semana del Informe vía `getPendingTasksBefore`), acciones en `app/actions/notes.ts`, lectura `getNightNotes` en `lib/queries.ts`. El Informe las junta con la nota del día (`DayNote`) y las notas de empleado del día (`DayEntry.note`) en "Notas de la noche"; el resumen semanal las agrupa por noche.

## Notas técnicas (copias de seguridad)
- `lib/backup.ts` (export/restore JSON de todas las tablas, en orden de claves ajenas), `app/api/backup` (descarga con sesión), `scripts/restore-backup.ts`, workflow `.github/workflows/backup.yml` (pg_dump diario cifrado a las 9:03 de Andorra, 90 días). Guía en `docs/COPIAS-DE-SEGURIDAD.md`.
- Si añades un modelo a Prisma, añádelo a `BACKUP_TABLES` (el test `tests/backup.test.ts` falla si no).


## Notas técnicas (lineales y pasos de protocolo)
- Fotos: `compressImage` (`lib/image-compress.ts`) genera WebP calidad 0,95, lado ≤ 1600 px y ≤ 600 KB (≈ 280 KB una foto normal; baja calidad hasta 0,6 y luego tamaño, `compressionAttempts`); si el navegador no codifica WebP, JPEG con el mismo límite.
- Protocolos → pestañas (`ProtocolTabs`): protocolos y `/protocolos/lineales`. `ProtocolStep` (texto + foto opcional) se reescribe entero al guardar (`app/actions/protocols.ts`), borrando del almacenamiento las fotos que dejan de usarse (`removedPathnames`). El editor descarta las fotos subidas y no guardadas.
- Lineales: `Planogram` + `PlanogramPhoto`, ubicación `ShelfLocation` (Ajustes → Ubicaciones). Lógica pura en `lib/planograms.ts` (zod, `untilState`), lecturas en `lib/planogram-queries.ts`, acciones en `app/actions/planograms.ts`. Caducados (fecha "hasta" pasada) se agrupan aparte.
- `discardUploadedFiles` y `storageStats` cuentan también fotos de lineales y pasos: si añades otra tabla con fotos, añádela ahí.

## Notas técnicas (importar semana con IA)
- Semana → ⋯ → "Cargar desde imagen (IA)" → `/semana/importar?semana=` (`components/week/WeekImport.tsx`): comprime la imagen con `DOCUMENT_IMAGE` (2576 px, ≤ 1,5 MB), la envía a `app/api/ai/import-week` (sesión, `maxDuration` 120), muestra una vista previa con el mismo aspecto que Semana → Personas (`ImportGrid`: filas en el orden de la imagen, toca nombre = persona, toca casilla = estado; borde azul = cambia respecto al planning actual, que la página calcula con `getEffectiveDay`) y guarda con `applyImportedWeek` (`app/actions/week.ts`, solo planning; celdas "?" no se tocan).
- IA elegida en Ajustes → Importar con IA (`Settings.aiProvider`: claude | openai | gemini). Claves solo en servidor: `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `GEMINI_API_KEY` (modelo con `ANTHROPIC_MODEL` / `OPENAI_MODEL` / `GEMINI_MODEL`, por defecto `gemini-flash-latest`, alias que Google mantiene; si un modelo da 404 por retirado se reintenta una vez con el que sugiere el error o el Flash más nuevo de la cuenta, `geminiFallbackModel`). Gemini por `fetch` a `generateContent` con `responseSchema` (subconjunto OpenAPI: `geminiSchema` en `lib/ai-import.ts`). Llamadas en `lib/ai-providers.ts`: Claude con `@anthropic-ai/sdk` (`beta.messages.parse` + `betaZodOutputFormat`, `fallbacks: "default"`), OpenAI por `fetch` (json_schema estricto). Esquema, instrucciones y conversión en `lib/ai-import.ts`; tipos y emparejado de nombres (sin zod) en `lib/ai-import-format.ts`.
- Varias imágenes por lectura (hasta 4, partes de la misma semana): `form.getAll("file")` en la ruta y `extractWithAi(provider, images[], …)`. El prompt describe la hoja real (REPO NIT, en catalán: bloque de 3 filas por persona, columna POSICIO cortada, TOTAL para comprobar) y su leyenda de colores; cada color se asigna a un estado de la app por nombre (`named`) o código, y si no hay, «?». Test con las capturas reales transcritas: `tests/ai-import-excel.test.ts`. `nameScore` tolera la última palabra cortada y una letra mal leída en apellidos largos (85). Gemini con `mediaResolution: MEDIA_RESOLUTION_HIGH`.
- Modelo por IA elegible en Ajustes → Importar con IA (`Settings.aiModels` JSON `{gemini: "…"}`, migración `ai_models`, acción `saveAiModel`; `providerModel(p, settings.aiModels)` = elegido ?? env ?? por defecto). La lista sale de la propia IA con la clave (`listModels`, caché 1 h); si falla se escribe a mano.
- En local, `AI_IMPORT_FAKE=1` devuelve una respuesta de ejemplo (nunca en Vercel).
- Semana → ⋯ → "Ver sin departamentos (orden del Excel)" (con botón "↕ Ordenar" → `RotaOrderSheet`, carga diferida, solo guarda al pulsar Guardar → `saveRotaOrder`): `PeopleGrid` con `flat` usa `flatGroups` (una lista ordenada por `Employee.rotaOrder`, nulos al final); se recuerda en localStorage (`semana:sinDepartamentos`). `rotaOrder` se guarda al importar una semana desde imagen (casilla "Guardar este orden", `applyImportedWeek({ saveOrder })`, hace `updateTag(REF_TAG)`).

## Notas técnicas (diseño compacto)
- Iconos de línea en `components/ui/icons.tsx` (`Icon`, `tint(color, pct)` = fondo pastel con `color-mix`). Nada de emojis para iconos de navegación/acciones nuevas.
- Hoy: barra superior en una línea (contadores por estado con `statusAbbr`, ✓ validados, botones nota / agrupar / cierre), filas de 44px (zona táctil 44px, círculo visual 32px), cabeceras pastel (`GroupCard`). Vista sin departamentos en orden del Excel (`rotaOrder`, localStorage `hoy:sinDepartamentos`).
- `Segmented` acepta `compact` (44px en total).
- Sin zoom de página: viewport `maximumScale: 1` + `userScalable: false` (evita el zoom de iOS al tocar campos < 16px), `touch-action: manipulation` en html/body y `components/pwa/NoPageZoom.tsx` (bloquea el pellizco, que Safari permite igualmente). El zoom de fotos lo hace `PhotoViewer` por su cuenta.

## Notas técnicas (animaciones)
- Skills de Emil Kowalski (MIT) instaladas en `.claude/skills/` (animate, improve-animations, review-animations, find-animation-opportunities, animation-vocabulary, emil-design-eng): úsalas para cualquier animación nueva. No se instaló `animate-expo` (es para React Native; esto es una PWA web).
- Curvas en `globals.css` (`@theme`): `ease-out` = cubic-bezier(0.23, 1, 0.32, 1) (sustituye a la de serie), `ease-in-out` = (0.77, 0, 0.175, 1), `ease-drawer` = (0.32, 0.72, 0, 1). Nada de `ease-in`, ni `transition-all`, ni `scale(0)`; solo `transform`/`opacity`; UI < 300 ms.
- `press` (utilidad CSS): encoge a 0,96 al pulsar (160 ms) — en ✓/✗ de Hoy, botones de icono, casillas de Semana y `PrimaryButton`. iOS necesita un `touchstart` en la página para `:active` (lo pone `NoPageZoom`).
- Hojas (`BottomSheet`): 300 ms con `ease-drawer`, entran y salen por abajo; el desmontaje espera 300 ms. Avisos (`toast`): `.toast-pop` con `@starting-style` y `data-leaving` (transiciones, interrumpibles).
- Hojas: se cierran por distancia (100 px) o por velocidad (> 0,11 px/ms) y hacia arriba tienen resistencia (`lib/gesture.ts`, test `tests/gesture.test.ts`). ✓ de Hoy: `.pop-in` (@starting-style, 150 ms) solo al validar en el momento (estado `justValidated` en `EmployeeRow`), no al cargar. Casillas de Semana: transición de color/borde 150 ms, sin movimiento.
- Sin animación a propósito: cambio de pestaña y navegación (se usan cientos de veces). `prefers-reduced-motion` reduce todo a casi 0 (regla global).

