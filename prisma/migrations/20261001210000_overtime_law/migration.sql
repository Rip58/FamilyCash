-- AlterTable
ALTER TABLE "PayrollSettings" ADD COLUMN     "overtimeMode" TEXT NOT NULL DEFAULT 'LAW',
ADD COLUMN     "overtimeSurchargePercent" DOUBLE PRECISION NOT NULL DEFAULT 40;

