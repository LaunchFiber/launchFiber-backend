// apps/file-service/src/docker.service.ts
import {
    Injectable,
    InternalServerErrorException,
    Logger,
    OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Docker from 'dockerode';
import type { Duplex } from 'node:stream';

interface ExecuteOptions {
    containerId: string;
    command: string[];
    workingDirectory?: string;
    input?: Buffer | string;
}

interface ExecuteResult {
    stdout: string;
    stderr: string;
    exitCode: number;
}

@Injectable()
export class DockerService
    implements OnModuleInit {
    private readonly logger =
        new Logger(DockerService.name);

    private readonly docker: Docker;

    constructor(
        private readonly config: ConfigService,
    ) {
        const configuredSocket =
            this.config.get<string>(
                'DOCKER_SOCKET_PATH',
            ) || '/var/run/docker.sock';

        const socketPath = configuredSocket.replace(
            /^unix:\/\//,
            '',
        );

        this.logger.log(
            `Using Docker socket: ${socketPath}`,
        );

        this.docker = new Docker({
            socketPath,
        });
    }

    async onModuleInit(): Promise<void> {
        await this.docker.ping();

        this.logger.log(
            'File service connected to Docker',
        );
    }

    async execute(
        options: ExecuteOptions,
    ): Promise<ExecuteResult> {
        const container = this.docker.getContainer(
            options.containerId,
        );

        const details = await container.inspect();

        if (!details.State.Running) {
            throw new InternalServerErrorException(
                'Workspace runtime container is not running',
            );
        }

        const exec = await container.exec({
            AttachStdin: Boolean(options.input),
            AttachStdout: true,
            AttachStderr: true,
            Tty: false,
            Cmd: options.command,
            WorkingDir:
                options.workingDirectory || '/workspace',
        });

        const stream = (await exec.start({
            hijack: true,
            stdin: Boolean(options.input),
            Tty: false,
        })) as Duplex;

        const stdoutChunks: Buffer[] = [];
        const stderrChunks: Buffer[] = [];

        const stdout = new (require('node:stream')
            .PassThrough)();

        const stderr = new (require('node:stream')
            .PassThrough)();

        stdout.on('data', (chunk: Buffer) => {
            stdoutChunks.push(Buffer.from(chunk));
        });

        stderr.on('data', (chunk: Buffer) => {
            stderrChunks.push(Buffer.from(chunk));
        });

        this.docker.modem.demuxStream(
            stream,
            stdout,
            stderr,
        );

        if (options.input !== undefined) {
            stream.write(options.input);
            stream.end();
        }

        await new Promise<void>((resolve, reject) => {
            stream.on('end', resolve);
            stream.on('close', resolve);
            stream.on('error', reject);
        });

        const result = await exec.inspect();

        return {
            stdout: Buffer.concat(stdoutChunks).toString(
                'utf8',
            ),

            stderr: Buffer.concat(stderrChunks).toString(
                'utf8',
            ),

            exitCode: result.ExitCode ?? 1,
        };
    }
}