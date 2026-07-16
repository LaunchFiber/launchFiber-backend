// apps/runtime-service/src/docker.service.ts
import {
    Injectable,
    InternalServerErrorException,
    Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Docker from 'dockerode';

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

    async createContainer(options: {
        name: string;
        image: string;
        networkName: string;
        volumeName: string;
        workspaceId: string;
        containerType: string;
        command?: string[];
        environment?: string[];
        exposedPort?: string;
    }): Promise<Docker.Container> {
        await this.ensureImage(options.image);

        const exposedPorts = options.exposedPort
            ? {
                [options.exposedPort]: {},
            }
            : undefined;

        const portBindings = options.exposedPort
            ? {
                [options.exposedPort]: [
                    {
                        HostIp: '127.0.0.1',
                        HostPort: '',
                    },
                ],
            }
            : undefined;

        try {
            const existingContainer = this.docker.getContainer(
                options.name,
            );

            const details = await existingContainer.inspect();

            // Return a new handle using the real Docker ID.
            return this.docker.getContainer(details.Id);
        } catch {
            this.logger.log(
                `Creating ${options.containerType} container ${options.name}`,
            );
        }

        const createdContainer = await this.docker.createContainer({
            name: options.name,
            Image: options.image,
            Cmd: options.command,
            Env: options.environment,
            WorkingDir: '/workspace',

            ExposedPorts: exposedPorts,

            Labels: {
                'fiberdev.managed': 'true',
                'fiberdev.workspace-id': options.workspaceId,
                'fiberdev.container-type': options.containerType,
            },

            HostConfig: {
                AutoRemove: false,
                NetworkMode: options.networkName,

                Binds: [`${options.volumeName}:/workspace`],

                PortBindings: portBindings,

                Memory:
                    Number(
                        this.config.get<string>(
                            'WORKSPACE_CONTAINER_MEMORY',
                        ),
                    ) || 268435456,

                NanoCpus:
                    Number(
                        this.config.get<string>(
                            'WORKSPACE_CONTAINER_CPUS',
                        ),
                    ) || 500000000,

                PidsLimit: 256,
                SecurityOpt: ['no-new-privileges:true'],
                CapDrop: ['ALL'],
            },
        });

        const details = await createdContainer.inspect();

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
}