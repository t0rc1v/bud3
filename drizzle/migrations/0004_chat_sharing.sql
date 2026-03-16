ALTER TABLE "chat"
  ADD COLUMN "visibility" varchar(20) NOT NULL DEFAULT 'private',
  ADD COLUMN "share_token" uuid;

CREATE UNIQUE INDEX "chat_share_token_idx" ON "chat" ("share_token")
  WHERE "share_token" IS NOT NULL;
