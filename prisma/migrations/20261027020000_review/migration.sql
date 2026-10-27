-- Review mingguan: vision, target musim, top 3 minggu
CREATE TABLE "PlanEntry" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "period" TEXT NOT NULL DEFAULT '',
  "content" TEXT NOT NULL DEFAULT '',
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlanEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlanEntry_userId_scope_period_key" ON "PlanEntry"("userId", "scope", "period");
ALTER TABLE "PlanEntry" ADD CONSTRAINT "PlanEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
