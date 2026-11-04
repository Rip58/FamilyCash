-- Los bajados se separan en «sin tocar» (palletsDown) y «sobrante» (palletsSurplus).
ALTER TABLE "AisleLog" ADD COLUMN "palletsSurplus" INTEGER;
UPDATE "AisleLog" SET "palletsSurplus" = "palletsDown", "palletsDown" = NULL WHERE "downSurplus" = true;
ALTER TABLE "AisleLog" DROP COLUMN "downSurplus";
