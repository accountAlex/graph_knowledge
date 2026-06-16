-- AlterTable
ALTER TABLE "UserProgress" ADD COLUMN     "dueAt" TIMESTAMP(3),
ADD COLUMN     "ease" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
ADD COLUMN     "lapses" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastReviewedAt" TIMESTAMP(3),
ADD COLUMN     "reps" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "srsInterval" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "UserProgress_userId_dueAt_idx" ON "UserProgress"("userId", "dueAt");
