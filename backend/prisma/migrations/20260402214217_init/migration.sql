-- CreateEnum
CREATE TYPE "Role" AS ENUM ('STUDENT', 'GUARD', 'ADMIN');

-- CreateEnum
CREATE TYPE "ScanType" AS ENUM ('IN', 'OUT');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "studentId" TEXT,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'STUDENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Laptop" (
    "id" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "qrCode" TEXT,
    "isInCampus" BOOLEAN NOT NULL DEFAULT false,
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ownerId" TEXT NOT NULL,

    CONSTRAINT "Laptop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GateLog" (
    "id" TEXT NOT NULL,
    "scanType" "ScanType" NOT NULL,
    "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "laptopId" TEXT NOT NULL,
    "scannedById" TEXT NOT NULL,

    CONSTRAINT "GateLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_studentId_key" ON "User"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Laptop_serialNumber_key" ON "Laptop"("serialNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Laptop_qrCode_key" ON "Laptop"("qrCode");

-- AddForeignKey
ALTER TABLE "Laptop" ADD CONSTRAINT "Laptop_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GateLog" ADD CONSTRAINT "GateLog_laptopId_fkey" FOREIGN KEY ("laptopId") REFERENCES "Laptop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GateLog" ADD CONSTRAINT "GateLog_scannedById_fkey" FOREIGN KEY ("scannedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
