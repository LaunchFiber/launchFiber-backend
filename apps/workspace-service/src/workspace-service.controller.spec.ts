import { Test, TestingModule } from '@nestjs/testing';
import { WorkspaceServiceController } from './workspace-service.controller';
import { WorkspaceService } from './workspace-service.service';

describe('WorkspaceServiceController', () => {
  let workspaceServiceController: WorkspaceServiceController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [WorkspaceServiceController],
      providers: [WorkspaceService],
    }).compile();

    workspaceServiceController = app.get<WorkspaceServiceController>(WorkspaceServiceController);
  });
});
