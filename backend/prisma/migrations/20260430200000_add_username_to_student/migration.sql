-- Add username column if it doesn't already exist
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "username" TEXT;

-- Backfill existing rows with a unique username derived from their student ID
UPDATE "Student" SET "username" = "id" WHERE "username" IS NULL;

-- Now enforce NOT NULL
ALTER TABLE "Student" ALTER COLUMN "username" SET NOT NULL;

-- Make username unique (skip if index already exists)
CREATE UNIQUE INDEX IF NOT EXISTS "Student_username_key" ON "Student"("username");

-- Make email nullable
ALTER TABLE "Student" ALTER COLUMN "email" DROP NOT NULL;
