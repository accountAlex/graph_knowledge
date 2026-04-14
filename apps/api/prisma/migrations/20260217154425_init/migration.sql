-- CreateEnum
CREATE TYPE "NodeRole" AS ENUM ('TOPIC', 'CONCEPT', 'METHOD', 'SKILL', 'TASK');

-- CreateEnum
CREATE TYPE "NodeStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "SlotKind" AS ENUM ('CORE', 'METHODS', 'SKILLS', 'TASKS');

-- CreateTable
CREATE TABLE "KgNodeRegistry" (
    "id" TEXT NOT NULL,
    "neo4jKey" TEXT,
    "title" TEXT NOT NULL,
    "role" "NodeRole" NOT NULL,
    "status" "NodeStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KgNodeRegistry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TopicView" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "track" TEXT NOT NULL DEFAULT 'school',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TopicView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TopicViewSlot" (
    "id" TEXT NOT NULL,
    "topicViewId" TEXT NOT NULL,
    "kind" "SlotKind" NOT NULL,
    "minDepthToExpand" INTEGER NOT NULL DEFAULT 1,
    "totalCount" INTEGER NOT NULL DEFAULT 0,
    "orderedNodeIds" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "TopicViewSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TopicViewSlotPinned" (
    "id" TEXT NOT NULL,
    "slotId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,

    CONSTRAINT "TopicViewSlotPinned_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MicroPlan" (
    "id" TEXT NOT NULL,
    "planKey" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MicroPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KgNodeRegistry_neo4jKey_key" ON "KgNodeRegistry"("neo4jKey");

-- CreateIndex
CREATE UNIQUE INDEX "TopicView_topicId_key" ON "TopicView"("topicId");

-- CreateIndex
CREATE UNIQUE INDEX "TopicViewSlot_topicViewId_kind_key" ON "TopicViewSlot"("topicViewId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "TopicViewSlotPinned_slotId_nodeId_key" ON "TopicViewSlotPinned"("slotId", "nodeId");

-- CreateIndex
CREATE UNIQUE INDEX "MicroPlan_planKey_key" ON "MicroPlan"("planKey");

-- AddForeignKey
ALTER TABLE "TopicViewSlot" ADD CONSTRAINT "TopicViewSlot_topicViewId_fkey" FOREIGN KEY ("topicViewId") REFERENCES "TopicView"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopicViewSlotPinned" ADD CONSTRAINT "TopicViewSlotPinned_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "TopicViewSlot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
