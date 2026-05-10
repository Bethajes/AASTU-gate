-- CreateTable
CREATE TABLE "Student" (
    "id"          TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "email"       TEXT NOT NULL,
    "photo"       TEXT,
    "department"  TEXT NOT NULL,
    "isActivated" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Student_email_key" ON "Student"("email");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;
