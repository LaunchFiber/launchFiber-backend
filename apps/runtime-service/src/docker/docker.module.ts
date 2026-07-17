// apps/runtime-service/src/docker/docker.module.ts

import { Module } from '@nestjs/common';
import { DockerService } from './docker.service';

@Module({
    providers: [DockerService],
    exports: [DockerService],
})
export class DockerModule { }