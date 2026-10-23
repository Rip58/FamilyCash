-- Vacaciones (fase 2): lo que pide cada empleado, cada envío firmado y bloqueo del PIN de /vacaciones.
ALTER TABLE "VacationCampaign" ADD COLUMN "pinFails" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "VacationCampaign" ADD COLUMN "pinLockedUntil" TIMESTAMP(3);

CREATE TABLE "VacationPeriod" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "start" DATE NOT NULL,
    "end" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "VacationPeriod_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "VacationPeriod_year_idx" ON "VacationPeriod"("year");
CREATE INDEX "VacationPeriod_employeeId_idx" ON "VacationPeriod"("employeeId");
ALTER TABLE "VacationPeriod" ADD CONSTRAINT "VacationPeriod_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "VacationSubmission" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "periods" JSONB NOT NULL,
    "workDays" INTEGER NOT NULL,
    "signature" TEXT NOT NULL,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VacationSubmission_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "VacationSubmission_employeeId_year_idx" ON "VacationSubmission"("employeeId", "year");
ALTER TABLE "VacationSubmission" ADD CONSTRAINT "VacationSubmission_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
