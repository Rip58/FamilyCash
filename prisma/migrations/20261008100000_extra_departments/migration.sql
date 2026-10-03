-- Hoy: un empleado puede cubrir varios departamentos en una noche (además del principal)
ALTER TABLE "DayEntry" ADD COLUMN "extraDepartmentIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
