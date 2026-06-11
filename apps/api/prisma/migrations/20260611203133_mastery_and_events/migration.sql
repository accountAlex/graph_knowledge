-- CreateEnum
CREATE TYPE "MasteryLevel" AS ENUM ('UNSEEN', 'SEEN', 'PRACTICED', 'MASTERED');

-- CreateEnum
CREATE TYPE "LearningEventType" AS ENUM ('VIEW', 'COMPLETE', 'UNCOMPLETE', 'QUIZ_CORRECT', 'QUIZ_WRONG', 'REVIEW', 'MASTERY_CHANGE');

-- AlterTable
ALTER TABLE "UserProgress" ADD COLUMN     "confidence" INTEGER,
ADD COLUMN     "lastEventAt" TIMESTAMP(3),
ADD COLUMN     "mastery" "MasteryLevel" NOT NULL DEFAULT 'SEEN';

-- Backfill: nodes already marked completed are considered mastered
UPDATE "UserProgress" SET "mastery" = 'MASTERED' WHERE "completed" = true;

-- CreateTable
CREATE TABLE "LearningEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "type" "LearningEventType" NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LearningEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LearningEvent_userId_createdAt_idx" ON "LearningEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "LearningEvent_userId_nodeId_idx" ON "LearningEvent"("userId", "nodeId");

-- CreateIndex
CREATE INDEX "LearningEvent_nodeId_type_idx" ON "LearningEvent"("nodeId", "type");

-- CreateIndex
CREATE INDEX "UserProgress_userId_mastery_idx" ON "UserProgress"("userId", "mastery");

-- AddForeignKey
ALTER TABLE "LearningEvent" ADD CONSTRAINT "LearningEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
