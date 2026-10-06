-- Registro de faltas: queda constancia aunque luego el día se cambie a fiesta.
CREATE TABLE "Absence" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "statusLabel" TEXT NOT NULL,
    "reason" TEXT,
    "notified" BOOLEAN,
    "resolution" TEXT,
    "resolutionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Absence_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Absence_employeeId_date_key" ON "Absence"("employeeId", "date");
CREATE INDEX "Absence_employeeId_idx" ON "Absence"("employeeId");
ALTER TABLE "Absence" ADD CONSTRAINT "Absence_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Faltas que ya hay: «Falta» en el planning, o en Hoy no vino a un día de trabajo.
INSERT INTO "Absence" ("id", "employeeId", "date", "statusLabel", "reason", "updatedAt")
SELECT 'abs_' || d."id", d."employeeId", d."date", COALESCE(a."label", p."label"), d."reason", CURRENT_TIMESTAMP
FROM "DayEntry" d
JOIN "StatusType" p ON p."id" = d."statusTypeId"
LEFT JOIN "StatusType" a ON a."id" = d."actualStatusTypeId"
WHERE (a."id" IS NULL AND p."code" = 'ABSENT')
   OR (a."id" IS NOT NULL AND a."isWorking" = false AND (p."isWorking" = true OR a."code" = 'ABSENT'))
ON CONFLICT DO NOTHING;
