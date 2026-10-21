-- ADHD OS: additive only. Row lama tetap valid; tidak ada DROP.

-- CreateEnum
CREATE TYPE "EnergyType" AS ENUM ('URGENT', 'DEADLINE', 'ADMIN', 'CREATIVE');
CREATE TYPE "HabitCategory" AS ENUM ('PHYSICAL', 'MENTAL', 'REFLECTIVE', 'ROUTINE');
CREATE TYPE "AdminSourceKind" AS ENUM ('EMAIL', 'WHATSAPP', 'PORTAL', 'OTHER');
CREATE TYPE "AdminItemStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'DONE', 'SKIPPED');
CREATE TYPE "OpportunityStatus" AS ENUM ('WATCHING', 'APPLYING', 'SUBMITTED', 'ARCHIVED');

-- AlterTable
ALTER TABLE "Task"
  ADD COLUMN "energyType" "EnergyType" NOT NULL DEFAULT 'ADMIN',
  ADD COLUMN "handoverDate" TIMESTAMP(3),
  ADD COLUMN "leadDays" INTEGER,
  ADD COLUMN "firstSteps" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "consequence" TEXT,
  ADD COLUMN "parentId" TEXT,
  ADD COLUMN "sprintId" TEXT,
  ADD COLUMN "lastTouchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "archived" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Task_userId_energyType_status_idx" ON "Task"("userId", "energyType", "status");

ALTER TABLE "Task" ADD CONSTRAINT "Task_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "Habit" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" "HabitCategory" NOT NULL DEFAULT 'ROUTINE',
  "variants" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "anchorTrigger" TEXT,
  "firstSteps" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "daysOfWeek" INTEGER[] DEFAULT ARRAY[1,2,3,4,5,6,7]::INTEGER[],
  "targetMinutes" INTEGER NOT NULL DEFAULT 15,
  "archived" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Habit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HabitLog" (
  "id" TEXT NOT NULL,
  "habitId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "stepsDone" INTEGER NOT NULL DEFAULT 0,
  "completed" BOOLEAN NOT NULL DEFAULT false,
  "variantUsed" TEXT,
  "minutes" INTEGER,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HabitLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AdminSource" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "kind" "AdminSourceKind" NOT NULL,
  "url" TEXT,
  "note" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminSource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AdminSweepSession" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  "plannedMin" INTEGER NOT NULL DEFAULT 20,
  "notes" TEXT,
  "itemsFound" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "AdminSweepSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AdminItem" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "sessionId" TEXT,
  "title" TEXT NOT NULL,
  "status" "AdminItemStatus" NOT NULL DEFAULT 'OPEN',
  "dueAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Opportunity" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "source" TEXT,
  "url" TEXT,
  "handoverDate" TIMESTAMP(3) NOT NULL,
  "leadDays" INTEGER,
  "status" "OpportunityStatus" NOT NULL DEFAULT 'WATCHING',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Sprint" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "energyType" "EnergyType" NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "endedAt" TIMESTAMP(3),
  "bufferMin" INTEGER NOT NULL DEFAULT 15,
  "taskId" TEXT,
  "taskTitle" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Sprint_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MicroWin" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "xp" INTEGER NOT NULL DEFAULT 5,
  "kind" TEXT NOT NULL DEFAULT 'habit',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MicroWin_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserProgress" (
  "userId" TEXT NOT NULL,
  "xp" INTEGER NOT NULL DEFAULT 0,
  "level" INTEGER NOT NULL DEFAULT 1,
  "streakDays" INTEGER NOT NULL DEFAULT 0,
  "streakFrozen" INTEGER NOT NULL DEFAULT 2,
  "lastWinAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserProgress_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE "BodyDoubleSession" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "taskTitle" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastPingAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  CONSTRAINT "BodyDoubleSession_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "Habit_userId_archived_idx" ON "Habit"("userId", "archived");
CREATE UNIQUE INDEX "HabitLog_habitId_date_key" ON "HabitLog"("habitId", "date");
CREATE INDEX "HabitLog_habitId_date_idx" ON "HabitLog"("habitId", "date");
CREATE INDEX "AdminSource_userId_active_idx" ON "AdminSource"("userId", "active");
CREATE INDEX "AdminSweepSession_userId_startedAt_idx" ON "AdminSweepSession"("userId", "startedAt");
CREATE INDEX "AdminItem_userId_status_idx" ON "AdminItem"("userId", "status");
CREATE INDEX "Opportunity_userId_status_handoverDate_idx" ON "Opportunity"("userId", "status", "handoverDate");
CREATE INDEX "Sprint_userId_startsAt_idx" ON "Sprint"("userId", "startsAt");
CREATE INDEX "MicroWin_userId_createdAt_idx" ON "MicroWin"("userId", "createdAt");
CREATE INDEX "BodyDoubleSession_roomId_lastPingAt_idx" ON "BodyDoubleSession"("roomId", "lastPingAt");

-- Foreign keys
ALTER TABLE "Habit" ADD CONSTRAINT "Habit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HabitLog" ADD CONSTRAINT "HabitLog_habitId_fkey" FOREIGN KEY ("habitId") REFERENCES "Habit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdminSource" ADD CONSTRAINT "AdminSource_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdminSweepSession" ADD CONSTRAINT "AdminSweepSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdminItem" ADD CONSTRAINT "AdminItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdminItem" ADD CONSTRAINT "AdminItem_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "AdminSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdminItem" ADD CONSTRAINT "AdminItem_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AdminSweepSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Sprint" ADD CONSTRAINT "Sprint_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MicroWin" ADD CONSTRAINT "MicroWin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserProgress" ADD CONSTRAINT "UserProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BodyDoubleSession" ADD CONSTRAINT "BodyDoubleSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
