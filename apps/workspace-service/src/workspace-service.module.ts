// apps/workspace-service/src/workspace-service.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';

import { WorkspaceServiceController } from './workspace-service.controller';
import { WorkspaceService } from './workspace-service.service';
import { PrismaService } from 'libs/prisma/src/prisma.service';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: '.env',
        }),

        ClientsModule.registerAsync([
            {
                name: 'RUNTIME_SERVICE',
                imports: [ConfigModule],
                inject: [ConfigService],
                useFactory: (config: ConfigService) => ({
                    transport: Transport.TCP,
                    options: {
                        host:
                            config.get<string>('RUNTIME_SERVICE_HOST') ||
                            '127.0.0.1',
                        port:
                            Number(config.get<string>('RUNTIME_SERVICE_PORT')) ||
                            8003,
                    },
                }),
            },
        ]),
    ],
    controllers: [WorkspaceServiceController],
    providers: [WorkspaceService, PrismaService],
})
export class WorkspaceServiceModule { }