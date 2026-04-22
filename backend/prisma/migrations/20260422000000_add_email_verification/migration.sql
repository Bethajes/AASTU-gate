-- Add email verification fields to User table
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "isVerified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "verificationCode" TEXT,
  ADD COLUMN IF NOT EXISTS "verificationCodeExpiry" TIMESTAMP(3);
