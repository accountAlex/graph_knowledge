-- CreateTable
CREATE TABLE "NodeNote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NodeNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NodeNote_userId_idx" ON "NodeNote"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "NodeNote_userId_nodeId_key" ON "NodeNote"("userId", "nodeId");

-- AddForeignKey
ALTER TABLE "NodeNote" ADD CONSTRAINT "NodeNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
