/*
  Warnings:

  - A unique constraint covering the columns `[workspaceId,type]` on the table `WorkspaceContainer` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceContainer_workspaceId_type_key" ON "WorkspaceContainer"("workspaceId", "type");
