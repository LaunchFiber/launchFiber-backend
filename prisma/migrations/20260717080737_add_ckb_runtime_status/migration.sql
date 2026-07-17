-- AlterEnum
ALTER TYPE "RuntimeContainerStatus" ADD VALUE 'STARTING';

-- AlterEnum
ALTER TYPE "RuntimeContainerType" ADD VALUE 'CKB_NODE';

-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "ckbDataVolume" TEXT;

-- CreateIndex
CREATE INDEX "WorkspaceContainer_containerId_idx" ON "WorkspaceContainer"("containerId");
