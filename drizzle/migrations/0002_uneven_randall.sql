-- First delete any resources that don't have a topic assigned
DELETE FROM "resource" WHERE "topic_id" IS NULL;

-- Then make the column required
ALTER TABLE "resource" ALTER COLUMN "topic_id" SET NOT NULL;