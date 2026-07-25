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

    // ✅ New method to create an exec in a container
    async createExec(
        containerId: string,
        options: Docker.ExecCreateOptions,
    ): Promise<Docker.Exec> {
        const container = this.getContainer(containerId);
        return await container.exec(options);
    }

    // ✅ New method to start an exec and get the stream
    async startExec(
        exec: Docker.Exec,
        options?: Docker.ExecStartOptions,
    ): Promise<NodeJS.ReadableStream> {
        const stream = await exec.start({
            hijack: true,
            stdin: false,
            ...options,
        });
        return stream;
    }

    /**
     * Demultiplex a hijacked Docker exec stream into separate stdout/stderr
     * writable streams. Docker multiplexes them with an 8-byte frame header;
     * without demuxing the 'end' event on the raw stream is unreliable.
     */
    demuxStream(
        stream: NodeJS.ReadableStream,
        stdout: NodeJS.WritableStream,
        stderr: NodeJS.WritableStream,
    ): void {
        this.docker.modem.demuxStream(stream, stdout, stderr);
    }
}