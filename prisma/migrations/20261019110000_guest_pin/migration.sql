
-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "guestFails" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "guestLockedUntil" TIMESTAMP(3),
ADD COLUMN     "guestPinHash" TEXT;

