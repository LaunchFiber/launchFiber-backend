// apps/terminal-service/src/docker.service.ts
import {
    Injectable,
    Logger,
    OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Docker from 'dockerode';

@Injectable()
export class DockerService implements OnModuleInit {
    private readonly logger = new Logger(DockerService.name);
    private readonly docker: Docker;

    constructor(private readonly config: ConfigService) {
        const configuredSocket =
            this.config.get<string>('DOCKER_SOCKET_PATH') ||
            '/var/run/docker.sock';

        const socketPath = configuredSocket.replace(
            /^unix:\/\//,
            '',
        );

        this.docker = new Docker({
            socketPath,
        });
    }

    async onModuleInit() {
        await this.docker.ping();

        this.logger.log('Terminal service connected to Docker');
    }

    getContainer(containerId: string): Docker.Container {
        return this.docker.getContainer(containerId);
    }

    getExec(execId: string): Docker.Exec {
        return this.docker.getExec(execId);
    }

    async resizeExec(
        execId: string,
        cols: number,
        rows: number,
    ): Promise<void> {
        const exec = this.docker.getExec(execId);

        await exec.resize({
            w: cols,
            h: rows,
        });
    }
}