-- Ajustes → Importar con IA: modelo elegido para cada IA
ALTER TABLE "Settings" ADD COLUMN "aiModels" JSONB NOT NULL DEFAULT '{}';
