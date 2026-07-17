// apps/runtime-service/src/docker/docker.service.ts

import {
    Injectable,
    Logger,
    OnModuleInit,
} from '@nestjs/common';

import Docker from 'dockerode';

import {
    Duplex,
    PassThrough,
} from 'node:stream';

export interface CreateContainerOptions {
    name: string;
    image: string;

    networkName: string;
    workspaceId: string;
    containerType: string;

    command?: string[];
    environment?: string[];

    exposedPorts?: string[];
    binds?: string[];

    workingDirectory?: string;

    memory?: number;
    nanoCpus?: number;
    pidsLimit?: number;

    privileged?: boolean;
}

export interface ExecuteCommandOptions {
    containerId: string;
    command: string[];

    workingDirectory?: string;
    environment?: string[];
}

export interface ExecuteCommandResult {
    stdout: string;
    stderr: string;
    exitCode: number;
}

export interface ContainerPort {
    internalPort: number;
    hostPort: number | null;
}

@Injectable()
export class DockerService implements OnModuleInit {
    private readonly logger =
        new Logger(DockerService.name);

    private readonly docker: Docker;

    constructor() {
        const dockerSocketPath =
            process.env.DOCKER_SOCKET_PATH;

        if (dockerSocketPath) {
            this.logger.log(
                `Using Docker socket: ${dockerSocketPath}`,
            );

            this.docker = new Docker({
                socketPath: dockerSocketPath,
            });
        } else {
            this.logger.log(
                'Using default Docker socket',
            );

            this.docker = new Docker();
        }
    }

    async onModuleInit(): Promise<void> {
        await this.ping();
    }

    async ping(): Promise<void> {
        try {
            await this.docker.ping();

            const info =
                await this.docker.info();

            this.logger.log(
                `Connected to Docker: ${info.Name}`,
            );
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Unknown Docker connection error';

            this.logger.error(
                `Unable to connect to Docker: ${message}`,
            );

            throw error;
        }
    }

    async ensureImage(
        imageName: string,
    ): Promise<void> {
        try {
            const image =
                this.docker.getImage(imageName);

            await image.inspect();

            this.logger.debug(
                `Docker image already exists: ${imageName}`,
            );
        } catch {
            this.logger.log(
                `Pulling Docker image: ${imageName}`,
            );

            await new Promise<void>(
                (resolve, reject) => {
                    this.docker.pull(
                        imageName,
                        (
                            pullError,
                            stream,
                        ) => {
                            if (
                                pullError ||
                                !stream
                            ) {
                                reject(
                                    pullError ??
                                        new Error(
                                            `Unable to pull image ${imageName}`,
                                        ),
                                );

                                return;
                            }

                            this.docker.modem.followProgress(
                                stream,
                                (progressError) => {
                                    if (
                                        progressError
                                    ) {
                                        reject(
                                            progressError,
                                        );

                                        return;
                                    }

                                    this.logger.log(
                                        `Pulled Docker image: ${imageName}`,
                                    );

                                    resolve();
                                },
                            );
                        },
                    );
                },
            );
        }
    }

    async networkExists(
        networkName: string,
    ): Promise<boolean> {
        try {
            const network =
                this.docker.getNetwork(
                    networkName,
                );

            await network.inspect();

            return true;
        } catch {
            return false;
        }
    }

    async createNetwork(
        networkName: string,
    ): Promise<Docker.Network> {
        const exists =
            await this.networkExists(
                networkName,
            );

        if (exists) {
            this.logger.debug(
                `Docker network already exists: ${networkName}`,
            );

            return this.docker.getNetwork(
                networkName,
            );
        }

        this.logger.log(
            `Creating Docker network: ${networkName}`,
        );

        const network =
            await this.docker.createNetwork({
                Name: networkName,
                Driver: 'bridge',

                Labels: {
                    'fiberdev.managed':
                        'true',
                },
            });

        return this.docker.getNetwork(
            network.id,
        );
    }

