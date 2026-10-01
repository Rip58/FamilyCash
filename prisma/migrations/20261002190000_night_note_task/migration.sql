-- AlterTable
ALTER TABLE "NightNote" ADD COLUMN     "departmentId" TEXT,
ADD COLUMN     "doneAt" TIMESTAMP(3),
ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'INFO';

-- AddForeignKey
ALTER TABLE "NightNote" ADD CONSTRAINT "NightNote_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

