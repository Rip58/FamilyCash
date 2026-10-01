-- AlterTable
ALTER TABLE "PayrollSettings" ADD COLUMN     "respPlusCents" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "PayrollPeriod" (
    "id" TEXT NOT NULL,
    "from" DATE NOT NULL,
    "to" DATE,
    "baseCents" INTEGER NOT NULL,
    "respPlusCents" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PayrollPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PayrollPeriod_from_idx" ON "PayrollPeriod"("from");


-- Propuesta salarial de Sergi Ben Amor (jornada 40 h; 48 h = +8 h/semana a 13,74 €/h; descuentos 6,5 %).
INSERT INTO "PayrollPeriod" ("id", "from", "to", "baseCents", "respPlusCents")
SELECT v.id, v.f::date, v.t::date, v.base, v.resp
FROM (VALUES
  ('period-2026-09', '2026-09-21', '2026-11-30', 186007, 0),
  ('period-2026-12', '2026-12-01', '2027-03-31', 186007, 50000),
  ('period-2027-04', '2027-04-01', '2027-09-30', 186007, 95000),
  ('period-2027-10', '2027-10-01', NULL, 186007, 129361)
) AS v(id, f, t, base, resp)
WHERE NOT EXISTS (SELECT 1 FROM "PayrollPeriod");

INSERT INTO "PayrollSettings" ("id", "employeeId", "baseMonthlyCents", "nightPlusPercent", "overtimeHourCents", "ssPercent", "irpfPercent")
VALUES (1, (SELECT "id" FROM "Employee" WHERE "name" = 'Sergi Ben Amor' LIMIT 1), 186007, 0, 1374, 6.5, 0)
ON CONFLICT ("id") DO UPDATE SET
  "employeeId" = COALESCE("PayrollSettings"."employeeId", EXCLUDED."employeeId"),
  "baseMonthlyCents" = CASE WHEN "PayrollSettings"."baseMonthlyCents" = 0 THEN EXCLUDED."baseMonthlyCents" ELSE "PayrollSettings"."baseMonthlyCents" END,
  "overtimeHourCents" = CASE WHEN "PayrollSettings"."overtimeHourCents" = 0 THEN EXCLUDED."overtimeHourCents" ELSE "PayrollSettings"."overtimeHourCents" END,
  "nightPlusPercent" = CASE WHEN "PayrollSettings"."nightPlusPercent" = 25 THEN 0 ELSE "PayrollSettings"."nightPlusPercent" END,
  "ssPercent" = CASE WHEN "PayrollSettings"."ssPercent" = 6.48 THEN 6.5 ELSE "PayrollSettings"."ssPercent" END,
  "irpfPercent" = CASE WHEN "PayrollSettings"."irpfPercent" = 12 THEN 0 ELSE "PayrollSettings"."irpfPercent" END;
