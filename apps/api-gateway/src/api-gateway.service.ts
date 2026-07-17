// apps/api-gateway/src/api-gateway.service.ts

import {
    BadRequestException,
    GatewayTimeoutException,
    Inject,
    Injectable,
    ServiceUnavailableException,
    UnauthorizedException,
} from '@nestjs/common';

import {
    ClientProxy,
} from '@nestjs/microservices';

import {
    catchError,
    firstValueFrom,
    throwError,
    timeout,
    TimeoutError,
} from 'rxjs';

@Injectable()
export class ApiGatewayService {
    constructor(
        @Inject('AUTH_SERVICE')
        private readonly authClient: ClientProxy,

        @Inject('WORKSPACE_SERVICE')
        private readonly workspaceClient: ClientProxy,

        @Inject('FILE_SERVICE')
        private readonly fileClient: ClientProxy,

        @Inject('RUNTIME_SERVICE')
        private readonly runtimeClient: ClientProxy,
    ) { }

    // =========================================
    // Authentication
    // =========================================

    async register(data: {
        name: string;
        email: string;
        password: string;
    }) {
        return this.sendToAuthService(
            'auth.register',
            data,
        );
    }

    async login(data: {
        email: string;
        password: string;
    }) {
        return this.sendToAuthService(
            'auth.login',
            data,
        );
    }

    async verifyToken(token: string) {
        return this.sendToAuthService(
            'auth.verify',
            {
                token,
            },
        );
    }

    async getProfile(userId: string) {
        return this.sendToAuthService(
            'auth.profile',
            {
                userId,
            },
        );
    }

    // =========================================
    // Workspace service
    // =========================================

    createWorkspace(data: {
        userId: string;
        name: string;
        templateId?: string;
    }) {
        return this.send(
            this.workspaceClient,
            'workspace.create',
            data,
        );
    }

    findMyWorkspaces(userId: string) {
        return this.send(
            this.workspaceClient,
            'workspace.findMine',
            {
                userId,
            },
        );
    }

    findOneWorkspace(
        userId: string,
        workspaceId: string,
    ) {
        return this.send(
            this.workspaceClient,
            'workspace.findOne',
            {
                userId,
                workspaceId,
            },
        );
    }

    /**
     * Deletes the complete workspace record.
     *
     * The workspace service should call runtime.delete
     * before deleting the workspace database record.
     */
    deleteWorkspace(
        userId: string,
        workspaceId: string,
    ) {
        return this.send(
            this.workspaceClient,
            'workspace.delete',
            {
                userId,
                workspaceId,
            },
            60_000,
        );
    }

    // =========================================
    // Runtime service
    // =========================================

    startWorkspace(
        userId: string,
        workspaceId: string,
    ) {
        return this.send(
            this.runtimeClient,
            'runtime.start',
            {
                userId,
                workspaceId,
            },
            15 * 60 * 1_000,
        );
    }

    stopWorkspace(
        userId: string,
        workspaceId: string,
    ) {
        return this.send(
            this.runtimeClient,
            'runtime.stop',
            {
                userId,
                workspaceId,
            },
            60_000,
        );
    }

    getWorkspaceStatus(
        userId: string,
        workspaceId: string,
    ) {
        return this.send(
            this.runtimeClient,
            'runtime.status',
            {
                userId,
                workspaceId,
            },
            30_000,
        );
    }

    deleteWorkspaceRuntime(
        userId: string,
        workspaceId: string,
        deleteWorkspaceFiles = true,
        deleteCkbData = true,
    ) {
        return this.send(
            this.runtimeClient,
            'runtime.delete',
            {
                userId,
                workspaceId,
                deleteWorkspaceFiles,
                deleteCkbData,
            },
            60_000,
        );
    }

    resetWorkspace(
        userId: string,
        workspaceId: string,
    ) {
        return this.send(
            this.runtimeClient,
            'runtime.reset',
            {
                userId,
                workspaceId,
            },
            15 * 60 * 1_000,
        );
    }

    executeRuntimeCommand(
        userId: string,
        workspaceId: string,
        command: string[],
        workingDirectory?: string,
    ) {
        if (
            !Array.isArray(command) ||
            command.length === 0
        ) {
            throw new BadRequestException(
                'Command must contain at least one argument',
            );
        }

        return this.send(
            this.runtimeClient,
            'runtime.execute',
            {
                userId,
                workspaceId,
                command,
                workingDirectory,
            },
            10 * 60 * 1_000,
        );
    }

