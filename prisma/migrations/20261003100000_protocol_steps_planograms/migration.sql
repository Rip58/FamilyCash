-- CreateTable
CREATE TABLE "ProtocolStep" (
    "id" TEXT NOT NULL,
    "protocolId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "text" TEXT NOT NULL,
    "photoUrl" TEXT,
    "photoPathname" TEXT,
    "photoWidth" INTEGER,
    "photoHeight" INTEGER,
    "photoSize" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProtocolStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShelfLocation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ShelfLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Planogram" (
    "id" TEXT NOT NULL,
    "locationId" TEXT,
    "text" TEXT NOT NULL,
    "until" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Planogram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanogramPhoto" (
    "id" TEXT NOT NULL,
    "planogramId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "pathname" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "size" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PlanogramPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProtocolStep_protocolId_sortOrder_idx" ON "ProtocolStep"("protocolId", "sortOrder");

-- AddForeignKey
ALTER TABLE "ProtocolStep" ADD CONSTRAINT "ProtocolStep_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "Protocol"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Planogram" ADD CONSTRAINT "Planogram_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "ShelfLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanogramPhoto" ADD CONSTRAINT "PlanogramPhoto_planogramId_fkey" FOREIGN KEY ("planogramId") REFERENCES "Planogram"("id") ON DELETE CASCADE ON UPDATE CASCADE;
