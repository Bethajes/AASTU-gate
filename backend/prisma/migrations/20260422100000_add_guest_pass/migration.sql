-- Create GuestPass table
CREATE TABLE "GuestPass" (
  "id"                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "guestName"          TEXT NOT NULL,
  "phone"              TEXT NOT NULL,
  "purpose"            TEXT NOT NULL,
  "deviceBrand"        TEXT NOT NULL,
  "deviceModel"        TEXT NOT NULL,
  "serialNumber"       TEXT NOT NULL,
  "guestCode"          CHAR(8) UNIQUE NOT NULL,
  "isInCampus"         BOOLEAN NOT NULL DEFAULT false,
  "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'VERIFIED',
  "registeredById"     TEXT NOT NULL REFERENCES "User"("id"),
  "registeredAt"       TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Extend GateLog: add guestPassId and make laptopId nullable
ALTER TABLE "GateLog"
  ADD COLUMN "guestPassId" UUID REFERENCES "GuestPass"("id");

ALTER TABLE "GateLog"
  ALTER COLUMN "laptopId" DROP NOT NULL;
