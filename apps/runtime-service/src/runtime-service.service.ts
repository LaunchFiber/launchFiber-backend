// apps/runtime-service/src/runtime-service.service.ts
import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DockerService } from './docker.service';
import { PrismaService } from 'libs/prisma/src/prisma.service';
import {
  DeleteWorkspacePayload,
  StartWorkspacePayload,
  StopWorkspacePayload,
} from './runtime.types';

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
    const dockerAvailable = await this.docker.ping();

    return {
      status: dockerAvailable ? 'ok' : 'unavailable',
      service: 'runtime-service',
      docker: dockerAvailable,
      timestamp: new Date().toISOString(),
    };
  }

  async startWorkspace(payload: StartWorkspacePayload) {
    const workspace = await this.findOwnedWorkspace(
      payload.workspaceId,
      payload.userId,
    );

    const workspaceName = this.safeName(workspace.id);
    const networkName = `fiberdev-${workspaceName}-network`;
    const volumeName = `fiberdev-${workspaceName}-volume`;

    await this.prisma.workspace.update({
      where: {
        id: workspace.id,
      },
      data: {
        status: 'PROVISIONING',
      },
    });

    try {
      await this.docker.createNetwork(networkName);
      await this.docker.createVolume(volumeName);

      const definitions = [
        {
          type: 'IDE',
          name: `fiberdev-${workspaceName}-ide`,
          image:
            process.env.IDE_CONTAINER_IMAGE ||
            'codercom/code-server:latest',
          exposedPort: '8080/tcp',
          command: [
            '--bind-addr',
            '0.0.0.0:8080',
            '--auth',
            'none',
            '/workspace',
          ],
        },
        {
          type: 'FIBER_RUNTIME',
          name: `fiberdev-${workspaceName}-runtime`,
          image:
            process.env.FIBER_RUNTIME_IMAGE ||
            'rust:1.82-bookworm',
          command: [
            'sh',
            '-c',
            'while true; do sleep 3600; done',
          ],
        },
        {
          type: 'PREVIEW',
          name: `fiberdev-${workspaceName}-preview`,
          image:
            process.env.PREVIEW_CONTAINER_IMAGE ||
            'node:22-bookworm',
          exposedPort: '3000/tcp',
          command: [
            'sh',
            '-c',
            'while true; do sleep 3600; done',
          ],
        },
        {
          type: 'TEST_RUNNER',
          name: `fiberdev-${workspaceName}-test`,
          image:
            process.env.TEST_RUNNER_IMAGE ||
            'rust:1.82-bookworm',
          command: [
            'sh',
            '-c',
            'while true; do sleep 3600; done',
          ],
        },
      ];

      const createdContainers: any[] = [];

      for (const definition of definitions) {
        const container =
          await this.docker.createContainer({
            name: definition.name,
            image: definition.image,
            networkName,
            volumeName,
            workspaceId: workspace.id,
            containerType: definition.type,
            command: definition.command,
            exposedPort: definition.exposedPort,
            environment: [
              `WORKSPACE_ID=${workspace.id}`,
              `USER_ID=${workspace.userId}`,
            ],
          });

        const inspectedBeforeStart = await container.inspect();
        const realContainerId = inspectedBeforeStart.Id;

        await this.docker.startContainer(realContainerId);

        const inspected =
          await this.docker.inspectContainer(realContainerId);

        const hostPort = definition.exposedPort
          ? inspected.NetworkSettings.Ports?.[
            definition.exposedPort
          ]?.[0]?.HostPort
          : undefined;

        const containerType = definition.type as
          | 'IDE'
          | 'FIBER_RUNTIME'
          | 'PREVIEW'
          | 'TEST_RUNNER';

        const runtimeContainer =
          await this.prisma.workspaceContainer.upsert({
            where: {
              workspaceId_type: {
                workspaceId: workspace.id,
                type: containerType,
              },
            },

            update: {
              containerId: realContainerId,
              name: definition.name,
              image: definition.image,
              status: 'RUNNING',

              internalPort: definition.exposedPort
                ? Number(definition.exposedPort.split('/')[0])
                : null,

              hostPort: hostPort
                ? Number(hostPort)
                : null,
            },

            create: {
              workspaceId: workspace.id,
              containerId: realContainerId,
              name: definition.name,
              type: containerType,
              image: definition.image,
              status: 'RUNNING',

              internalPort: definition.exposedPort
                ? Number(definition.exposedPort.split('/')[0])
                : null,

              hostPort: hostPort
                ? Number(hostPort)
                : null,
            },
          });

        createdContainers.push(runtimeContainer);
      }

      const updatedWorkspace =
        await this.prisma.workspace.update({
          where: {
            id: workspace.id,
          },
          data: {
            status: 'RUNNING',
            runtimeNetwork: networkName,
            runtimeVolume: volumeName,
            lastStartedAt: new Date(),
          },
        });

      return {
        message: 'Workspace runtime started',
        workspace: updatedWorkspace,
        containers: createdContainers,
      };
    } catch (error) {
      this.logger.error(
        `Failed to provision workspace ${workspace.id}`,
        error,
      );

      await this.prisma.workspace.update({
        where: {
          id: workspace.id,
        },
        data: {
          status: 'FAILED',
        },
      });

      throw error;
    }
  }

  async stopWorkspace(payload: StopWorkspacePayload) {
    const workspace = await this.findOwnedWorkspace(
      payload.workspaceId,
      payload.userId,
    );

    const containers =
      await this.prisma.workspaceContainer.findMany({
        where: {
          workspaceId: workspace.id,
        },
      });

    for (const container of containers) {
      await this.docker.stopContainer(
        container.containerId,
      );

      await this.prisma.workspaceContainer.update({
        where: {
          id: container.id,
        },
        data: {
          status: 'STOPPED',
        },
      });
    }

    const updatedWorkspace =
      await this.prisma.workspace.update({
        where: {
          id: workspace.id,
        },
        data: {
          status: 'STOPPED',
          lastStoppedAt: new Date(),
        },
      });

    return {
      message: 'Workspace runtime stopped',
      workspace: updatedWorkspace,
    };
  }

  async getWorkspaceStatus(
    workspaceId: string,
    userId: string,
  ) {
    const workspace = await this.findOwnedWorkspace(
      workspaceId,
      userId,
    );

    const containers =
      await this.prisma.workspaceContainer.findMany({
        where: {
          workspaceId,
        },
        orderBy: {
          createdAt: 'asc',
        },
      });

    const statuses: any = [];

    for (const container of containers) {
      try {
        const details =
          await this.docker.inspectContainer(
            container.containerId,
          );

        statuses.push({
          id: container.id,
          type: container.type,
          name: container.name,
          containerId: container.containerId,
          running: details.State.Running,
          dockerStatus: details.State.Status,
          hostPort: container.hostPort,
          internalPort: container.internalPort,
        });
      } catch {
        statuses.push({
          id: container.id,
          type: container.type,
          name: container.name,
          containerId: container.containerId,
          running: false,
          dockerStatus: 'missing',
          hostPort: container.hostPort,
          internalPort: container.internalPort,
        });
      }
    }

    return {
      workspace,
      containers: statuses,
    };
  }

  async deleteWorkspace(
    payload: DeleteWorkspacePayload,
  ) {
    const workspace = await this.findOwnedWorkspace(
      payload.workspaceId,
      payload.userId,
    );

    const containers =
      await this.prisma.workspaceContainer.findMany({
        where: {
          workspaceId: workspace.id,
        },
      });

    for (const container of containers) {
      await this.docker.removeContainer(
        container.containerId,
      );
    }

    if (workspace.runtimeNetwork) {
      await this.docker.removeNetwork(
        workspace.runtimeNetwork,
      );
    }

    if (workspace.runtimeVolume) {
      await this.docker.removeVolume(
        workspace.runtimeVolume,
      );
    }

    await this.prisma.workspaceContainer.deleteMany({
      where: {
        workspaceId: workspace.id,
      },
    });

    const deletedWorkspace =
      await this.prisma.workspace.update({
        where: {
          id: workspace.id,
        },
        data: {
          status: 'DELETED',
          runtimeNetwork: null,
          runtimeVolume: null,
        },
      });

    return {
      message: 'Workspace runtime deleted',
      workspace: deletedWorkspace,
    };
  }

  private async findOwnedWorkspace(
    workspaceId: string,
    userId: string,
  ) {
    const workspace =
      await this.prisma.workspace.findUnique({
        where: {
          id: workspaceId,
        },
      });

    if (!workspace || workspace.status === 'DELETED') {
      throw new NotFoundException(
        'Workspace not found',
      );
    }

    if (workspace.userId !== userId) {
      throw new ForbiddenException(
        'You do not own this workspace',
      );
    }

    return workspace;
  }

  private safeName(value: string) {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 20);
  }
}