    async removeNetwork(
        networkName: string,
    ): Promise<void> {
        try {
            const network =
                this.docker.getNetwork(
                    networkName,
                );

            await network.inspect();
            await network.remove();

            this.logger.log(
                `Removed Docker network: ${networkName}`,
            );
        } catch (error) {
            this.logger.warn(
                `Unable to remove network ${networkName}: ${
                    error instanceof Error
                        ? error.message
                        : 'Unknown error'
                }`,
            );
        }
    }

    async volumeExists(
        volumeName: string,
    ): Promise<boolean> {
        try {
            const volume =
                this.docker.getVolume(
                    volumeName,
                );

            await volume.inspect();

            return true;
        } catch {
            return false;
        }
    }

    async createVolume(
        volumeName: string,
    ): Promise<Docker.Volume> {
        const exists =
            await this.volumeExists(
                volumeName,
            );

        if (exists) {
            this.logger.debug(
                `Docker volume already exists: ${volumeName}`,
            );

            return this.docker.getVolume(
                volumeName,
            );
        }

        this.logger.log(
            `Creating Docker volume: ${volumeName}`,
        );

        await this.docker.createVolume({
            Name: volumeName,

            Labels: {
                'fiberdev.managed':
                    'true',
            },
        });

        return this.docker.getVolume(
            volumeName,
        );
    }

    async removeVolume(
        volumeName: string,
    ): Promise<void> {
        try {
            const volume =
                this.docker.getVolume(
                    volumeName,
                );

            await volume.inspect();
            await volume.remove();

            this.logger.log(
                `Removed Docker volume: ${volumeName}`,
            );
        } catch (error) {
            this.logger.warn(
                `Unable to remove volume ${volumeName}: ${
                    error instanceof Error
                        ? error.message
                        : 'Unknown error'
                }`,
            );
        }
    }

    async containerExists(
        containerNameOrId: string,
    ): Promise<boolean> {
        try {
            const container =
                this.docker.getContainer(
                    containerNameOrId,
                );

            await container.inspect();

            return true;
        } catch {
            return false;
        }
    }

    async getContainer(
        containerNameOrId: string,
    ): Promise<Docker.Container | null> {
        try {
            const container =
                this.docker.getContainer(
                    containerNameOrId,
                );

            await container.inspect();

            return container;
        } catch {
            return null;
        }
    }

    async createContainer(
        options: CreateContainerOptions,
    ): Promise<Docker.Container> {
        const existingContainer =
            await this.getContainer(
                options.name,
            );

        if (existingContainer) {
            this.logger.debug(
                `Docker container already exists: ${options.name}`,
            );

            return existingContainer;
        }

        await this.ensureImage(
            options.image,
        );

        const exposedPorts =
            Object.fromEntries(
                (
                    options.exposedPorts ??
                    []
                ).map((port) => [
                    port,
                    {},
                ]),
            );

        const portBindings =
            Object.fromEntries(
                (
                    options.exposedPorts ??
                    []
                ).map((port) => [
                    port,
                    [
                        {
                            HostIp:
                                '127.0.0.1',

                            // Docker automatically
                            // selects an available port.
                            HostPort: '',
                        },
                    ],
                ]),
            );

        this.logger.log(
            `Creating ${options.containerType} container: ${options.name}`,
        );

        const container =
            await this.docker.createContainer(
                {
                    name: options.name,

                    Image: options.image,
                    Cmd: options.command,
                    Env: options.environment,

                    WorkingDir:
                        options.workingDirectory,

                    ExposedPorts:
                        options
                            .exposedPorts
                            ?.length
                            ? exposedPorts
                            : undefined,

                    Labels: {
                        'fiberdev.managed':
                            'true',

                        'fiberdev.workspace-id':
                            options.workspaceId,

                        'fiberdev.container-type':
                            options.containerType,
                    },

                    HostConfig: {
                        AutoRemove: false,

                        NetworkMode:
                            options.networkName,

                        Binds:
                            options.binds ??
                            [],

                        PortBindings:
                            options
                                .exposedPorts
                                ?.length
                                ? portBindings
                                : undefined,

                        Memory:
                            options.memory ??
                            512 *
                                1024 *
                                1024,

                        NanoCpus:
                            options.nanoCpus ??
                            1_000_000_000,

                        PidsLimit:
                            options.pidsLimit ??
                            512,

                        Privileged:
                            options.privileged ??
                            false,

                        SecurityOpt:
                            options.privileged
                                ? undefined
                                : [
                                      'no-new-privileges:true',
                                  ],

                        CapDrop:
                            options.privileged
                                ? undefined
                                : ['ALL'],
                    },
                },
            );

        return this.docker.getContainer(
            container.id,
        );
    }

