-- AlterTable: add OTP activation state columns to Student
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "otpCode" TEXT;
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "otpExpiry" TIMESTAMP(3);
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "pendingEmail" TEXT;
