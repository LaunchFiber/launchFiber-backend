import { Test, TestingModule } from '@nestjs/testing';
import { TerminalServiceController } from './terminal-service.controller';
import { TerminalService } from './terminal-service.service';

describe('TerminalServiceController', () => {
  let terminalServiceController: TerminalServiceController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [TerminalServiceController],
      providers: [TerminalService],
    }).compile();

    terminalServiceController = app.get<TerminalServiceController>(TerminalServiceController);
  });


});
