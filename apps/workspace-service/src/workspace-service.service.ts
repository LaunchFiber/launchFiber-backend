import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { PrismaService } from 'libs/prisma/src/prisma.service';

@Injectable()
export class WorkspaceService {
    constructor(private readonly prisma: PrismaService) { }

    async create(data: {
        userId: string;
        name: string;
        templateId?: string;
    }) {
        return this.prisma.workspace.create({
            data: {
                name: data.name,
                userId: data.userId,
                templateId: data.templateId,
                status: 'PENDING',
            }
        })
    }

    async findMine(userId: string) {
        return this.prisma.workspace.findMany({
            where: {
                userId,
                status: {
                    not: 'DELETED',
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
    }

    async findOne(userId: string, workspaceId: string) {
        const workspace = await this.prisma.workspace.findUnique({
            where: {
                id: workspaceId,
            },
        });

        if (!workspace || workspace.status === 'DELETED') {
            throw new RpcException('Workspace not found');
        }

        if (workspace.userId !== userId) {
            throw new RpcException('You do not own this workspace');
        }

        return workspace;
    }

    async start(userId: string, workspaceId: string) {
        await this.findOne(userId, workspaceId);

        return this.prisma.workspace.update({
            where: {
                id: workspaceId,
            },
            data: {
                status: 'PROVISIONING',
            },
        });
    }

    async stop(userId: string, workspaceId: string) {
        await this.findOne(userId, workspaceId);

        return this.prisma.workspace.update({
            where: {
                id: workspaceId,
            },
            data: {
                status: 'STOPPED',
            },
        });
    }

    async delete(userId: string, workspaceId: string) {
        await this.findOne(userId, workspaceId);

        return this.prisma.workspace.update({
            where: {
                id: workspaceId,
            },
            data: {
                status: 'DELETED',
            },
        });
    }
}
