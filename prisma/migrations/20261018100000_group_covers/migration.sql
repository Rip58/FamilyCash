
-- CreateTable
CREATE TABLE "GroupCover" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "departmentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupCover_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GroupCover_date_departmentId_key" ON "GroupCover"("date", "departmentId");

-- AddForeignKey
ALTER TABLE "GroupCover" ADD CONSTRAINT "GroupCover_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

