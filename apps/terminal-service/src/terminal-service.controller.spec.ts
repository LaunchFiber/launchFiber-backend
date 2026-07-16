import { Test, TestingModule } from '@nestjs/testing';
import { TerminalServiceController } from './terminal-service.controller';
import { TerminalServiceService } from './terminal-service.service';

describe('TerminalServiceController', () => {
  let terminalServiceController: TerminalServiceController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [TerminalServiceController],
      providers: [TerminalServiceService],
    }).compile();

    terminalServiceController = app.get<TerminalServiceController>(TerminalServiceController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(terminalServiceController.getHello()).toBe('Hello World!');
    });
  });
});
