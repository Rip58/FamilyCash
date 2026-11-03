CREATE TABLE "AisleLog" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "departmentId" TEXT NOT NULL,
    "startTime" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AisleLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AisleLog_date_departmentId_key" ON "AisleLog"("date", "departmentId");

ALTER TABLE "AisleLog" ADD CONSTRAINT "AisleLog_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;
