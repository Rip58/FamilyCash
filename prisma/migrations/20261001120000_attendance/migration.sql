-- Pasar lista en Hoy
ALTER TABLE "DayEntry" ADD COLUMN "present" BOOLEAN;

-- Estado "Falta" (no ha venido sin aviso) para bases ya inicializadas
INSERT INTO "StatusType" ("id", "code", "label", "color", "isWorking", "sortOrder", "active")
SELECT 'status-absent', 'ABSENT', 'Falta', '#f97316', false, COALESCE(MAX("sortOrder"), 0) + 1, true
FROM "StatusType"
ON CONFLICT ("code") DO NOTHING;
