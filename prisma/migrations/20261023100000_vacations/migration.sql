-- Vacaciones: campaña anual, semanas con regla propia y PIN fijo de cada empleado.
CREATE TABLE "VacationCampaign" (
    "year" INTEGER NOT NULL,
    "workDays" INTEGER NOT NULL DEFAULT 22,
    "deadline" DATE NOT NULL,
    "open" BOOLEAN NOT NULL DEFAULT true,
    "defaultMax" INTEGER NOT NULL DEFAULT 2,
    "departmentMax" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "VacationCampaign_pkey" PRIMARY KEY ("year")
);

CREATE TABLE "VacationWeek" (
    "weekStart" DATE NOT NULL,
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT,
    "maxOverride" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "VacationWeek_pkey" PRIMARY KEY ("weekStart")
);

CREATE TABLE "VacationPin" (
    "employeeId" TEXT NOT NULL,
    "pin" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VacationPin_pkey" PRIMARY KEY ("employeeId")
);
CREATE UNIQUE INDEX "VacationPin_pin_key" ON "VacationPin"("pin");
ALTER TABLE "VacationPin" ADD CONSTRAINT "VacationPin_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Campaña 2027: 22 días laborables, hasta el 30 de enero, máximo 2 a la vez y Droguería 1.
INSERT INTO "VacationCampaign" ("year", "workDays", "deadline", "open", "defaultMax", "departmentMax", "updatedAt")
SELECT 2027, 22, DATE '2027-01-30', true, 2,
       COALESCE((SELECT jsonb_object_agg("id", 1) FROM "Department" WHERE lower("name") LIKE '%drogu%'), '{}'::jsonb),
       CURRENT_TIMESTAMP;
