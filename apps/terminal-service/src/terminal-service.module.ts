// apps/terminal-service/src/terminal-service.module.ts
import { Module } from '@nestjs/common';
import {
  ConfigModule,
  ConfigService,
} from '@nestjs/config';
import {
  ClientsModule,
  Transport,
} from '@nestjs/microservices';

import { TerminalServiceController } from './terminal-service.controller';
import { TerminalService } from './terminal-service.service';
import { TerminalGateway } from './terminal.gateway';
import { DockerService } from './docker.service';
import { PrismaService } from 'libs/prisma/src/prisma.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    ClientsModule.registerAsync([
      {
        name: 'AUTH_SERVICE',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.TCP,
          options: {
            host:
              config.get<string>('AUTH_SERVICE_HOST') ||
              '127.0.0.1',

            port:
              Number(
                config.get<string>('AUTH_SERVICE_PORT'),
              ) || 8001,
          },
        }),
      },
    ]),
  ],

  controllers: [TerminalServiceController],

  providers: [
    TerminalService,
    TerminalGateway,
    DockerService,
    PrismaService,
  ],
})
export class TerminalServiceModule { }