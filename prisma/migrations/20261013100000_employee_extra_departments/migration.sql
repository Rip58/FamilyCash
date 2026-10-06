-- Departamentos que un empleado cubre habitualmente además del principal.
ALTER TABLE "Employee" ADD COLUMN "defaultExtraDepartmentIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
