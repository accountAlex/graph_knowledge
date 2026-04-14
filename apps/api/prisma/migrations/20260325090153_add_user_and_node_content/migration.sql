-- AlterTable
ALTER TABLE "KgNodeRegistry" ADD COLUMN     "content" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "fipiCode" TEXT,
ADD COLUMN     "resources" TEXT[] DEFAULT ARRAY[]::TEXT[];
