-- CreateEnum
CREATE TYPE "UpdateRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "laptop_update_requests" (
    "id"              TEXT NOT NULL,
    "laptopId"        TEXT NOT NULL,
    "studentId"       TEXT NOT NULL,
    "newBrand"        TEXT,
    "newSerialNumber" TEXT,
    "newImage"        TEXT,
    "reason"          TEXT,
    "status"          "UpdateRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt"      TIMESTAMP(3),
    "reviewedById"    TEXT,

    CONSTRAINT "laptop_update_requests_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "laptop_update_requests" ADD CONSTRAINT "laptop_update_requests_laptopId_fkey"
    FOREIGN KEY ("laptopId") REFERENCES "Laptop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "laptop_update_requests" ADD CONSTRAINT "laptop_update_requests_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "laptop_update_requests" ADD CONSTRAINT "laptop_update_requests_reviewedById_fkey"
    FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
