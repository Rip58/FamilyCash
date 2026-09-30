-- CreateTable
CREATE TABLE "Settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "shiftStart" TEXT NOT NULL DEFAULT '21:30',
    "shiftEnd" TEXT NOT NULL DEFAULT '06:30',
    "breakStart" TEXT NOT NULL DEFAULT '02:00',
    "breakEnd" TEXT NOT NULL DEFAULT '03:00',
    "dayRolloverHour" INTEGER NOT NULL DEFAULT 12,
    "daysOffPerWeek" INTEGER NOT NULL DEFAULT 2,
    "passwordHash" TEXT,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#64748b',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "targetStaff" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Section" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "departmentId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Section_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatusType" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "isWorking" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "StatusType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "defaultDepartmentId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "fixedDaysOff" INTEGER[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DayEntry" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "employeeId" TEXT NOT NULL,
    "statusTypeId" TEXT NOT NULL,
    "departmentId" TEXT,
    "reason" TEXT,
    "note" TEXT,
    "arrivedAt" TEXT,
    "leftAt" TEXT,
    "timeReason" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DayEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkSegment" (
    "id" TEXT NOT NULL,
    "dayEntryId" TEXT NOT NULL,
    "sectionId" TEXT,
    "label" TEXT,
    "start" TEXT NOT NULL,
    "end" TEXT NOT NULL,
    "note" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "WorkSegment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DayNote" (
    "date" DATE NOT NULL,
    "text" TEXT NOT NULL,

    CONSTRAINT "DayNote_pkey" PRIMARY KEY ("date")
);

-- CreateIndex
CREATE UNIQUE INDEX "StatusType_code_key" ON "StatusType"("code");

-- CreateIndex
CREATE INDEX "DayEntry_date_idx" ON "DayEntry"("date");

-- CreateIndex
CREATE UNIQUE INDEX "DayEntry_employeeId_date_key" ON "DayEntry"("employeeId", "date");

-- AddForeignKey
ALTER TABLE "Section" ADD CONSTRAINT "Section_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_defaultDepartmentId_fkey" FOREIGN KEY ("defaultDepartmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DayEntry" ADD CONSTRAINT "DayEntry_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DayEntry" ADD CONSTRAINT "DayEntry_statusTypeId_fkey" FOREIGN KEY ("statusTypeId") REFERENCES "StatusType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkSegment" ADD CONSTRAINT "WorkSegment_dayEntryId_fkey" FOREIGN KEY ("dayEntryId") REFERENCES "DayEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkSegment" ADD CONSTRAINT "WorkSegment_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;
