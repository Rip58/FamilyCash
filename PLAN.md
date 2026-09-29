# Plan — App de Plantilla Turno Noche

App web instalable en iPhone (PWA, "Añadir a pantalla de inicio") para controlar **quién viene cada noche, dónde trabaja, qué ha hecho y por qué falta**.
No gestiona horas de nómina. Minimalista, rápida, pensada para usarse con una mano.

---

## 0. Decisiones tomadas

| Tema | Decisión |
|---|---|
| Plataforma | PWA (Next.js) instalable en iPhone. Sin App Store, se abre a pantalla completa como una app. |
| Stack | Next.js 15 (App Router, Server Actions) · TypeScript · Tailwind CSS · Prisma · Neon Postgres · Vercel |
| Acceso | Sin usuarios. Una **contraseña única** (`APP_PASSWORD`) → cookie firmada 90 días. |
| Zona horaria | `Europe/Madrid` en todo el cálculo de fechas. |
| Turno | Fijo 21:30 → 06:30, descanso 02:00–03:00 (editable en Ajustes). |
| Día del turno | Pertenece al **día en que empieza** (lunes 21:30 → martes 06:30 = "Lunes"). |
| "Hoy" | Hasta las 12:00 se muestra la noche anterior (el turno que acaba de terminar); a partir de las 12:00, la noche que empieza hoy. Hora de corte editable. |
| Estados | Configurables en Ajustes (nombre, color, ¿cuenta como trabajando?). Por defecto: Trabaja · Fiesta (verde) · Fiesta retribuida (amarillo) · Baja laboral (rojo) · Vacaciones (azul). |
| Días libres | Cada empleado puede tener **días fijos** de fiesta; el resto (facultativo) se marca cada semana. Se avisa si un empleado no tiene los días libres esperados (por defecto 2/semana). |
| Semana | Lunes → Domingo. Navegación semana a semana. |
| Repositorio | Este repo (`FamilyCash`). Recomendado: mantenerlo **privado** (contiene nombres reales). |

---

## 1. Modelo de datos (Prisma)

```prisma
model Settings {            // fila única id=1
  id              Int     @id @default(1)
  shiftStart      String  @default("21:30")
  shiftEnd        String  @default("06:30")
  breakStart      String  @default("02:00")
  breakEnd        String  @default("03:00")
  dayRolloverHour Int     @default(12)   // antes de esta hora "Hoy" = noche anterior
  daysOffPerWeek  Int     @default(2)
  passwordHash    String?                // si existe, sustituye a APP_PASSWORD
}

model Department {          // Droguería, Botellería, ...
  id         String  @id @default(cuid())
  name       String
  color      String  @default("#64748b")
  sortOrder  Int     @default(0)
  targetStaff Int    @default(0)          // plazas previstas (Droguería 4, Botellería 1)
  active     Boolean @default(true)
  employees  Employee[]
  sections   Section[]
}

model Section {             // pasillos / tareas: Cerveza, Chocolate, ...
  id           String  @id @default(cuid())
  name         String
  departmentId String?
  department   Department? @relation(fields: [departmentId], references: [id])
  sortOrder    Int     @default(0)
  active       Boolean @default(true)
}

model StatusType {
  id          String  @id @default(cuid())
  code        String  @unique            // WORK, OFF, PAID_OFF, SICK, VACATION
  label       String
  color       String
  isWorking   Boolean @default(false)
  sortOrder   Int     @default(0)
  active      Boolean @default(true)
}

model Employee {
  id                  String  @id @default(cuid())
  name                String
  defaultDepartmentId String?
  defaultDepartment   Department? @relation(fields: [defaultDepartmentId], references: [id])
  sortOrder           Int     @default(0)   // orden dentro del departamento
  fixedDaysOff        Int[]                 // 0=Lun … 6=Dom
  active              Boolean @default(true)
  notes               String?               // nota permanente
  days                DayEntry[]
}

model DayEntry {            // solo existe si el día difiere del patrón o tiene datos
  id            String   @id @default(cuid())
  date          DateTime @db.Date           // día de INICIO del turno
  employeeId    String
  employee      Employee @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  statusTypeId  String
  departmentId  String?                     // ubicación ese día (null = la habitual)
  reason        String?                     // motivo ausencia / cambio
  note          String?                     // nota del día sobre el empleado
  arrivedAt     String?                     // "22:15" si llega tarde
  leftAt        String?                     // "07:30" si se queda más / "04:00" si se va antes
  timeReason    String?
  segments      WorkSegment[]
  updatedAt     DateTime @updatedAt
  @@unique([employeeId, date])
  @@index([date])
}

model WorkSegment {         // "Cerveza 21:30–05:00", "Chocolate 05:00–06:30"
  id          String   @id @default(cuid())
  dayEntryId  String
  dayEntry    DayEntry @relation(fields: [dayEntryId], references: [id], onDelete: Cascade)
  sectionId   String?
  label       String?                       // texto libre si no hay sección
  start       String                        // "HH:mm"
  end         String
  note        String?
  sortOrder   Int      @default(0)
}

model DayNote {             // nota general de la noche
  date  DateTime @id @db.Date
  text  String
}
```

