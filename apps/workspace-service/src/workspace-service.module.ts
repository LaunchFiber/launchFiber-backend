import { Module } from '@nestjs/common';
import { WorkspaceServiceController } from './workspace-service.controller';
import { WorkspaceService } from './workspace-service.service';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from 'libs/prisma/src/prisma.service';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: '.env',
        })
    ],
    controllers: [WorkspaceServiceController],
    providers: [WorkspaceService, PrismaService],
})
export class WorkspaceServiceModule { }
