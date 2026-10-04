-- Propuesta oficial de la empresa (Sergi Ben Amor): "salari brut 48 hs" de cada periodo.
-- Solo rellena los periodos que empiezan en esas fechas y aún no tienen el dato (no pisa nada escrito a mano).
UPDATE "PayrollPeriod" SET "gross48Cents" = 233647 WHERE "from" = DATE '2026-09-21' AND "gross48Cents" IS NULL;
UPDATE "PayrollPeriod" SET "gross48Cents" = 283647 WHERE "from" = DATE '2026-12-01' AND "gross48Cents" IS NULL;
UPDATE "PayrollPeriod" SET "gross48Cents" = 328647 WHERE "from" = DATE '2027-04-01' AND "gross48Cents" IS NULL;
UPDATE "PayrollPeriod" SET "gross48Cents" = 363008 WHERE "from" = DATE '2027-10-01' AND "gross48Cents" IS NULL;
