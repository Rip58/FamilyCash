-- El ojo de los pasillos pasa de ser del departamento (para siempre) a ser de cada noche.
ALTER TABLE "AisleLog" ADD COLUMN "hidden" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Department" DROP COLUMN "aisleHidden";