    buildWorkspace(
        userId: string,
        workspaceId: string,
    ) {
        return this.send(
            this.runtimeClient,
            'runtime.build',
            {
                userId,
                workspaceId,
            },
            15 * 60 * 1_000,
        );
    }

    testWorkspace(
        userId: string,
        workspaceId: string,
    ) {
        return this.send(
            this.runtimeClient,
            'runtime.test',
            {
                userId,
                workspaceId,
            },
            15 * 60 * 1_000,
        );
    }

    runContract(
        userId: string,
        workspaceId: string,
    ) {
        return this.send(
            this.runtimeClient,
            'runtime.run-contract',
            {
                userId,
                workspaceId,
            },
            5 * 60 * 1_000,
        );
    }

    runtimeHealth() {
        return this.send(
            this.runtimeClient,
            'runtime.health',
            {},
            10_000,
        );
    }

    // =========================================
    // File service
    // =========================================

    listFiles(
        userId: string,
        workspaceId: string,
    ) {
        return this.send(
            this.fileClient,
            'file.list',
            {
                userId,
                workspaceId,
            },
        );
    }

    readFile(
        userId: string,
        workspaceId: string,
        path: string,
    ) {
        return this.send(
            this.fileClient,
            'file.read',
            {
                userId,
                workspaceId,
                path,
            },
        );
    }

    createFile(
        userId: string,
        workspaceId: string,
        path: string,
        content: string,
    ) {
        return this.send(
            this.fileClient,
            'file.create',
            {
                userId,
                workspaceId,
                path,
                content,
            },
        );
    }

    updateFile(
        userId: string,
        workspaceId: string,
        path: string,
        content: string,
    ) {
        return this.send(
            this.fileClient,
            'file.update',
            {
                userId,
                workspaceId,
                path,
                content,
            },
        );
    }

    deleteFile(
        userId: string,
        workspaceId: string,
        path: string,
    ) {
        return this.send(
            this.fileClient,
            'file.delete',
            {
                userId,
                workspaceId,
                path,
            },
        );
    }

    createDirectory(
        userId: string,
        workspaceId: string,
        path: string,
    ) {
        return this.send(
            this.fileClient,
            'file.mkdir',
            {
                userId,
                workspaceId,
                path,
            },
        );
    }

    renameFile(
        userId: string,
        workspaceId: string,
        oldPath: string,
        newPath: string,
    ) {
        return this.send(
            this.fileClient,
            'file.rename',
            {
                userId,
                workspaceId,
                oldPath,
                newPath,
            },
        );
    }

    // =========================================
    // Transport helpers
    // =========================================

    private async sendToAuthService(
        cmd: string,
        payload: unknown,
        timeoutMs = 5_000,
    ) {
        return this.send(
            this.authClient,
            cmd,
            payload,
            timeoutMs,
        );
    }

    private async send<T = unknown>(
        client: ClientProxy,
        cmd: string,
        payload: unknown,
        timeoutMs = 5_000,
    ): Promise<T> {
        return firstValueFrom(
            client
                .send<T>(
                    {
                        cmd,
                    },
                    payload,
                )
                .pipe(
                    timeout(timeoutMs),

                    catchError((error: unknown) => {
                        return throwError(
                            () =>
                                this.mapMicroserviceError(
                                    error,
                                    cmd,
                                ),
                        );
                    }),
                ),
        );
    }

    private mapMicroserviceError(
        error: unknown,
        command: string,
    ): Error {
        if (error instanceof TimeoutError) {
            return new GatewayTimeoutException(
                `Request to ${command} timed out`,
            );
        }

        const source =
            error as {
                message?: string;
                response?: {
                    message?: string | string[];
                    statusCode?: number;
                };
                statusCode?: number;
                code?: string;
            };

        const responseMessage =
            source?.response?.message;

        const message = Array.isArray(
            responseMessage,
        )
            ? responseMessage.join(', ')
            : responseMessage ??
            source?.message ??
            'Microservice unavailable';

        const statusCode =
            source?.response?.statusCode ??
            source?.statusCode;

        if (
            statusCode === 401 ||
            statusCode === 403 ||
            /unauthorized|forbidden|invalid token|token expired/i.test(
                message,
            )
        ) {
            return new UnauthorizedException(
                message,
            );
        }

        if (
            source?.code === 'ECONNREFUSED' ||
            source?.code === 'ECONNRESET'
        ) {
            return new ServiceUnavailableException(
                `${command} service is unavailable`,
            );
        }

        return new BadRequestException(
            message,
        );
    }
}