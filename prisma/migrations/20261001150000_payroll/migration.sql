-- CreateTable
CREATE TABLE "PayrollSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "employeeId" TEXT,
    "baseMonthlyCents" INTEGER NOT NULL DEFAULT 0,
    "proratedExtraCents" INTEGER NOT NULL DEFAULT 0,
    "nightPlusMode" TEXT NOT NULL DEFAULT 'PERCENT',
    "nightPlusPerNightCents" INTEGER NOT NULL DEFAULT 0,
    "nightPlusPercent" DOUBLE PRECISION NOT NULL DEFAULT 25,
    "overtimeHourCents" INTEGER NOT NULL DEFAULT 0,
    "holidayWorkedCents" INTEGER NOT NULL DEFAULT 0,
    "ssPercent" DOUBLE PRECISION NOT NULL DEFAULT 6.48,
    "irpfPercent" DOUBLE PRECISION NOT NULL DEFAULT 12,

    CONSTRAINT "PayrollSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payslip" (
    "month" TEXT NOT NULL,
    "daysWorked" INTEGER,
    "daysOff" INTEGER,
    "vacationDays" INTEGER,
    "sickDays" INTEGER,
    "absentDays" INTEGER,
    "holidaysWorked" INTEGER,
    "extraMinutes" INTEGER,
    "grossCents" INTEGER,
    "netCents" INTEGER,
    "note" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payslip_pkey" PRIMARY KEY ("month")
);

