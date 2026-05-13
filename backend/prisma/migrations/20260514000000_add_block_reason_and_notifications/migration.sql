-- Add blockReason to Laptop
ALTER TABLE "Laptop" ADD COLUMN IF NOT EXISTS "blockReason" TEXT;

-- Create Notification table
CREATE TABLE IF NOT EXISTS "Notification" (
  "id"        TEXT NOT NULL,
  "type"      TEXT NOT NULL,
  "title"     TEXT NOT NULL,
  "body"      TEXT NOT NULL,
  "isRead"    BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "laptopId"  TEXT,
  "guardId"   TEXT,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);
