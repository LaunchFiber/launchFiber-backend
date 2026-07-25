// apps/file-service/src/file-service.service.ts
import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Injectable,
    InternalServerErrorException,
    NotFoundException,
} from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { PrismaService } from '../../../libs/prisma/src/prisma.service';
import { DockerService } from './docker.service';
import {
    CreateDirectoryPayload,
    FilePathPayload,
    RenameFilePayload,
    WorkspaceEntry,
    WorkspacePayload,
    WriteFilePayload,
} from './file.types';
import {
    normalizeWorkspacePath,
    toContainerPath,
} from './file-path.util';

@Injectable()
export class FileServiceService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly docker: DockerService,
    ) { }

    async listFiles(
        payload: WorkspacePayload,
    ): Promise<WorkspaceEntry[]> {
        const containerId =
            await this.getRuntimeContainer(
                payload.userId,
                payload.workspaceId,
            );

        const result = await this.docker.execute({
            containerId,

            command: [
                'find',
                '/workspace',
                '-mindepth',
                '1',
                '-maxdepth',
                '20',
                '-printf',
                '%y|%s|%P\n',
            ],
        });

        this.assertCommandSucceeded(
            result.exitCode,
            result.stderr,
        );

        return result.stdout
            .split('\n')
            .filter(Boolean)
            .filter((line) => {
                const [, , filePath] =
                    line.split('|');

                return !this.shouldIgnore(filePath);
            })
            .map((line) => {
                const [entryType, size, filePath] =
                    line.split('|');

                const name =
                    filePath.split('/').pop() ||
                    filePath;

                if (entryType === 'd') {
                    return {
                        name,
                        path: filePath,
                        type: 'directory',
                    };
                }

                return {
                    name,
                    path: filePath,
                    type: 'file',
                    size: Number(size) || 0,
                };
            });
    }

    async readFile(
        payload: FilePathPayload,
    ) {
        const containerId =
            await this.getRuntimeContainer(
                payload.userId,
                payload.workspaceId,
            );

        const normalizedPath =
            normalizeWorkspacePath(payload.path);

        const containerPath =
            toContainerPath(normalizedPath);

        const result = await this.docker.execute({
            containerId,
            command: ['cat', '--', containerPath],
        });

        if (result.exitCode !== 0) {
            throw new RpcException(
                `File not found: ${normalizedPath}`,
            );
        }

        return {
            name:
                normalizedPath.split('/').pop() ||
                normalizedPath,

            path: normalizedPath,
            type: 'file' as const,
            content: result.stdout,
            size: Buffer.byteLength(
                result.stdout,
                'utf8',
            ),
        };
    }

    async createFile(
        payload: WriteFilePayload,
    ) {
        const containerId =
            await this.getRuntimeContainer(
                payload.userId,
                payload.workspaceId,
            );

        const normalizedPath =
            normalizeWorkspacePath(payload.path);

        const containerPath =
            toContainerPath(normalizedPath);

        const exists =
            await this.pathExists(
                containerId,
                containerPath,
            );

        if (exists) {
            throw new RpcException(
                `File already exists: ${normalizedPath}`,
            );
        }

        await this.writeContent({
            containerId,
            normalizedPath,
            content: payload.content ?? '',
        });

        return this.readFile(payload);
    }

    async updateFile(
        payload: WriteFilePayload,
    ) {
        const containerId =
            await this.getRuntimeContainer(
                payload.userId,
                payload.workspaceId,
            );

        const normalizedPath =
            normalizeWorkspacePath(payload.path);

        const containerPath =
            toContainerPath(normalizedPath);

        const exists =
            await this.pathExists(
                containerId,
                containerPath,
            );

        if (!exists) {
            throw new RpcException(
                `File not found: ${normalizedPath}`,
            );
        }

        await this.writeContent({
            containerId,
            normalizedPath,
            content: payload.content,
        });

        return this.readFile(payload);
    }

    async createDirectory(
        payload: CreateDirectoryPayload,
    ) {
        const containerId =
            await this.getRuntimeContainer(
                payload.userId,
                payload.workspaceId,
            );

        const normalizedPath =
            normalizeWorkspacePath(payload.path);

        const containerPath =
            toContainerPath(normalizedPath);

        const result = await this.docker.execute({
            containerId,
            command: [
                'mkdir',
                '-p',
                '--',
                containerPath,
            ],
        });

        this.assertCommandSucceeded(
            result.exitCode,
            result.stderr,
        );

        return {
            name:
                normalizedPath.split('/').pop() ||
                normalizedPath,

            path: normalizedPath,
            type: 'directory' as const,
        };
    }

    async deleteEntry(
        payload: FilePathPayload,
    ) {
        const containerId =
            await this.getRuntimeContainer(
                payload.userId,
                payload.workspaceId,
            );

        const normalizedPath =
            normalizeWorkspacePath(payload.path);

        const containerPath =
            toContainerPath(normalizedPath);

        const exists =
            await this.pathExists(
                containerId,
                containerPath,
            );

        if (!exists) {
            throw new RpcException(
                `Path not found: ${normalizedPath}`,
            );
        }

        const result = await this.docker.execute({
            containerId,
            command: [
                'rm',
                '-rf',
                '--',
                containerPath,
            ],
        });

        this.assertCommandSucceeded(
            result.exitCode,
            result.stderr,
        );

        return {
            success: true,
            path: normalizedPath,
        };
    }

    async renameEntry(
        payload: RenameFilePayload,
    ) {
        const containerId =
            await this.getRuntimeContainer(
                payload.userId,
                payload.workspaceId,
            );

        const oldPath = normalizeWorkspacePath(
            payload.oldPath,
        );

        const newPath = normalizeWorkspacePath(
            payload.newPath,
        );

        const oldContainerPath =
            toContainerPath(oldPath);

        const newContainerPath =
            toContainerPath(newPath);

        if (
            !(await this.pathExists(
                containerId,
                oldContainerPath,
            ))
        ) {
            throw new RpcException(
                `Path not found: ${oldPath}`,
            );
        }

        if (
            await this.pathExists(
                containerId,
                newContainerPath,
            )
        ) {
            throw new RpcException(
                `Destination already exists: ${newPath}`,
            );
        }

        const parentDirectory =
            newContainerPath.substring(
                0,
                newContainerPath.lastIndexOf('/'),
            );

        const mkdirResult =
            await this.docker.execute({
                containerId,
                command: [
                    'mkdir',
                    '-p',
                    '--',
                    parentDirectory,
                ],
            });

        this.assertCommandSucceeded(
            mkdirResult.exitCode,
            mkdirResult.stderr,
        );

        const result = await this.docker.execute({
            containerId,
            command: [
                'mv',
                '--',
                oldContainerPath,
                newContainerPath,
            ],
        });

        this.assertCommandSucceeded(
            result.exitCode,
            result.stderr,
        );

        return {
            success: true,
            oldPath,
            newPath,
        };
    }

    private async writeContent(options: {
        containerId: string;
        normalizedPath: string;
        content: string;
    }): Promise<void> {
        const containerPath =
            toContainerPath(
                options.normalizedPath,
            );

        const parentDirectory =
            containerPath.substring(
                0,
                containerPath.lastIndexOf('/'),
            );

        const mkdirResult =
            await this.docker.execute({
                containerId: options.containerId,

                command: [
                    'mkdir',
                    '-p',
                    '--',
                    parentDirectory,
                ],
            });

        this.assertCommandSucceeded(
            mkdirResult.exitCode,
            mkdirResult.stderr,
        );

        const writeResult =
            await this.docker.execute({
                containerId: options.containerId,

                command: [
                    'sh',
                    '-c',
                    'cat > "$1"',
                    'file-writer',
                    containerPath,
                ],

                input: options.content,
            });

        this.assertCommandSucceeded(
            writeResult.exitCode,
            writeResult.stderr,
        );
    }

    private async pathExists(
        containerId: string,
        containerPath: string,
    ): Promise<boolean> {
        const result = await this.docker.execute({
            containerId,

            command: [
                'test',
                '-e',
                containerPath,
            ],
        });

        return result.exitCode === 0;
    }

    private async getRuntimeContainer(
        userId: string,
        workspaceId: string,
    ): Promise<string> {
        const workspace =
            await this.prisma.workspace.findUnique({
                where: {
                    id: workspaceId,
                },
            });

        if (
            !workspace ||
            workspace.status === 'DELETED'
        ) {
            throw new RpcException(
                'Workspace not found',
            );
        }

        if (workspace.userId !== userId) {
            throw new RpcException(
                'You do not own this workspace',
            );
        }

        if (workspace.status !== 'RUNNING') {
            throw new RpcException(
                'Workspace must be running before files can be accessed',
            );
        }

        const runtimeContainer =
            await this.prisma.workspaceContainer.findUnique({
                where: {
                    workspaceId_type: {
                        workspaceId,
                        type: 'FIBER_RUNTIME',
                    },
                },
            });

        if (!runtimeContainer) {
            throw new RpcException(
                'Fiber runtime container not found',
            );
        }

        return runtimeContainer.containerId;
    }

    private assertCommandSucceeded(
        exitCode: number,
        stderr: string,
    ): void {
        if (exitCode !== 0) {
            throw new RpcException(
                stderr.trim() ||
                'File operation failed',
            );
        }
    }

    private shouldIgnore(
        filePath: string,
    ): boolean {
        const ignoredSegments = [
            '.git',
            'node_modules',
            'target',
            '.next',
            'dist',
        ];

        return filePath
            .split('/')
            .some((segment) =>
                ignoredSegments.includes(segment),
            );
    }
}