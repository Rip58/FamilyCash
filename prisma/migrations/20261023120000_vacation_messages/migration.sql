-- Vacaciones (fase 4): chat entre el encargado y cada empleado.
CREATE TABLE "VacationMessage" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "fromOwner" BOOLEAN NOT NULL,
    "text" TEXT NOT NULL,
    "seen" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VacationMessage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "VacationMessage_employeeId_year_idx" ON "VacationMessage"("employeeId", "year");
ALTER TABLE "VacationMessage" ADD CONSTRAINT "VacationMessage_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
