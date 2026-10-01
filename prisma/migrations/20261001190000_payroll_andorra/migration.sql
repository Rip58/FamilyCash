-- Andorra: el bruto de 40 h (1.860,07 €) = salario mínimo (1.568,67 € desde 07/2026) + plus de nocturnidad (291,40 €).
UPDATE "PayrollPeriod" SET "baseCents" = 156867 WHERE "baseCents" = 186007;

UPDATE "PayrollSettings"
SET "nightPlusMode" = 'PERCENT', "nightPlusPercent" = 18.5762
WHERE "id" = 1 AND "nightPlusPercent" = 0 AND "nightPlusMode" = 'PERCENT';

UPDATE "PayrollSettings" SET "baseMonthlyCents" = 156867 WHERE "id" = 1 AND "baseMonthlyCents" = 186007;
