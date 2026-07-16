import { Module } from '@nestjs/common';
import { TerminalServiceController } from './terminal-service.controller';
import { TerminalServiceService } from './terminal-service.service';

@Module({
  imports: [],
  controllers: [TerminalServiceController],
  providers: [TerminalServiceService],
})
export class TerminalServiceModule {}
