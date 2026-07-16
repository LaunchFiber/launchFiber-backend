import { BadRequestException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { catchError, firstValueFrom, throwError, timeout } from 'rxjs';

@Injectable()
export class ApiGatewayService {
    constructor(
        @Inject('AUTH_SERVICE')
        private readonly authClient: ClientProxy,

        @Inject('WORKSPACE_SERVICE')
        private readonly workspaceClient: ClientProxy,

        @Inject('FILE_SERVICE')
        private readonly fileClient: ClientProxy,
    ) { }

    async register(data: {
        name: string;
        email: string;
        password: string;
    }) {
        return this.sendToAuthService('auth.register', data)
    }

    async login(data: {
        email: string;
        password: string;
    }) {
        return this.sendToAuthService('auth.login', data)
    }

    async verifyToken(token: string) {
        return this.sendToAuthService('auth.verify', { token });
    }

    async getProfile(userId: string) {
        return this.sendToAuthService('auth.profile', { userId });
    }

    // #########. Workspace Services. ######### //
    createWorkspace(data: {
        userId: string;
        name: string;
        templateId?: string;
    }) {
        return this.send(this.workspaceClient, 'workspace.create', data)
    }


    findMyWorkspaces(userId: string) {
        return this.send(this.workspaceClient, 'workspace.findMine', { userId });
    }

    findOneWorkspace(userId: string, workspaceId: string) {
        return this.send(this.workspaceClient, 'workspace.findOne', {
            userId,
            workspaceId,
        });
    }

    startWorkspace(userId: string, workspaceId: string) {
        return this.send(this.workspaceClient, 'workspace.start', {
            userId,
            workspaceId,
        }, 15 * 60 * 1000);
    }

    stopWorkspace(userId: string, workspaceId: string) {
        return this.send(this.workspaceClient, 'workspace.stop', {
            userId,
            workspaceId,
        }, 30000);
    }

    deleteWorkspace(userId: string, workspaceId: string) {
        return this.send(this.workspaceClient, 'workspace.delete', {
            userId,
            workspaceId,
        }, 60000);
    }

    getWorkspaceStatus(userId: string, workspaceId: string) {
        return this.send(
            this.workspaceClient,
            'workspace.status',
            {
                userId,
                workspaceId,
            },
            30000,
        );
    }

    listFiles(userId: string, workspaceId: string) {
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

    private async sendToAuthService(cmd: string, payload: any) {
        return firstValueFrom(
            this.authClient.send({ cmd }, payload).pipe(
                timeout(5000),
                catchError((error) => {
                    const message =
                        error?.response?.message ||
                        error?.message ||
                        'Auth service unavailable';

                    console.log(error)

                    if (message.includes('Invalid') || message.includes('Unauthorized')) {
                        return throwError(() => new UnauthorizedException(message));
                    }

                    return throwError(() => new BadRequestException(message));
                })
            )
        )
    }



    private async send(client: ClientProxy, cmd: string, payload: any, timeoutMs = 5000) {
        return firstValueFrom(
            client.send({ cmd }, payload).pipe(
                timeout(timeoutMs),
                catchError((error) => {
                    const message =
                        error?.response?.message ||
                        error?.message ||
                        'Microservice unavailable';

                    if (
                        message.includes('Invalid') ||
                        message.includes('Unauthorized') ||
                        message.includes('token')
                    ) {
                        return throwError(() => new UnauthorizedException(message));
                    }

                    return throwError(() => new BadRequestException(message));
                }),
            ),
        );
    }

}