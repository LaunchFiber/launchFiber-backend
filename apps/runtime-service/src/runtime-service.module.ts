// apps/runtime-service/src/runtime-service.module.ts

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { PrismaService } from 'libs/prisma/src/prisma.service';

import { DockerModule } from './docker/docker.module';
import { RuntimeServiceController } from './runtime-service.controller';
import { RuntimeServiceService } from './runtime-service.service';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: '.env',
        }),

        DockerModule,
    ],

    controllers: [
        RuntimeServiceController,
    ],

    providers: [
        RuntimeServiceService,
        PrismaService,
    ],

    exports: [
        RuntimeServiceService,
    ],
})
export class RuntimeServiceModule { }