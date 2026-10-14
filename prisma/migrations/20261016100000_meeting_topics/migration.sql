
-- CreateTable
CREATE TABLE "MeetingTopic" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "employeeId" TEXT,
    "departmentId" TEXT,
    "doneOn" DATE,
    "outcome" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeetingTopic_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MeetingTopic_doneOn_idx" ON "MeetingTopic"("doneOn");

-- AddForeignKey
ALTER TABLE "MeetingTopic" ADD CONSTRAINT "MeetingTopic_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingTopic" ADD CONSTRAINT "MeetingTopic_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

