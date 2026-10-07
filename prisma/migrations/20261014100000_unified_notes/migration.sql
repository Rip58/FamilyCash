-- Una sola «Nota»: la nota del día, las notas de empleado de Hoy, las notas de ficha, los avisos con foto
-- y las peticiones pasan a NightNote (con fotos en NightNotePhoto). Después se borran las tablas antiguas.

ALTER TABLE "NightNote" ADD COLUMN "category" TEXT NOT NULL DEFAULT 'NOTE',
ADD COLUMN "sectionId" TEXT,
ADD COLUMN "time" TEXT,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE "NightNotePhoto" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "pathname" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "size" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "NightNotePhoto_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "NightNote_employeeId_idx" ON "NightNote"("employeeId");
ALTER TABLE "NightNote" ADD CONSTRAINT "NightNote_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "NightNotePhoto" ADD CONSTRAINT "NightNotePhoto_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "NightNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Nota del día (general).
INSERT INTO "NightNote" ("id", "date", "kind", "category", "text", "createdAt", "updatedAt")
SELECT 'dn_' || to_char("date", 'YYYYMMDD'), "date", 'INFO', 'NOTE', btrim("text"), "date"::timestamp + interval '22 hours', CURRENT_TIMESTAMP
FROM "DayNote" WHERE btrim("text") <> '';

-- Nota de un empleado en Hoy.
INSERT INTO "NightNote" ("id", "date", "employeeId", "kind", "category", "text", "createdAt", "updatedAt")
SELECT 'en_' || "id", "date", "employeeId", 'INFO', 'NOTE', btrim("note"), "updatedAt", CURRENT_TIMESTAMP
FROM "DayEntry" WHERE "note" IS NOT NULL AND btrim("note") <> '';

-- Notas de ficha: la noche es la del turno (antes de la hora de cambio de día = noche anterior), con su hora.
INSERT INTO "NightNote" ("id", "date", "time", "employeeId", "kind", "category", "text", "createdAt", "updatedAt")
SELECT 'fn_' || n."id",
       (((n."occurredAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Madrid') - make_interval(hours => COALESCE(s."dayRolloverHour", 12)))::date,
       to_char((n."occurredAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Madrid', 'HH24:MI'),
       n."employeeId", 'INFO',
       CASE WHEN n."category" IN ('NOTE', 'INCIDENT', 'PRAISE', 'TALK') THEN n."category" ELSE 'NOTE' END,
       n."text", n."createdAt", n."updatedAt"
FROM "EmployeeNote" n LEFT JOIN "Settings" s ON s."id" = 1;
INSERT INTO "NightNotePhoto" ("id", "noteId", "url", "pathname", "width", "height", "size", "sortOrder")
SELECT p."id", 'fn_' || p."noteId", p."url", p."pathname", p."width", p."height", p."size", p."sortOrder" FROM "EmployeeNotePhoto" p;

-- Avisos con foto.
INSERT INTO "NightNote" ("id", "date", "time", "employeeId", "sectionId", "kind", "category", "text", "createdAt", "updatedAt")
SELECT 'rp_' || "id", "date", to_char(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Madrid', 'HH24:MI'),
       "employeeId", "sectionId", 'INFO', 'NOTE', "text", "createdAt", "createdAt"
FROM "Report";
INSERT INTO "NightNotePhoto" ("id", "noteId", "url", "pathname", "width", "height", "size", "sortOrder")
SELECT p."id", 'rp_' || p."reportId", p."url", p."pathname", p."width", p."height", p."size", p."sortOrder" FROM "ReportPhoto" p;

-- Peticiones: ahora son notas («Petición»), sin seguimiento.
INSERT INTO "NightNote" ("id", "date", "employeeId", "kind", "category", "text", "createdAt", "updatedAt")
SELECT 'lr_' || "id", "requestedAt", "employeeId", 'INFO', 'REQUEST',
       CASE "type"
         WHEN 'SWAP_OFF' THEN 'Cambio de fiesta: librar el ' || to_char("dateTo", 'DD/MM') || ' en vez del ' || to_char("dateFrom", 'DD/MM')
         WHEN 'VACATION' THEN 'Vacaciones del ' || to_char("dateFrom", 'DD/MM') || ' al ' || to_char("dateTo", 'DD/MM')
         WHEN 'PAID_OFF' THEN 'Permiso del ' || to_char("dateFrom", 'DD/MM') || ' al ' || to_char("dateTo", 'DD/MM')
         ELSE 'Petición del ' || to_char("dateFrom", 'DD/MM') || ' al ' || to_char("dateTo", 'DD/MM')
       END
       || COALESCE(' — ' || NULLIF(btrim("note"), ''), '')
       || CASE "status" WHEN 'APPROVED' THEN ' (aprobada)' WHEN 'DENIED' THEN ' (denegada)' ELSE '' END
       || COALESCE(' · respuesta: ' || NULLIF(btrim("decisionNote"), ''), ''),
       "createdAt", "createdAt"
FROM "LeaveRequest";

ALTER TABLE "DayEntry" DROP COLUMN "note";
DROP TABLE "DayNote";
DROP TABLE "EmployeeNotePhoto";
DROP TABLE "EmployeeNote";
DROP TABLE "LeaveRequest";
DROP TABLE "ReportPhoto";
DROP TABLE "Report";
