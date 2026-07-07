-- AlterTable
ALTER TABLE "Whiteboard" ADD COLUMN     "shareRole" "WhiteboardRole",
ADD COLUMN     "shareToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Whiteboard_shareToken_key" ON "Whiteboard"("shareToken");
