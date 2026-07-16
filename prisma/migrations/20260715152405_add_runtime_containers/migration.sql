-- CreateEnum
CREATE TYPE "RuntimeContainerType" AS ENUM ('IDE', 'FIBER_RUNTIME', 'PREVIEW', 'TEST_RUNNER');

-- CreateEnum
CREATE TYPE "RuntimeContainerStatus" AS ENUM ('CREATED', 'RUNNING', 'STOPPED', 'FAILED');

-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "lastStartedAt" TIMESTAMP(3),
ADD COLUMN     "lastStoppedAt" TIMESTAMP(3),
ADD COLUMN     "runtimeNetwork" TEXT,
ADD COLUMN     "runtimeVolume" TEXT;

-- CreateTable
CREATE TABLE "WorkspaceContainer" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "containerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "RuntimeContainerType" NOT NULL,
    "image" TEXT NOT NULL,
    "status" "RuntimeContainerStatus" NOT NULL DEFAULT 'CREATED',
    "internalPort" INTEGER,
    "hostPort" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceContainer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceContainer_containerId_key" ON "WorkspaceContainer"("containerId");

-- CreateIndex
CREATE INDEX "WorkspaceContainer_workspaceId_idx" ON "WorkspaceContainer"("workspaceId");

-- AddForeignKey
ALTER TABLE "WorkspaceContainer" ADD CONSTRAINT "WorkspaceContainer_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
