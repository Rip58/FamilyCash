-- Día de cierre de la nómina (horas extra, fiestas… de después del cierre van a la del mes siguiente)
ALTER TABLE "PayrollSettings" ADD COLUMN "cutoffDay" INTEGER DEFAULT 27;
