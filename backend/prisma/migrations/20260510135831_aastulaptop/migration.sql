/*
  Warnings:

  - The primary key for the `GuestPass` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- DropForeignKey
ALTER TABLE "GateLog" DROP CONSTRAINT "GateLog_guestPassId_fkey";

-- DropForeignKey
ALTER TABLE "GateLog" DROP CONSTRAINT "GateLog_laptopId_fkey";

-- DropForeignKey
ALTER TABLE "GuestPass" DROP CONSTRAINT "GuestPass_registeredById_fkey";

-- DropForeignKey
ALTER TABLE "Laptop" DROP CONSTRAINT "Laptop_verifiedById_fkey";

-- AlterTable
ALTER TABLE "GateLog" ALTER COLUMN "guestPassId" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "GuestPass" DROP CONSTRAINT "GuestPass_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "registeredAt" SET DATA TYPE TIMESTAMP(3),
ADD CONSTRAINT "GuestPass_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Laptop" ADD COLUMN     "photoUrl" TEXT,
ALTER COLUMN "verifiedAt" SET DATA TYPE TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "Laptop" ADD CONSTRAINT "Laptop_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GateLog" ADD CONSTRAINT "GateLog_laptopId_fkey" FOREIGN KEY ("laptopId") REFERENCES "Laptop"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GateLog" ADD CONSTRAINT "GateLog_guestPassId_fkey" FOREIGN KEY ("guestPassId") REFERENCES "GuestPass"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestPass" ADD CONSTRAINT "GuestPass_registeredById_fkey" FOREIGN KEY ("registeredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
