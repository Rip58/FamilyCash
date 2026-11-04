-- Notificaciones a un empleado: una nota con categoría NOTIFICATION que se puede firmar (conforme / no conforme).
ALTER TABLE "NightNote" ADD COLUMN "agreement" TEXT;
ALTER TABLE "NightNote" ADD COLUMN "signature" TEXT;
ALTER TABLE "NightNote" ADD COLUMN "signedAt" TIMESTAMP(3);
ALTER TABLE "NightNote" ADD COLUMN "signedById" TEXT;