**Regla clave — "día efectivo"** (`lib/schedule.ts`, función pura y testeada):
`getEffectiveDay(employee, date, entry?)` →
1. Si hay `DayEntry` → usarlo.
2. Si no, y el día de la semana está en `fixedDaysOff` → estado `OFF`.
3. Si no → `WORK` en `defaultDepartment`.

Así la semana se "rellena sola" y solo se guardan las excepciones. Un `DayEntry` se crea al editar cualquier cosa de ese empleado/día.

---

## 2. Pantallas (barra inferior con 4 pestañas)

### 2.1 Hoy (dashboard)
- Cabecera: `Lunes 29 sep · 21:30–06:30` con ‹ › para cambiar de día y tap en la fecha → volver a hoy.
- Resumen en una línea: `14 trabajan · 5 fiesta · 1 baja · 1 vacaciones`.
- **Nota del día** (si existe) en una tarjeta arriba; tap para editar.
- Lista **por departamento** (orden de Ajustes), cada uno con contador `Droguería 3/4`:
  - Empleados en su orden, con chip de sección si tienen tramos, iconos pequeños si: llega tarde ⏰, se queda más ➕, tiene nota 💬.
  - **Departamento vacío** → tarjeta con borde discontinuo rojo "Sin personal" + quién falta y por qué (`Joao · Vacaciones`). **Por debajo de plazas** → contador en ámbar.
- Sección plegable **"No vienen hoy"** agrupada por estado, con motivo.
- Tap en empleado → **hoja inferior (bottom sheet)**:
  - Estado (botones segmentados con colores) + motivo.
  - Departamento de hoy (selector; "Habitual: Droguería").
  - **Tramos/tareas**: lista `Cerveza 21:30–05:00`, botón "+ Tarea": elegir sección/texto, hora fin (hora inicio = fin del tramo anterior automáticamente). Se salta el descanso 02:00–03:00 solo a efectos visuales.
  - Horario real: "Llega tarde a __:__", "Sale a __:__" + motivo.
  - Nota del día sobre el empleado.
  - Guardado automático (optimistic UI), sin botón "Guardar".
- Mover de departamento rápido: mantener pulsado → elegir destino (alternativa a abrir la hoja).

### 2.2 Semana (calendario vertical)
- Cabecera `Semana 40 · 29 sep – 5 oct` con ‹ › y swipe horizontal para cambiar de semana.
- **Vista Días** (por defecto): los 7 días en vertical, cada uno una tarjeta compacta:
  `Lun 29` · `18 trabajan` · puntos de color por departamento (rojo si vacío) · lista corta de quién no viene (`Fiesta: Gerard, Mimount · Baja: Hennry`). Tap → abre ese día en "Hoy".
- **Vista Personas** (toggle): filas = empleados (agrupados por departamento), columnas = L M X J V S D con celdas de color de estado (como el Excel pero limpio). Tap en celda → cicla Trabaja → Fiesta → …; mantener pulsado → hoja completa.
  - Columna final: nº días libres de la semana; aviso ámbar si ≠ `daysOffPerWeek`.
- Acciones de semana (menú ⋯): "Copiar semana anterior", "Restablecer a días fijos".

### 2.3 Informe
- Selector de día (por defecto: la última noche).
- Por empleado que trabajó: línea de tiempo de tramos (`21:30–05:00 Cerveza → 05:00–06:30 Chocolate`), incidencias de horario, nota.
- Bloque **Incidencias**: llegadas tarde, quién se quedó más, ausencias con motivo, nota del día.
- Botón **Compartir** (Web Share API → WhatsApp/Mail) con el informe en texto plano.
- Pestaña secundaria "Semana": resumen de ausencias por tipo y por empleado.

### 2.4 Ajustes
- **Empleados**: alta/edición/baja (desactivar, nunca borrar con historial), departamento habitual, días fijos de fiesta (7 chips L–D), nota permanente.
- **Departamentos**: nombre, color, plazas previstas, orden (arrastrar). Dentro de cada uno, **ordenar empleados** arrastrando.
- **Secciones / pasillos**: nombre, departamento opcional, orden.
- **Estados**: nombre, color, "cuenta como trabajando", orden.
- **Turno**: inicio, fin, descanso, hora de corte de "Hoy", días libres por semana.
- **Seguridad**: cambiar contraseña, cerrar sesión.
- **Datos**: exportar CSV (rango de fechas).

---

## 3. Diseño

- Estilo iOS minimalista: fuente del sistema (`-apple-system`), fondo gris muy claro / negro en modo oscuro, tarjetas blancas con radio 14px, sin sombras fuertes.
- Color solo para información: estados y departamentos. Tokens CSS en `:root` + modo oscuro automático.
- Objetivos táctiles ≥ 44px, `safe-area-inset` para notch y barra inferior, sin scroll horizontal.
- PWA: `manifest.webmanifest` (display `standalone`), `apple-touch-icon`, `theme-color`, splash sencillo.
- Estados vacíos y de carga con skeletons; transiciones cortas (150ms).
- Todo en **español**; días de la semana en español (L M X J V S D).

