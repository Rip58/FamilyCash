-- Pasillos separados (Leche, Café…): una sección marcada «aisle» sale como fila propia en el control de pasillos.
ALTER TABLE "Section" ADD COLUMN "aisle" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "AisleLog" ADD COLUMN "sectionId" TEXT;
ALTER TABLE "AisleLog" ADD COLUMN "sectionKey" TEXT NOT NULL DEFAULT '';
ALTER TABLE "AisleLog" ADD COLUMN "employeeIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

DROP INDEX "AisleLog_date_departmentId_key";
CREATE UNIQUE INDEX "AisleLog_date_departmentId_sectionKey_key" ON "AisleLog"("date", "departmentId", "sectionKey");

ALTER TABLE "AisleLog" ADD CONSTRAINT "AisleLog_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE;
