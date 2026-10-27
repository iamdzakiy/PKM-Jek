-- Hari Ini: additive only. Row lama tetap valid; tidak ada DROP.

-- AlterTable
ALTER TABLE "Habit"
  ADD COLUMN "timeOfDay" TEXT,
  ADD COLUMN "intervalDays" INTEGER,
  ADD COLUMN "minimumVersion" TEXT;

-- AlterTable
ALTER TABLE "Task"
  ADD COLUMN "plannedFor" DATE,
  ADD COLUMN "estimateMin" INTEGER;

CREATE INDEX "Task_userId_plannedFor_idx" ON "Task"("userId", "plannedFor");

-- CreateTable
CREATE TABLE "DailyCheckin" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "energy" INTEGER,
  "journal" TEXT,
  "meditationMin" INTEGER,
  "closedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DailyCheckin_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DailyCheckin_userId_date_key" ON "DailyCheckin"("userId", "date");

ALTER TABLE "DailyCheckin" ADD CONSTRAINT "DailyCheckin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