---

## 4. Estructura del proyecto

```
app/
  (auth)/login/page.tsx
  (app)/layout.tsx          // barra inferior
  (app)/hoy/[[...date]]/page.tsx
  (app)/semana/[[...week]]/page.tsx
  (app)/informe/[[...date]]/page.tsx
  (app)/ajustes/...        // empleados, departamentos, secciones, estados, turno
  actions/*.ts              // server actions (zod en cada entrada)
components/ui/*             // BottomSheet, Segmented, Chip, TimeInput, Card, TabBar
components/day/*, week/*, report/*, settings/*
lib/db.ts                   // Prisma client (Neon adapter)
lib/auth.ts                 // cookie firmada con jose (HMAC, AUTH_SECRET)
lib/dates.ts                // Europe/Madrid, operationalToday(), weekOf()
lib/schedule.ts             // getEffectiveDay, getDayRoster, getWeekGrid
middleware.ts               // redirige a /login sin cookie válida
prisma/schema.prisma, prisma/seed.ts
tests/                      // vitest: schedule, dates, auth
```

Variables de entorno: `DATABASE_URL`, `DIRECT_URL` (Neon), `APP_PASSWORD`, `AUTH_SECRET`.

---

## 5. Fases para agentes (Sonnet)

Cada fase termina con `npm run lint && npm run typecheck && npm test && npm run build` en verde y un commit. Las fases 3–6 pueden ir **en paralelo** una vez terminada la 2.

| # | Fase | Entregable / criterio de aceptación |
|---|---|---|
| 1 | **Base** | Next.js + TS + Tailwind + Prisma + Neon, ESLint, Vitest, PWA manifest, tokens de diseño, TabBar, componentes UI base (BottomSheet, Segmented, Chip, TimeInput). App vacía navegable. |
| 2 | **Datos + auth** | Schema, migración, seed (estados por defecto, turno, empleados del Excel sin departamento), `lib/dates.ts` y `lib/schedule.ts` con tests (cruce de medianoche, corte 12:00, días fijos, excepciones). Login con contraseña + middleware. |
| 3 | **Ajustes** | CRUD completo de empleados, departamentos (plazas, color, orden), secciones, estados, turno; ordenar empleados dentro de departamento arrastrando (dnd-kit). |
| 4 | **Hoy** | Dashboard por departamentos, departamento vacío/bajo plazas, "No vienen hoy", nota del día, bottom sheet del empleado con estado, departamento, tramos, horario real y nota. Guardado optimista. |
| 5 | **Semana** | Vista Días vertical + vista Personas, navegación por semanas con swipe, ciclo de estado en celda, aviso de días libres, copiar semana anterior, restablecer. |
| 6 | **Informe** | Informe diario + incidencias + compartir texto; resumen semanal; exportar CSV. |
| 7 | **Pulido + deploy** | Modo oscuro, accesibilidad, iconos PWA, prueba en viewport iPhone (Playwright), deploy en Vercel con Neon, README con instrucciones de instalación en iPhone. |

### Prompt tipo para cada agente
> Lee `PLAN.md` y `CLAUDE.md`. Implementa **solo la Fase N**. Respeta el modelo de datos y `lib/schedule.ts` como fuente única del "día efectivo". Móvil primero (390×844). Textos en español. Antes de terminar: lint, typecheck, tests y build en verde; captura de pantalla con Playwright a 390px de las pantallas tocadas; commit con mensaje claro.

---

## 6. Datos iniciales (seed)

Empleados del Excel (sin departamento; se asignan en Ajustes):
Gerard Deu · Jose Alexander Roman · Alejandro Erwin · Hennry Arteta · Mimount Zarioh · Ricardo Luis Ayazo Baldovino · Claudia Caceres · Juan Pablo Zambrano · Cintya Sanchez · Mariluz Carvajal · Anya Damary Ramirez · Alejandro Gomez · Neibis Vitoria · Joan Colldeforns · Jorge Alarcon · Fabian · Alex Rivero · Osmani Corominas · Mikael Antunes · Joao Marco Rosadas · Sebastian Cerda · Sergi Ben Amor.

Departamentos de ejemplo: Droguería (4 plazas), Botellería (1). Secciones de ejemplo: Cerveza, Chocolate.

---

## 7. Pendiente de confirmar (no bloquea el inicio)

1. Lista real de departamentos, plazas y secciones/pasillos (se puede meter luego en Ajustes).
2. Días fijos de fiesta de cada empleado (se puede meter luego en Ajustes).
3. ¿Hace falta histórico/auditoría de quién cambió qué? (Ahora no: una sola contraseña compartida.)
4. ¿Importar el Excel de meses anteriores? (Ahora no previsto.)
