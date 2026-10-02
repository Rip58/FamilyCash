-- El planning (Semana) manda: statusTypeId vuelve a ser SIEMPRE el planning y lo que se valida en Hoy
-- cuando no cuadra se guarda aparte en actualStatusTypeId (antes era al revés con plannedStatusTypeId).
ALTER TABLE "DayEntry" ADD COLUMN "actualStatusTypeId" TEXT;

UPDATE "DayEntry"
SET "actualStatusTypeId" = "statusTypeId",
    "statusTypeId" = "plannedStatusTypeId"
WHERE "plannedStatusTypeId" IS NOT NULL
  AND "plannedStatusTypeId" IN (SELECT "id" FROM "StatusType");

ALTER TABLE "DayEntry" DROP COLUMN "plannedStatusTypeId";
