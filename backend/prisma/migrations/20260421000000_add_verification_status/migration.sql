-- Add VerificationStatus enum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'BLOCKED');

-- Extend Laptop table with verification fields
ALTER TABLE "Laptop"
  ADD COLUMN "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "verifiedAt"         TIMESTAMPTZ,
  ADD COLUMN "verifiedById"       TEXT REFERENCES "User"("id");

-- Extend GateLog table with action column (nullable for backward compat with old rows)
ALTER TABLE "GateLog"
  ADD COLUMN "action" TEXT;
