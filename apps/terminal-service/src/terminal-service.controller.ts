// apps/terminal-service/src/terminal-service.controller.ts
import { Controller, Get } from '@nestjs/common';
import { TerminalService } from './terminal-service.service';

@Controller()
export class TerminalServiceController {
  constructor(
    private readonly terminalService: TerminalService,
  ) { }

  @Get('health')
  health() {
    return {
      status: 'ok',
      service: 'terminal-service',
      timestamp: new Date().toISOString(),
    };
  }
}