-- CreateTable
CREATE TABLE "NightNote" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "employeeId" TEXT,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NightNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NightNote_date_idx" ON "NightNote"("date");

-- AddForeignKey
ALTER TABLE "NightNote" ADD CONSTRAINT "NightNote_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

