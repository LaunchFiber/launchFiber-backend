// apps/file-service/src/file-service.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { PrismaModule } from '../../../libs/prisma/src';
import { FileServiceController } from './file-service.controller';
import { FileServiceService } from './file-service.service';
import { DockerService } from './docker.service';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: '.env',
        }),

        PrismaModule,
    ],

    controllers: [FileServiceController],

    providers: [
        FileServiceService,
        DockerService,
    ],
})
export class FileServiceModule { }