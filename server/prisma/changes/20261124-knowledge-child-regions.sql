BEGIN;
ALTER TABLE "knowledge_nodes"
  ADD COLUMN IF NOT EXISTS "childRegions" JSONB NOT NULL DEFAULT '[]'::jsonb;
COMMIT;
