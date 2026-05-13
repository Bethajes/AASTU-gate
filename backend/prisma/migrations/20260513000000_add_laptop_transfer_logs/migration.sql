-- CreateTable
CREATE TABLE "laptop_transfer_logs" (
    "id"              TEXT NOT NULL DEFAULT gen_random_uuid(),
    "laptopId"        TEXT NOT NULL,
    "fromUserId"      TEXT NOT NULL,
    "toUserId"        TEXT NOT NULL,
    "transferredById" TEXT NOT NULL,
    "transferredAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "laptop_transfer_logs_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "laptop_transfer_logs" ADD CONSTRAINT "laptop_transfer_logs_laptopId_fkey"
    FOREIGN KEY ("laptopId") REFERENCES "Laptop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "laptop_transfer_logs" ADD CONSTRAINT "laptop_transfer_logs_fromUserId_fkey"
    FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "laptop_transfer_logs" ADD CONSTRAINT "laptop_transfer_logs_toUserId_fkey"
    FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "laptop_transfer_logs" ADD CONSTRAINT "laptop_transfer_logs_transferredById_fkey"
    FOREIGN KEY ("transferredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
