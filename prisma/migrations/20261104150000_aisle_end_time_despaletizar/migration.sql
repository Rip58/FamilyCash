ALTER TABLE "AisleLog" ADD COLUMN "endTime" TEXT;

-- «Despaletizar» como un pasillo más (secundario: sin camión se deja en blanco y no avisa de "sin personal").
INSERT INTO "Department" ("id", "name", "color", "sortOrder", "targetStaff", "secondary", "active")
SELECT 'despaletizar', 'Despaletizar', '#14b8a6', COALESCE((SELECT MAX("sortOrder") FROM "Department"), 0) + 1, 0, true, true
WHERE NOT EXISTS (SELECT 1 FROM "Department" WHERE "name" ILIKE 'despaletiz%');
