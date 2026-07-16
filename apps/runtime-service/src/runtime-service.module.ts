// apps/runtime-service/src/runtime-service.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RuntimeServiceController } from './runtime-service.controller';
import { RuntimeServiceService } from './runtime-service.service';
import { DockerService } from './docker.service';
import { PrismaService } from 'libs/prisma/src/prisma.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
  ],
  controllers: [RuntimeServiceController],
  providers: [
    RuntimeServiceService,
    DockerService,
    PrismaService,
  ],
})
export class RuntimeServiceModule { }