    async startContainer(
        containerNameOrId: string,
    ): Promise<Docker.Container> {
        const container =
            this.docker.getContainer(
                containerNameOrId,
            );

        const details =
            await container.inspect();

        if (details.State.Running) {
            this.logger.debug(
                `Container already running: ${details.Name}`,
            );

            return container;
        }

        this.logger.log(
            `Starting Docker container: ${details.Name}`,
        );

        await container.start();

        return container;
    }

    async stopContainer(
        containerNameOrId: string,
        timeoutSeconds = 10,
    ): Promise<void> {
        const container =
            await this.getContainer(
                containerNameOrId,
            );

        if (!container) {
            return;
        }

        const details =
            await container.inspect();

        if (!details.State.Running) {
            return;
        }

        this.logger.log(
            `Stopping Docker container: ${details.Name}`,
        );

        await container.stop({
            t: timeoutSeconds,
        });
    }

    async removeContainer(
        containerNameOrId: string,
        removeVolumes = false,
    ): Promise<void> {
        const container =
            await this.getContainer(
                containerNameOrId,
            );

        if (!container) {
            return;
        }

        const details =
            await container.inspect();

        if (details.State.Running) {
            await container.stop({
                t: 10,
            });
        }

        await container.remove({
            force: true,
            v: removeVolumes,
        });

        this.logger.log(
            `Removed Docker container: ${details.Name}`,
        );
    }

    async inspectContainer(
        containerNameOrId: string,
    ): Promise<Docker.ContainerInspectInfo> {
        const container =
            this.docker.getContainer(
                containerNameOrId,
            );

        return container.inspect();
    }

    async getContainerPort(
        containerNameOrId: string,
        internalPort: number,
    ): Promise<ContainerPort> {
        const details =
            await this.inspectContainer(
                containerNameOrId,
            );

        const portKey =
            `${internalPort}/tcp`;

        const bindings =
            details.NetworkSettings.Ports?.[
                portKey
            ];

        const hostPort =
            bindings?.[0]?.HostPort
                ? Number(
                      bindings[0]
                          .HostPort,
                  )
                : null;

        return {
            internalPort,
            hostPort,
        };
    }

    async executeCommand(
        options: ExecuteCommandOptions,
    ): Promise<ExecuteCommandResult> {
        const container =
            this.docker.getContainer(
                options.containerId,
            );

        const details =
            await container.inspect();

        if (!details.State.Running) {
            throw new Error(
                `Container ${options.containerId} is not running`,
            );
        }

        const exec =
            await container.exec({
                AttachStdout: true,
                AttachStderr: true,
                AttachStdin: false,

                Tty: false,

                Cmd: options.command,

                WorkingDir:
                    options.workingDirectory ??
                    '/workspace',

                Env: options.environment,
            });

        const stream =
            (await exec.start({
                hijack: true,
                stdin: false,
                Tty: false,
            })) as Duplex;

        const stdoutStream =
            new PassThrough();

        const stderrStream =
            new PassThrough();

        const stdoutChunks:
            Buffer[] = [];

        const stderrChunks:
            Buffer[] = [];

        stdoutStream.on(
            'data',
            (
                chunk:
                    | Buffer
                    | string,
            ) => {
                stdoutChunks.push(
                    Buffer.isBuffer(
                        chunk,
                    )
                        ? chunk
                        : Buffer.from(
                              chunk,
                          ),
                );
            },
        );

        stderrStream.on(
            'data',
            (
                chunk:
                    | Buffer
                    | string,
            ) => {
                stderrChunks.push(
                    Buffer.isBuffer(
                        chunk,
                    )
                        ? chunk
                        : Buffer.from(
                              chunk,
                          ),
                );
            },
        );

        this.docker.modem.demuxStream(
            stream,
            stdoutStream,
            stderrStream,
        );

        await new Promise<void>(
            (resolve, reject) => {
                let settled = false;

                const finish = () => {
                    if (settled) {
                        return;
                    }

                    settled = true;
                    resolve();
                };

                stream.once(
                    'end',
                    finish,
                );

                stream.once(
                    'close',
                    finish,
                );

                stream.once(
                    'error',
                    reject,
                );
            },
        );

        const result =
            await exec.inspect();

        return {
            stdout: Buffer.concat(
                stdoutChunks,
            ).toString('utf8'),

            stderr: Buffer.concat(
                stderrChunks,
            ).toString('utf8'),

            exitCode:
                result.ExitCode ??
                1,
        };
    }

