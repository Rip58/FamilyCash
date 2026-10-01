-- Unifica el estado "Faltante" creado a mano con el de la app (code ABSENT, "Falta"):
-- los días pasan a ABSENT, que se queda con la etiqueta y el color de "Faltante". Si no existe, no hace nada.
UPDATE "DayEntry" SET "statusTypeId" = (SELECT "id" FROM "StatusType" WHERE "code" = 'ABSENT')
WHERE "statusTypeId" IN (SELECT "id" FROM "StatusType" WHERE "code" <> 'ABSENT' AND lower(trim("label")) = 'faltante')
  AND EXISTS (SELECT 1 FROM "StatusType" WHERE "code" = 'ABSENT');

UPDATE "DayEntry" SET "plannedStatusTypeId" = (SELECT "id" FROM "StatusType" WHERE "code" = 'ABSENT')
WHERE "plannedStatusTypeId" IN (SELECT "id" FROM "StatusType" WHERE "code" <> 'ABSENT' AND lower(trim("label")) = 'faltante')
  AND EXISTS (SELECT 1 FROM "StatusType" WHERE "code" = 'ABSENT');

UPDATE "StatusType" AS a
SET "label" = 'Faltante', "color" = d."color", "sortOrder" = LEAST(a."sortOrder", d."sortOrder"), "active" = true
FROM (SELECT "color", "sortOrder" FROM "StatusType" WHERE "code" <> 'ABSENT' AND lower(trim("label")) = 'faltante' LIMIT 1) AS d
WHERE a."code" = 'ABSENT';

DELETE FROM "StatusType"
WHERE "code" <> 'ABSENT' AND lower(trim("label")) = 'faltante'
  AND EXISTS (SELECT 1 FROM "StatusType" WHERE "code" = 'ABSENT');
