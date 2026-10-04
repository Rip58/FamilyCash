-- Departamentos secundarios (tareas que hacen entre todos): si quedan vacíos no cuentan como "sin personal".
ALTER TABLE "Department" ADD COLUMN "secondary" BOOLEAN NOT NULL DEFAULT false;
-- Los que el usuario indicó: comodín, responsable & comodín y subir & bajar palets.
UPDATE "Department" SET "secondary" = true
WHERE lower("name") LIKE '%comod%' OR lower("name") LIKE '%palet%';
