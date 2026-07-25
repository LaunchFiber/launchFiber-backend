// apps/runtime-service/src/runtime-service.service.ts

import {
    BadRequestException,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';

import {
    RuntimeContainerStatus,
    RuntimeContainerType,
    WorkspaceStatus,
} from 'src/generated/prisma/enums';

import { PrismaService } from 'libs/prisma/src/prisma.service';

import { DockerService } from './docker/docker.service';

import type {
    DeleteWorkspacePayload,
    StartWorkspacePayload,
    StopWorkspacePayload,
    WorkspaceStatusPayload,
} from './runtime.types';

interface InitializeProjectOptions {
    runtimeContainerId: string;
    projectName: string;
    contractName: string;
}

@Injectable()
export class RuntimeServiceService {
    private readonly logger = new Logger(
        RuntimeServiceService.name,
    );

    constructor(
        private readonly prisma: PrismaService,
        private readonly docker: DockerService,
    ) { }

    async health() {
        await this.docker.ping();

        return {
            service: 'runtime-service',
            status: 'ok',
            timestamp: new Date().toISOString(),
        };
    }

    async startWorkspace(
        input: StartWorkspacePayload,
    ) {
        const workspace = await this.getWorkspace(
            input.workspaceId,
            input.userId,
        );

        if (
            workspace.status === WorkspaceStatus.DELETED
        ) {
            throw new RpcException(
                'Deleted workspace cannot be started',
            );
        }

        if (
            workspace.status === WorkspaceStatus.RUNNING
        ) {
            return this.getWorkspaceRuntime(
                workspace.id,
                workspace.userId,
            );
        }

        await this.prisma.workspace.update({
            where: {
                id: workspace.id,
            },

            data: {
                status: WorkspaceStatus.PROVISIONING,
            },
        });

        const safeWorkspaceId = this.safeName(
            workspace.id,
        );

        const networkName =
            workspace.runtimeNetwork ??
            `fiberdev-${safeWorkspaceId}-network`;

        const workspaceVolume =
            workspace.runtimeVolume ??
            `fiberdev-${safeWorkspaceId}-workspace`;

        const ckbDataVolume =
            workspace.ckbDataVolume ??
            `fiberdev-${safeWorkspaceId}-ckb-data`;

        const ckbContainerName =
            `fiberdev-${safeWorkspaceId}-ckb`;

        const runtimeContainerName =
            `fiberdev-${safeWorkspaceId}-runtime`;

        try {
            await this.docker.createNetwork(
                networkName,
            );

            await this.docker.createVolume(
                workspaceVolume,
            );

            await this.docker.createVolume(
                ckbDataVolume,
            );

            await this.prisma.workspace.update({
                where: {
                    id: workspace.id,
                },

                data: {
                    runtimeNetwork: networkName,
                    runtimeVolume: workspaceVolume,
                    ckbDataVolume,
                },
            });

            const ckbContainer =
                await this.createCkbContainer({
                    workspaceId: workspace.id,
                    networkName,
                    ckbDataVolume,
                    containerName: ckbContainerName,
                });

            await this.setContainerStatus(
                workspace.id,
                RuntimeContainerType.CKB_NODE,
                RuntimeContainerStatus.STARTING,
            );

            await this.docker.startContainer(
                ckbContainer.id,
            );

            await this.docker.waitForContainer(
                ckbContainer.id,
            );

            await this.docker.waitForCkbRpc(
                ckbContainer.id,
            );

            await this.saveContainerRecord({
                workspaceId: workspace.id,
                containerId: ckbContainer.id,
                name: ckbContainerName,
                image: this.ckbNodeImage,
                type: RuntimeContainerType.CKB_NODE,
                status:
                    RuntimeContainerStatus.RUNNING,
                internalPort: 8114,
            });

            const runtimeContainer =
                await this.createRuntimeContainer({
                    workspaceId: workspace.id,
                    userId: workspace.userId,
                    networkName,
                    workspaceVolume,
                    containerName: runtimeContainerName,
                    ckbContainerName,
                });

            await this.setContainerStatus(
                workspace.id,
                RuntimeContainerType.FIBER_RUNTIME,
                RuntimeContainerStatus.STARTING,
            );

            await this.docker.startContainer(
                runtimeContainer.id,
            );

            await this.docker.waitForContainer(
                runtimeContainer.id,
            );

            await this.saveContainerRecord({
                workspaceId: workspace.id,
                containerId: runtimeContainer.id,
                name: runtimeContainerName,
                image: this.runtimeImage,
                type:
                    RuntimeContainerType.FIBER_RUNTIME,
                status:
                    RuntimeContainerStatus.RUNNING,
            });

            await this.initializeProject({
                runtimeContainerId:
                    runtimeContainer.id,
                projectName:
                    this.defaultProjectName,
                contractName:
                    this.defaultContractName,
            });

            const updatedWorkspace =
                await this.prisma.workspace.update({
                    where: {
                        id: workspace.id,
                    },

                    data: {
                        status: WorkspaceStatus.RUNNING,
                        runtimeNetwork: networkName,
                        runtimeVolume: workspaceVolume,
                        ckbDataVolume,
                        lastStartedAt: new Date(),
                    },

                    include: {
                        containers: true,
                    },
                });

            this.logger.log(
                `Workspace ${workspace.id} started successfully`,
            );

            return updatedWorkspace;
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Workspace provisioning failed';

            this.logger.error(
                `Failed to start workspace ${workspace.id}: ${message}`,
            );

            await this.prisma.workspace.update({
                where: {
                    id: workspace.id,
                },

                data: {
                    status: WorkspaceStatus.FAILED,
                },
            });

            await this.markFailedContainers(
                workspace.id,
            );

            throw error;
        }
    }

    async stopWorkspace(
        payload: StopWorkspacePayload,
    ) {
        const workspace = await this.getWorkspace(
            payload.workspaceId,
            payload.userId,
        );

        const containers =
            await this.prisma.workspaceContainer.findMany(
                {
                    where: {
                        workspaceId: workspace.id,
                    },

                    orderBy: {
                        createdAt: 'desc',
                    },
                },
            );

        for (const container of containers) {
            try {
                await this.docker.stopContainer(
                    container.containerId,
                );

                await this.prisma.workspaceContainer.update(
                    {
                        where: {
                            id: container.id,
                        },

                        data: {
                            status:
                                RuntimeContainerStatus.STOPPED,
                        },
                    },
                );
            } catch (error) {
                const message =
                    error instanceof Error
                        ? error.message
                        : 'Unknown error';

                this.logger.warn(
                    `Failed to stop container ${container.name}: ${message}`,
                );

                await this.prisma.workspaceContainer.update(
                    {
                        where: {
                            id: container.id,
                        },

                        data: {
                            status:
                                RuntimeContainerStatus.FAILED,
                        },
                    },
                );
            }
        }

        const updatedWorkspace =
            await this.prisma.workspace.update({
                where: {
                    id: workspace.id,
                },

                data: {
                    status: WorkspaceStatus.STOPPED,
                    lastStoppedAt: new Date(),
                },

                include: {
                    containers: true,
                },
            });

        this.logger.log(
            `Workspace ${workspace.id} stopped`,
        );

        return updatedWorkspace;
    }

    async getWorkspaceStatus(
        payload: WorkspaceStatusPayload,
    ) {
        const workspace = await this.getWorkspace(
            payload.workspaceId,
            payload.userId,
        );

        const databaseContainers =
            await this.prisma.workspaceContainer.findMany(
                {
                    where: {
                        workspaceId: workspace.id,
                    },

                    orderBy: {
                        createdAt: 'asc',
                    },
                },
            );

        const dockerContainers =
            await this.docker.listWorkspaceContainers(
                workspace.id,
            );

        const dockerStateById = new Map(
            dockerContainers.map((container) => [
                container.Id,
                {
                    state: container.State,
                    status: container.Status,
                },
            ]),
        );

        return {
            workspaceId: workspace.id,
            name: workspace.name,
            status: workspace.status,

            runtimeNetwork:
                workspace.runtimeNetwork,

            runtimeVolume:
                workspace.runtimeVolume,

            ckbDataVolume:
                workspace.ckbDataVolume,

            lastStartedAt:
                workspace.lastStartedAt,

            lastStoppedAt:
                workspace.lastStoppedAt,

            containers: databaseContainers.map(
                (container) => {
                    const dockerState =
                        dockerStateById.get(
                            container.containerId,
                        );

                    return {
                        id: container.id,

                        containerId:
                            container.containerId,

                        name: container.name,
                        image: container.image,
                        type: container.type,
                        status: container.status,

                        dockerState:
                            dockerState?.state ?? 'missing',

                        dockerStatus:
                            dockerState?.status ??
                            'Container not found',

                        internalPort:
                            container.internalPort,

                        hostPort: container.hostPort,
                    };
                },
            ),
        };
    }

    async deleteWorkspace(
        payload: DeleteWorkspacePayload,
    ) {
        return this.deleteWorkspaceRuntime(
            payload.workspaceId,
            payload.userId,
            payload.deleteWorkspaceFiles ?? true,
            payload.deleteCkbData ?? true,
        );
    }

    async deleteWorkspaceRuntime(
        workspaceId: string,
        userId?: string,
        deleteWorkspaceFiles = true,
        deleteCkbData = true,
    ) {
        const workspace = await this.getWorkspace(
            workspaceId,
            userId,
        );

        const containers =
            await this.prisma.workspaceContainer.findMany(
                {
                    where: {
                        workspaceId: workspace.id,
                    },
                },
            );

        for (const container of containers) {
            try {
                await this.docker.removeContainer(
                    container.containerId,
                );
            } catch (error) {
                const message =
                    error instanceof Error
                        ? error.message
                        : 'Unknown error';

                this.logger.warn(
                    `Failed to remove container ${container.name}: ${message}`,
                );
            }
        }

        await this.prisma.workspaceContainer.deleteMany(
            {
                where: {
                    workspaceId: workspace.id,
                },
            },
        );

        if (workspace.runtimeNetwork) {
            await this.docker.removeNetwork(
                workspace.runtimeNetwork,
            );
        }

        if (
            deleteWorkspaceFiles &&
            workspace.runtimeVolume
        ) {
            await this.docker.removeVolume(
                workspace.runtimeVolume,
            );
        }

        if (
            deleteCkbData &&
            workspace.ckbDataVolume
        ) {
            await this.docker.removeVolume(
                workspace.ckbDataVolume,
            );
        }

        const updatedWorkspace =
            await this.prisma.workspace.update({
                where: {
                    id: workspace.id,
                },

                data: {
                    status: WorkspaceStatus.DELETED,

                    runtimeNetwork: null,

                    runtimeVolume:
                        deleteWorkspaceFiles
                            ? null
                            : workspace.runtimeVolume,

                    ckbDataVolume:
                        deleteCkbData
                            ? null
                            : workspace.ckbDataVolume,

                    lastStoppedAt: new Date(),
                },
            });

        this.logger.log(
            `Workspace runtime ${workspace.id} deleted`,
        );

        return updatedWorkspace;
    }

    async resetWorkspace(
        workspaceId: string,
        userId?: string,
    ) {
        const workspace = await this.getWorkspace(
            workspaceId,
            userId,
        );

        await this.deleteWorkspaceRuntime(
            workspace.id,
            userId,
            true,
            true,
        );

        await this.prisma.workspace.update({
            where: {
                id: workspace.id,
            },

            data: {
                status: WorkspaceStatus.PENDING,
                runtimeNetwork: null,
                runtimeVolume: null,
                ckbDataVolume: null,
            },
        });

        return this.startWorkspace({
            workspaceId: workspace.id,
            userId: workspace.userId,
        });
    }

    async getWorkspaceRuntime(
        workspaceId: string,
        userId?: string,
    ) {
        const workspace = await this.getWorkspace(
            workspaceId,
            userId,
        );

        return this.prisma.workspace.findUnique({
            where: {
                id: workspace.id,
            },

            include: {
                containers: true,
            },
        });
    }

    async executeRuntimeCommand(
        workspaceId: string,
        command: string[],
        workingDirectory?: string,
        userId?: string,
    ) {
        const workspace = await this.getWorkspace(
            workspaceId,
            userId,
        );

        if (
            workspace.status !==
            WorkspaceStatus.RUNNING
        ) {
            throw new RpcException(
                'Workspace runtime is not running',
            );
        }

        const runtimeContainer =
            await this.prisma.workspaceContainer.findUnique(
                {
                    where: {
                        workspaceId_type: {
                            workspaceId: workspace.id,
                            type:
                                RuntimeContainerType.FIBER_RUNTIME,
                        },
                    },
                },
            );

        if (!runtimeContainer) {
            throw new RpcException(
                'Runtime container not found',
            );
        }

        return this.docker.executeCommand({
            containerId:
                runtimeContainer.containerId,

            command,

            workingDirectory:
                workingDirectory ??
                `/workspace/${this.defaultProjectName}`,
        });
    }

    async buildProject(
        workspaceId: string,
        userId?: string,
    ) {
        return this.executeRuntimeCommand(
            workspaceId,
            ['make', 'build'],
            `/workspace/${this.defaultProjectName}`,
            userId,
        );
    }

    async testProject(
        workspaceId: string,
        userId?: string,
    ) {
        return this.executeRuntimeCommand(
            workspaceId,
            ['make', 'test'],
            `/workspace/${this.defaultProjectName}`,
            userId,
        );
    }

    async runDefaultContract(
        workspaceId: string,
        userId?: string,
    ) {
        return this.executeRuntimeCommand(
            workspaceId,
            [
                'ckb-debugger',
                '--bin',
                `build/release/${this.defaultContractName}`,
            ],
            `/workspace/${this.defaultProjectName}`,
            userId,
        );
    }

    private async createCkbContainer(
        options: {
            workspaceId: string;
            networkName: string;
            ckbDataVolume: string;
            containerName: string;
        },
    ) {
        const existing =
            await this.docker.getContainer(
                options.containerName,
            );

        if (existing) {
            const details =
                await existing.inspect();

            await this.saveContainerRecord({
                workspaceId: options.workspaceId,
                containerId: details.Id,
                name: options.containerName,
                image: this.ckbNodeImage,

                type:
                    RuntimeContainerType.CKB_NODE,

                status: details.State.Running
                    ? RuntimeContainerStatus.RUNNING
                    : RuntimeContainerStatus.CREATED,

                internalPort: 8114,
            });

            return existing;
        }

        const container =
            await this.docker.createContainer({
                name: options.containerName,
                image: this.ckbNodeImage,

                networkName:
                    options.networkName,

                workspaceId:
                    options.workspaceId,

                containerType:
                    RuntimeContainerType.CKB_NODE,

                exposedPorts: [
                    '8114/tcp',
                    '28114/tcp',
                ],

                binds: [
                    `${options.ckbDataVolume}:/ckb-data`,
                ],

                environment: [
                    `WORKSPACE_ID=${options.workspaceId}`,
                    'HOME=/ckb-data',
                ],

                memory:
                    Number(
                        process.env
                            .CKB_NODE_MEMORY_BYTES,
                    ) ||
                    1024 * 1024 * 1024,

                nanoCpus:
                    Number(
                        process.env
                            .CKB_NODE_NANO_CPUS,
                    ) ||
                    1_000_000_000,
            });

        await this.saveContainerRecord({
            workspaceId: options.workspaceId,
            containerId: container.id,
            name: options.containerName,
            image: this.ckbNodeImage,

            type:
                RuntimeContainerType.CKB_NODE,

            status:
                RuntimeContainerStatus.CREATED,

            internalPort: 8114,
        });

        return container;
    }

    private async createRuntimeContainer(
        options: {
            workspaceId: string;
            userId: string;
            networkName: string;
            workspaceVolume: string;
            containerName: string;
            ckbContainerName: string;
        },
    ) {
        const existing =
            await this.docker.getContainer(
                options.containerName,
            );

        if (existing) {
            const details =
                await existing.inspect();

            await this.saveContainerRecord({
                workspaceId: options.workspaceId,
                containerId: details.Id,
                name: options.containerName,
                image: this.runtimeImage,

                type:
                    RuntimeContainerType.FIBER_RUNTIME,

                status: details.State.Running
                    ? RuntimeContainerStatus.RUNNING
                    : RuntimeContainerStatus.CREATED,
            });

            return existing;
        }

        const container =
            await this.docker.createContainer({
                name: options.containerName,
                image: this.runtimeImage,

                networkName:
                    options.networkName,

                workspaceId:
                    options.workspaceId,

                containerType:
                    RuntimeContainerType.FIBER_RUNTIME,

                command: [
                    'sh',
                    '-c',
                    'while true; do sleep 3600; done',
                ],

                workingDirectory: '/workspace',

                binds: [
                    `${options.workspaceVolume}:/workspace`,
                ],

                environment: [
                    `WORKSPACE_ID=${options.workspaceId}`,
                    `USER_ID=${options.userId}`,

                    `CKB_RPC_URL=http://${options.ckbContainerName}:8114`,

                    `CKB_PROXY_RPC_URL=http://${options.ckbContainerName}:28114`,

                    'CARGO_TERM_COLOR=always',
                    'RUST_BACKTRACE=1',
                ],

                memory:
                    Number(
                        process.env
                            .RUNTIME_MEMORY_BYTES,
                    ) ||
                    2 * 1024 * 1024 * 1024,

                nanoCpus:
                    Number(
                        process.env
                            .RUNTIME_NANO_CPUS,
                    ) ||
                    2_000_000_000,

                pidsLimit: 1024,
            });

        await this.saveContainerRecord({
            workspaceId: options.workspaceId,
            containerId: container.id,
            name: options.containerName,
            image: this.runtimeImage,

            type:
                RuntimeContainerType.FIBER_RUNTIME,

            status:
                RuntimeContainerStatus.CREATED,
        });

        return container;
    }

    private async initializeProject(
        options: InitializeProjectOptions,
    ): Promise<void> {
        const projectDirectory =
            `/workspace/${options.projectName}`;

        const markerFile =
            `${projectDirectory}/.fiberdev-initialized`;

        const checkMarker =
            await this.docker.executeCommand({
                containerId:
                    options.runtimeContainerId,

                command: [
                    'test',
                    '-f',
                    markerFile,
                ],

                workingDirectory: '/workspace',
            });

        if (checkMarker.exitCode === 0) {
            this.logger.log(
                `Workspace project ${options.projectName} is already initialized`,
            );

            return;
        }

        const checkProjectDirectory =
            await this.docker.executeCommand({
                containerId:
                    options.runtimeContainerId,

                command: [
                    'test',
                    '-d',
                    projectDirectory,
                ],

                workingDirectory: '/workspace',
            });

        if (
            checkProjectDirectory.exitCode !== 0
        ) {
            this.logger.log(
                `Generating CKB project: ${options.projectName}`,
            );

            const generateProject =
                await this.docker.executeCommand({
                    containerId:
                        options.runtimeContainerId,

                    command: [
                        'cargo',
                        'generate',
                        'gh:cryptape/ckb-script-templates',
                        'workspace',
                        '--name',
                        options.projectName,
                    ],

                    workingDirectory: '/workspace',

                    environment: [
                        'CARGO_TERM_COLOR=always',
                    ],
                });

            if (
                generateProject.exitCode !== 0
            ) {
                throw new RpcException(
                    [
                        'CKB project generation failed.',
                        generateProject.stderr,
                        generateProject.stdout,
                    ]
                        .filter(Boolean)
                        .join('\n'),
                );
            }
        }

        const contractDirectory =
            `${projectDirectory}/contracts/${options.contractName}`;

        const contractExists =
            await this.docker.executeCommand({
                containerId:
                    options.runtimeContainerId,

                command: [
                    'test',
                    '-d',
                    contractDirectory,
                ],

                workingDirectory:
                    projectDirectory,
            });

        if (contractExists.exitCode !== 0) {
            this.logger.log(
                `Generating initial contract: ${options.contractName}`,
            );

            const generateContract =
                await this.docker.executeCommand({
                    containerId:
                        options.runtimeContainerId,

                    command: [
                        'make',
                        'generate',
                        `CRATE=${options.contractName}`,
                    ],

                    workingDirectory:
                        projectDirectory,

                    environment: [
                        'CARGO_TERM_COLOR=always',
                    ],
                });

            if (
                generateContract.exitCode !== 0
            ) {
                throw new RpcException(
                    [
                        'CKB contract generation failed.',
                        generateContract.stderr,
                        generateContract.stdout,
                    ]
                        .filter(Boolean)
                        .join('\n'),
                );
            }
        }

        const createMarker =
            await this.docker.executeCommand({
                containerId:
                    options.runtimeContainerId,

                command: [
                    'touch',
                    markerFile,
                ],

                workingDirectory:
                    projectDirectory,
            });

        if (createMarker.exitCode !== 0) {
            throw new RpcException(
                `Unable to create project initialization marker: ${createMarker.stderr}`,
            );
        }

        this.logger.log(
            `Workspace project initialized: ${projectDirectory}`,
        );
    }

    private async saveContainerRecord(
        input: {
            workspaceId: string;
            containerId: string;
            name: string;
            image: string;
            type: RuntimeContainerType;
            status: RuntimeContainerStatus;
            internalPort?: number;
        },
    ) {
        let hostPort: number | null = null;

        if (input.internalPort) {
            try {
                const port =
                    await this.docker.getContainerPort(
                        input.containerId,
                        input.internalPort,
                    );

                hostPort = port.hostPort;
            } catch {
                hostPort = null;
            }
        }

        return this.prisma.workspaceContainer.upsert(
            {
                where: {
                    workspaceId_type: {
                        workspaceId:
                            input.workspaceId,

                        type: input.type,
                    },
                },

                update: {
                    containerId:
                        input.containerId,

                    name: input.name,
                    image: input.image,
                    status: input.status,

                    internalPort:
                        input.internalPort ?? null,

                    hostPort,
                },

                create: {
                    workspaceId:
                        input.workspaceId,

                    containerId:
                        input.containerId,

                    name: input.name,
                    image: input.image,
                    type: input.type,
                    status: input.status,

                    internalPort:
                        input.internalPort ?? null,

                    hostPort,
                },
            },
        );
    }

    private async setContainerStatus(
        workspaceId: string,
        type: RuntimeContainerType,
        status: RuntimeContainerStatus,
    ): Promise<void> {
        await this.prisma.workspaceContainer.updateMany(
            {
                where: {
                    workspaceId,
                    type,
                },

                data: {
                    status,
                },
            },
        );
    }

    private async markFailedContainers(
        workspaceId: string,
    ): Promise<void> {
        await this.prisma.workspaceContainer.updateMany(
            {
                where: {
                    workspaceId,

                    status: {
                        in: [
                            RuntimeContainerStatus.CREATED,
                            RuntimeContainerStatus.STARTING,
                        ],
                    },
                },

                data: {
                    status:
                        RuntimeContainerStatus.FAILED,
                },
            },
        );
    }

    private async getWorkspace(
        workspaceId: string,
        userId?: string,
    ) {
        const workspace =
            await this.prisma.workspace.findFirst({
                where: {
                    id: workspaceId,

                    ...(userId
                        ? {
                            userId,
                        }
                        : {}),
                },

                include: {
                    containers: true,
                },
            });

        if (!workspace) {
            throw new RpcException(
                'Workspace not found',
            );
        }

        return workspace;
    }

    private safeName(
        value: string,
    ): string {
        return value
            .toLowerCase()
            .replace(/[^a-z0-9_.-]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^[-_.]+|[-_.]+$/g, '')
            .slice(0, 48);
    }

    private get ckbNodeImage(): string {
        return (
            process.env.CKB_NODE_IMAGE ??
            'fiberdev/ckb-node:dev'
        );
    }

    private get runtimeImage(): string {
        return (
            process.env.FIBER_RUNTIME_IMAGE ??
            'fiberdev/ckb-runtime:dev'
        );
    }

    private get defaultProjectName(): string {
        return (
            process.env.DEFAULT_PROJECT_NAME ??
            'ckb-rust-script'
        );
    }

    private get defaultContractName(): string {
        return (
            process.env.DEFAULT_CONTRACT_NAME ??
            'hello-world'
        );
    }
}