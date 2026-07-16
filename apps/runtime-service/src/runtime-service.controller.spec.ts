import { Test, TestingModule } from '@nestjs/testing';
import { RuntimeServiceController } from './runtime-service.controller';
import { RuntimeServiceService } from './runtime-service.service';

describe('RuntimeServiceController', () => {
  let runtimeServiceController: RuntimeServiceController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [RuntimeServiceController],
      providers: [RuntimeServiceService],
    }).compile();

    runtimeServiceController = app.get<RuntimeServiceController>(RuntimeServiceController);
  });
});
