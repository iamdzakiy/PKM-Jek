-- AlterTable
ALTER TABLE "Note" ADD COLUMN "dailyFor" DATE;

-- CreateIndex
CREATE UNIQUE INDEX "Note_userId_dailyFor_key" ON "Note"("userId", "dailyFor");
