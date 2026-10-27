-- Peran/proyek bertag untuk tangkap cepat (#imd, #statdas, ...)
ALTER TABLE "Project" ADD COLUMN "tag" TEXT;

-- Latihan: log sesi gym/lari/yoga
CREATE TABLE "WorkoutLog" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "workout" TEXT NOT NULL,
  "sets" JSONB NOT NULL DEFAULT '[]',
  "minutes" INTEGER,
  "distanceKm" DOUBLE PRECISION,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkoutLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkoutLog_userId_date_workout_key" ON "WorkoutLog"("userId", "date", "workout");
CREATE INDEX "WorkoutLog_userId_workout_date_idx" ON "WorkoutLog"("userId", "workout", "date");
ALTER TABLE "WorkoutLog" ADD CONSTRAINT "WorkoutLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Timbang mingguan
CREATE TABLE "BodyLog" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "weightKg" DOUBLE PRECISION NOT NULL,
  "waistCm" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BodyLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BodyLog_userId_date_key" ON "BodyLog"("userId", "date");
ALTER TABLE "BodyLog" ADD CONSTRAINT "BodyLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
