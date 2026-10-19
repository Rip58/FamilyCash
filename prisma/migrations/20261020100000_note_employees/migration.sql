-- Una nota puede ser para varias personas: la primera en "employeeId", las demás aquí.
ALTER TABLE "NightNote" ADD COLUMN "extraEmployeeIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