    async waitForContainer(
        containerNameOrId: string,
        attempts = 30,
        delayMs = 1_000,
    ): Promise<void> {
        for (
            let attempt = 1;
            attempt <= attempts;
            attempt++
        ) {
            try {
                const details =
                    await this.inspectContainer(
                        containerNameOrId,
                    );

                if (
                    details.State
                        .Running
                ) {
                    return;
                }
            } catch {
                // The container may still
                // be starting.
            }

            await this.sleep(
                delayMs,
            );
        }

        throw new Error(
            `Container ${containerNameOrId} did not start`,
        );
    }

    async waitForCkbRpc(
        containerNameOrId: string,
        attempts = 90,
        delayMs = 1_000,
    ): Promise<void> {
        this.logger.log(
            `Waiting for CKB RPC in container ${containerNameOrId}`,
        );

        for (
            let attempt = 1;
            attempt <= attempts;
            attempt++
        ) {
            try {
                const result =
                    await this.executeCommand(
                        {
                            containerId:
                                containerNameOrId,

                            command: [
                                'sh',
                                '-c',
                                [
                                    'curl --fail --silent --show-error',
                                    '-X POST',
                                    '-H "Content-Type: application/json"',
                                    `--data '{"id":1,"jsonrpc":"2.0","method":"get_tip_block_number","params":[]}'`,
                                    'http://127.0.0.1:8114',
                                ].join(
                                    ' ',
                                ),
                            ],

                            workingDirectory:
                                '/',
                        },
                    );

                if (
                    result.exitCode ===
                        0 &&
                    result.stdout.includes(
                        '"result"',
                    )
                ) {
                    this.logger.log(
                        'CKB RPC is ready',
                    );

                    return;
                }
            } catch {
                // CKB may still be booting.
            }

            if (
                attempt % 10 ===
                0
            ) {
                this.logger.log(
                    `CKB RPC is not ready yet. Attempt ${attempt}/${attempts}`,
                );
            }

            await this.sleep(
                delayMs,
            );
        }

        throw new Error(
            'CKB node failed to become ready',
        );
    }

    async listWorkspaceContainers(
        workspaceId: string,
    ): Promise<
        Docker.ContainerInfo[]
    > {
        return this.docker.listContainers(
            {
                all: true,

                filters: {
                    label: [
                        `fiberdev.workspace-id=${workspaceId}`,
                    ],
                },
            },
        );
    }

    async getContainerLogs(
        containerNameOrId: string,
        tail = 200,
    ): Promise<string> {
        const container =
            this.docker.getContainer(
                containerNameOrId,
            );

        const logs =
            await container.logs({
                stdout: true,
                stderr: true,

                timestamps: true,
                tail,
            });

        return Buffer.isBuffer(
            logs,
        )
            ? logs.toString('utf8')
            : String(logs);
    }

    private async sleep(
        milliseconds: number,
    ): Promise<void> {
        await new Promise<void>(
            (resolve) => {
                setTimeout(
                    resolve,
                    milliseconds,
                );
            },
        );
    }
}