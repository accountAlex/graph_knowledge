-- CreateEnum
CREATE TYPE "WhiteboardRole" AS ENUM ('VIEWER', 'EDITOR');

-- CreateTable
CREATE TABLE "Whiteboard" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Новая доска',
    "ownerId" TEXT NOT NULL,
    "nodeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Whiteboard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhiteboardMember" (
    "id" TEXT NOT NULL,
    "whiteboardId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "WhiteboardRole" NOT NULL DEFAULT 'EDITOR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhiteboardMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhiteboardSnapshot" (
    "whiteboardId" TEXT NOT NULL,
    "state" BYTEA NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhiteboardSnapshot_pkey" PRIMARY KEY ("whiteboardId")
);

-- CreateIndex
CREATE INDEX "Whiteboard_ownerId_idx" ON "Whiteboard"("ownerId");

-- CreateIndex
CREATE INDEX "Whiteboard_nodeId_idx" ON "Whiteboard"("nodeId");

-- CreateIndex
CREATE INDEX "WhiteboardMember_userId_idx" ON "WhiteboardMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WhiteboardMember_whiteboardId_userId_key" ON "WhiteboardMember"("whiteboardId", "userId");

-- AddForeignKey
ALTER TABLE "Whiteboard" ADD CONSTRAINT "Whiteboard_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhiteboardMember" ADD CONSTRAINT "WhiteboardMember_whiteboardId_fkey" FOREIGN KEY ("whiteboardId") REFERENCES "Whiteboard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhiteboardMember" ADD CONSTRAINT "WhiteboardMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhiteboardSnapshot" ADD CONSTRAINT "WhiteboardSnapshot_whiteboardId_fkey" FOREIGN KEY ("whiteboardId") REFERENCES "Whiteboard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
