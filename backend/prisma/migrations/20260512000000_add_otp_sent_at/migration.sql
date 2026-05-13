-- AlterTable: track when OTP was last sent to enforce resend cooldown
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "otpSentAt" TIMESTAMP(3);
