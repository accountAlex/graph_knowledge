-- AlterTable
ALTER TABLE "KgNodeRegistry" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "KgNodeVersion" (
    "id" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "content" TEXT,
    "resources" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "role" "NodeRole" NOT NULL,
    "status" "NodeStatus" NOT NULL,
    "editedBy" TEXT,
    "changeNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KgNodeVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KgNodeVersion_nodeId_version_idx" ON "KgNodeVersion"("nodeId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "KgNodeVersion_nodeId_version_key" ON "KgNodeVersion"("nodeId", "version");

-- AddForeignKey
ALTER TABLE "KgNodeVersion" ADD CONSTRAINT "KgNodeVersion_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "KgNodeRegistry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
