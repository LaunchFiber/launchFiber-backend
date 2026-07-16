import { Controller, Get } from '@nestjs/common';
import { TerminalServiceService } from './terminal-service.service';

@Controller()
export class TerminalServiceController {
  constructor(private readonly terminalServiceService: TerminalServiceService) {}

  @Get()
  getHello(): string {
    return this.terminalServiceService.getHello();
  }
}
