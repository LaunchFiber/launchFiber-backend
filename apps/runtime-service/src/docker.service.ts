// apps/runtime-service/src/docker.service.ts
import {
    Injectable,
    InternalServerErrorException,
    Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Docker from 'dockerode';
import {
    Duplex,
    PassThrough,
} from 'node:stream';

interface CreateContainerOptions {
    name: string;
    image: string;
    networkName: string;
    workspaceId: string;
    containerType: string;

    command?: string[];
    environment?: string[];
    exposedPorts?: string[];

    binds?: string[];
}

interface ExecuteCommandOptions {
    containerId: string;
    command: string[];
    workingDirectory?: string;
    environment?: string[];
}

interface ExecuteCommandResult {
    stdout: string;
    stderr: string;
    exitCode: number;
}

@Injectable()
export class DockerService {
    private readonly logger = new Logger(DockerService.name);
    private readonly docker: Docker;

    constructor(private readonly config: ConfigService) {
        const socketPath =
            this.config.get<string>('DOCKER_SOCKET_PATH') ||
            '/var/run/docker.sock';

        this.docker = new Docker({
            socketPath,
        });
    }

    async ping(): Promise<boolean> {
        try {
            await this.docker.ping();
            return true;
        } catch (error) {
            this.logger.error('Docker daemon is unavailable', error);
            return false;
        }
    }

    async ensureImage(image: string): Promise<void> {
        try {
            await this.docker.getImage(image).inspect();
        } catch {
            this.logger.log(`Pulling Docker image ${image}`);

            const stream = await this.docker.pull(image);

            await new Promise<void>((resolve, reject) => {
                this.docker.modem.followProgress(
                    stream,
                    (error) => {
                        if (error) {
                            reject(error);
                            return;
                        }

                        resolve();
                    },
                );
            });
        }
    }

    async createNetwork(networkName: string): Promise<Docker.Network> {
        try {
            const existingNetwork =
                this.docker.getNetwork(networkName);

            await existingNetwork.inspect();

            return existingNetwork;
        } catch {
            this.logger.log(`Creating network ${networkName}`);

            return this.docker.createNetwork({
                Name: networkName,
                Driver: 'bridge',
                CheckDuplicate: true,
                Internal: false,
                Labels: {
                    'fiberdev.managed': 'true',
                },
            });
        }
    }

    async removeNetwork(networkName: string): Promise<void> {
        try {
            const network = this.docker.getNetwork(networkName);
            await network.remove();
        } catch (error) {
            this.logger.warn(
                `Could not remove network ${networkName}`,
            );
        }
    }

    async createVolume(volumeName: string): Promise<Docker.Volume> {
        const volume = this.docker.getVolume(volumeName);

        try {
            await volume.inspect();
            return volume;
        } catch {
            this.logger.log(`Creating volume ${volumeName}`);

            const createdVolume = await this.docker.createVolume({
                Name: volumeName,
                Driver: 'local',
                Labels: {
                    'fiberdev.managed': 'true',
                },
            });

            return this.docker.getVolume(createdVolume.Name);
        }
    }

    async removeVolume(volumeName: string): Promise<void> {
        try {
            const volume = this.docker.getVolume(volumeName);
            await volume.remove();
        } catch {
            this.logger.warn(
                `Could not remove volume ${volumeName}`,
            );
        }
    }

    async createContainer(
        options: CreateContainerOptions,
    ): Promise<Docker.Container> {
        await this.ensureImage(options.image);

        const exposedPorts = Object.fromEntries(
            (options.exposedPorts ?? []).map((port) => [
                port,
                {},
            ]),
        );

        const portBindings = Object.fromEntries(
            (options.exposedPorts ?? []).map((port) => [
                port,
                [
                    {
                        HostIp: '127.0.0.1',
                        HostPort: '',
                    },
                ],
            ]),
        );

        try {
            const existing =
                this.docker.getContainer(options.name);

            const details = await existing.inspect();

            return this.docker.getContainer(details.Id);
        } catch {
            this.logger.log(
                `Creating ${options.containerType} container ${options.name}`,
            );
        }

        const container =
            await this.docker.createContainer({
                name: options.name,
                Image: options.image,
                Cmd: options.command,
                Env: options.environment,

                ExposedPorts:
                    options.exposedPorts?.length
                        ? exposedPorts
                        : undefined,

                Labels: {
                    'fiberdev.managed': 'true',
                    'fiberdev.workspace-id':
                        options.workspaceId,
                    'fiberdev.container-type':
                        options.containerType,
                },

                HostConfig: {
                    AutoRemove: false,
                    NetworkMode: options.networkName,

                    Binds: options.binds ?? [],

                    PortBindings:
                        options.exposedPorts?.length
                            ? portBindings
                            : undefined,

                    Memory: 268435456,
                    NanoCpus: 500000000,
                    PidsLimit: 256,

                    SecurityOpt: [
                        'no-new-privileges:true',
                    ],

                    CapDrop: ['ALL'],
                },
            });

        const details = await container.inspect();

        return this.docker.getContainer(details.Id);
    }

    async startContainer(containerId: string): Promise<void> {
        const container = this.docker.getContainer(containerId);
        const details = await container.inspect();

        if (!details.State.Running) {
            await container.start();
        }
    }

    async stopContainer(containerId: string): Promise<void> {
        const container = this.docker.getContainer(containerId);

        try {
            const details = await container.inspect();

            if (details.State.Running) {
                await container.stop({
                    t: 10,
                });
            }
        } catch {
            this.logger.warn(
                `Container ${containerId} could not be stopped`,
            );
        }
    }

    async removeContainer(containerId: string): Promise<void> {
        const container = this.docker.getContainer(containerId);

        try {
            const details = await container.inspect();

            if (details.State.Running) {
                await container.stop({
                    t: 10,
                });
            }

            await container.remove({
                force: true,
                v: false,
            });
        } catch {
            this.logger.warn(
                `Container ${containerId} could not be removed`,
            );
        }
    }

    async inspectContainer(containerId: string) {
        try {
            const container = this.docker.getContainer(containerId);
            return await container.inspect();
        } catch {
            throw new InternalServerErrorException(
                `Unable to inspect container ${containerId}`,
            );
        }
    }

    async executeCommand(
        options: ExecuteCommandOptions,
    ): Promise<ExecuteCommandResult> {
        const container =
            this.docker.getContainer(options.containerId);

        const details = await container.inspect();

        if (!details.State.Running) {
            throw new Error(
                `Container ${options.containerId} is not running`,
            );
        }

        const exec = await container.exec({
            AttachStdout: true,
            AttachStderr: true,
            Tty: false,

            Cmd: options.command,

            WorkingDir:
                options.workingDirectory ??
                '/workspace',

            Env: options.environment,
        });

        const stream = (await exec.start({
            hijack: true,
            stdin: false,
            Tty: false,
        })) as Duplex;

        const stdoutStream = new PassThrough();
        const stderrStream = new PassThrough();

        const stdoutChunks: Buffer[] = [];
        const stderrChunks: Buffer[] = [];

        stdoutStream.on('data', (chunk: Buffer) => {
            stdoutChunks.push(Buffer.from(chunk));
        });

        stderrStream.on('data', (chunk: Buffer) => {
            stderrChunks.push(Buffer.from(chunk));
        });

        this.docker.modem.demuxStream(
            stream,
            stdoutStream,
            stderrStream,
        );

        await new Promise<void>((resolve, reject) => {
            stream.once('end', resolve);
            stream.once('close', resolve);
            stream.once('error', reject);
        });

        const result = await exec.inspect();

        return {
            stdout:
                Buffer.concat(stdoutChunks).toString('utf8'),

            stderr:
                Buffer.concat(stderrChunks).toString('utf8'),

            exitCode: result.ExitCode ?? 1,
        };
    }

    async waitForCkbRpc(
        containerId: string,
        attempts = 60,
        delayMs = 1000,
    ): Promise<void> {
        for (
            let attempt = 1;
            attempt <= attempts;
            attempt++
        ) {
            const result = await this.executeCommand({
                containerId,

                command: [
                    'sh',
                    '-c',
                    [
                        'curl -sS',
                        '-X POST',
                        '-H "Content-Type: application/json"',
                        '--data',
                        `'{"id":1,"jsonrpc":"2.0","method":"get_tip_block_number","params":[]}'`,
                        'http://127.0.0.1:8114',
                    ].join(' '),
                ],

                workingDirectory: '/',
            });

            if (
                result.exitCode === 0 &&
                result.stdout.includes('"result"')
            ) {
                this.logger.log(
                    'CKB development node is ready',
                );

                return;
            }

            await new Promise((resolve) => {
                setTimeout(resolve, delayMs);
            });
        }

        throw new Error(
            'CKB node failed to become ready',
        );
    }
}