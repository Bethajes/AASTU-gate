ALTER TABLE "Laptop"
  ADD COLUMN "securityStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "reportReason" TEXT,
  ADD COLUMN "reportedAt" TIMESTAMP(3),
  ADD COLUMN "reportedById" TEXT,
  ADD COLUMN "recoveredAt" TIMESTAMP(3),
  ADD COLUMN "recoveredById" TEXT,
  ADD COLUMN "recoveryNote" TEXT;

CREATE TABLE "lost_stolen_audit_logs" (
  "id" TEXT NOT NULL,
  "laptopId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "fromStatus" TEXT,
  "toStatus" TEXT NOT NULL,
  "reason" TEXT,
  "actorId" TEXT NOT NULL,
  "actorRole" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lost_stolen_audit_logs_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "lost_stolen_audit_logs"
  ADD CONSTRAINT "lost_stolen_audit_logs_laptopId_fkey"
  FOREIGN KEY ("laptopId") REFERENCES "Laptop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
