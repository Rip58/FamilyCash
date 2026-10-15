
-- AlterTable
ALTER TABLE "NightNote" ADD COLUMN     "byGuest" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "guestToken" TEXT;

-- CreateTable
CREATE TABLE "GuestChange" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuestChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GuestChange_date_idx" ON "GuestChange"("date");

