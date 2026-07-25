// apps/api-gateway/src/api-gateway.controller.ts

import {
    Body,
    Controller,
    Delete,
    Get,
    Headers,
    Param,
    Post,
    Put,
    Query,
    UnauthorizedException,
} from '@nestjs/common';

import { ApiGatewayService } from './api-gateway.service';

@Controller()
export class ApiGatewayController {
    constructor(
        private readonly gatewayService: ApiGatewayService,
    ) { }

    // =========================================
    // Authentication
    // =========================================

    @Post('auth/register')
    register(
        @Body()
        body: {
            name: string;
            email: string;
            password: string;
        },
    ) {
        return this.gatewayService.register(body);
    }

    @Post('auth/login')
    login(
        @Body()
        body: {
            email: string;
            password: string;
        },
    ) {
        return this.gatewayService.login(body);
    }

    @Post('auth/verify')
    verify(
        @Body()
        body: {
            token: string;
        },
    ) {
        return this.gatewayService.verifyToken(
            body.token,
        );
    }

    @Get('auth/me')
    async me(
        @Headers('authorization')
        authorization?: string,
    ) {
        const user =
            await this.getUserFromAuthorizationHeader(
                authorization,
            );

        return user;
    }

    @Post('auth/wallet/challenge')
    createWalletChallenge(
        @Body()
        body: {
            walletAddress: string;
        },
    ) {
        return this.gatewayService.createWalletChallenge(body);
    }

    @Post('auth/wallet/login')
    walletLogin(
        @Body()
        body: {
            walletAddress: string;
            challengeId: string;
            signature: unknown;
        },
    ) {
        return this.gatewayService.walletLogin(body);
    }

    // =========================================
    // Workspace management
    // =========================================

    @Post('workspaces')
    async createWorkspace(
        @Headers('authorization')
        authorization: string,

        @Body()
        body: {
            name: string;
            templateId?: string;
        },
    ) {
        const user =
            await this.getUserFromAuthorizationHeader(
                authorization,
            );

        return this.gatewayService.createWorkspace({
            userId: user.id,
            name: body.name,
            templateId: body.templateId,
        });
    }

    @Get('workspaces')
    async findMyWorkspaces(
        @Headers('authorization')
        authorization: string,
    ) {
        const user =
            await this.getUserFromAuthorizationHeader(
                authorization,
            );

        return this.gatewayService.findMyWorkspaces(
            user.id,
        );
    }

    @Get('workspaces/:id')
    async findOneWorkspace(
        @Headers('authorization')
        authorization: string,

        @Param('id')
        workspaceId: string,
    ) {
        const user =
            await this.getUserFromAuthorizationHeader(
                authorization,
            );

        return this.gatewayService.findOneWorkspace(
            user.id,
            workspaceId,
        );
    }

    @Delete('workspaces/:id')
    async deleteWorkspace(
        @Headers('authorization')
        authorization: string,

        @Param('id')
        workspaceId: string,
    ) {
        const user =
            await this.getUserFromAuthorizationHeader(
                authorization,
            );

        return this.gatewayService.deleteWorkspace(
            user.id,
            workspaceId,
        );
    }

    // =========================================
    // Workspace runtime
    // =========================================

    @Post('workspaces/:id/start')
    async startWorkspace(
        @Headers('authorization')
        authorization: string,

        @Param('id')
        workspaceId: string,
    ) {
        const user =
            await this.getUserFromAuthorizationHeader(
                authorization,
            );

        return this.gatewayService.startWorkspace(
            user.id,
            workspaceId,
        );
    }

    @Post('workspaces/:id/stop')
    async stopWorkspace(
        @Headers('authorization')
        authorization: string,

        @Param('id')
        workspaceId: string,
    ) {
        const user =
            await this.getUserFromAuthorizationHeader(
                authorization,
            );

        return this.gatewayService.stopWorkspace(
            user.id,
            workspaceId,
        );
    }

    @Get('workspaces/:id/status')
    async getWorkspaceStatus(
        @Headers('authorization')
        authorization: string,

        @Param('id')
        workspaceId: string,
    ) {
        const user =
            await this.getUserFromAuthorizationHeader(
                authorization,
            );

        return this.gatewayService.getWorkspaceStatus(
            user.id,
            workspaceId,
        );
    }

    @Post('workspaces/:id/reset')
    async resetWorkspace(
        @Headers('authorization')
        authorization: string,

        @Param('id')
        workspaceId: string,
    ) {
        const user =
            await this.getUserFromAuthorizationHeader(
                authorization,
            );

        return this.gatewayService.resetWorkspace(
            user.id,
            workspaceId,
        );
    }

    @Delete('workspaces/:id/runtime')
    async deleteWorkspaceRuntime(
        @Headers('authorization')
        authorization: string,

        @Param('id')
        workspaceId: string,

        @Query('deleteWorkspaceFiles')
        deleteWorkspaceFiles?: string,

        @Query('deleteCkbData')
        deleteCkbData?: string,
    ) {
        const user =
            await this.getUserFromAuthorizationHeader(
                authorization,
            );

        return this.gatewayService.deleteWorkspaceRuntime(
            user.id,
            workspaceId,
            this.parseBooleanQuery(
                deleteWorkspaceFiles,
                true,
            ),
            this.parseBooleanQuery(
                deleteCkbData,
                true,
            ),
        );
    }

    @Post('workspaces/:id/execute')
    async executeRuntimeCommand(
        @Headers('authorization')
        authorization: string,

        @Param('id')
        workspaceId: string,

        @Body()
        body: {
            command: string[];
            workingDirectory?: string;
        },
    ) {
        const user =
            await this.getUserFromAuthorizationHeader(
                authorization,
            );

        return this.gatewayService.executeRuntimeCommand(
            user.id,
            workspaceId,
            body.command,
            body.workingDirectory,
        );
    }

    @Post('workspaces/:id/build')
    async buildWorkspace(
        @Headers('authorization')
        authorization: string,

        @Param('id')
        workspaceId: string,
    ) {
        const user =
            await this.getUserFromAuthorizationHeader(
                authorization,
            );

        return this.gatewayService.buildWorkspace(
            user.id,
            workspaceId,
        );
    }

    @Post('workspaces/:id/test')
    async testWorkspace(
        @Headers('authorization')
        authorization: string,

        @Param('id')
        workspaceId: string,
    ) {
        const user =
            await this.getUserFromAuthorizationHeader(
                authorization,
            );

        return this.gatewayService.testWorkspace(
            user.id,
            workspaceId,
        );
    }

    @Post('workspaces/:id/run-contract')
    async runContract(
        @Headers('authorization')
        authorization: string,

        @Param('id')
        workspaceId: string,
    ) {
        const user =
            await this.getUserFromAuthorizationHeader(
                authorization,
            );

        return this.gatewayService.runContract(
            user.id,
            workspaceId,
        );
    }

    // =========================================
    // Workspace files
    // =========================================

    @Get('workspaces/:id/files')
    async listFiles(
        @Headers('authorization')
        authorization: string,

        @Param('id')
        workspaceId: string,
    ) {
        const user =
            await this.getUserFromAuthorizationHeader(
                authorization,
            );

        return this.gatewayService.listFiles(
            user.id,
            workspaceId,
        );
    }

    @Get('workspaces/:id/files/content')
    async readFile(
        @Headers('authorization')
        authorization: string,

        @Param('id')
        workspaceId: string,

        @Query('path')
        path: string,
    ) {
        const user =
            await this.getUserFromAuthorizationHeader(
                authorization,
            );

        return this.gatewayService.readFile(
            user.id,
            workspaceId,
            path,
        );
    }

    @Post('workspaces/:id/files')
    async createFile(
        @Headers('authorization')
        authorization: string,

        @Param('id')
        workspaceId: string,

        @Body()
        body: {
            path: string;
            content?: string;
        },
    ) {
        const user =
            await this.getUserFromAuthorizationHeader(
                authorization,
            );

        return this.gatewayService.createFile(
            user.id,
            workspaceId,
            body.path,
            body.content ?? '',
        );
    }

    @Put('workspaces/:id/files')
    async updateFile(
        @Headers('authorization')
        authorization: string,

        @Param('id')
        workspaceId: string,

        @Body()
        body: {
            path: string;
            content: string;
        },
    ) {
        const user =
            await this.getUserFromAuthorizationHeader(
                authorization,
            );

        return this.gatewayService.updateFile(
            user.id,
            workspaceId,
            body.path,
            body.content,
        );
    }

    @Delete('workspaces/:id/files')
    async deleteFile(
        @Headers('authorization')
        authorization: string,

        @Param('id')
        workspaceId: string,

        @Query('path')
        path: string,
    ) {
        const user =
            await this.getUserFromAuthorizationHeader(
                authorization,
            );

        return this.gatewayService.deleteFile(
            user.id,
            workspaceId,
            path,
        );
    }

    @Post('workspaces/:id/directories')
    async createDirectory(
        @Headers('authorization')
        authorization: string,

        @Param('id')
        workspaceId: string,

        @Body()
        body: {
            path: string;
        },
    ) {
        const user =
            await this.getUserFromAuthorizationHeader(
                authorization,
            );

        return this.gatewayService.createDirectory(
            user.id,
            workspaceId,
            body.path,
        );
    }

    @Put('workspaces/:id/files/rename')
    async renameFile(
        @Headers('authorization')
        authorization: string,

        @Param('id')
        workspaceId: string,

        @Body()
        body: {
            oldPath: string;
            newPath: string;
        },
    ) {
        const user =
            await this.getUserFromAuthorizationHeader(
                authorization,
            );

        return this.gatewayService.renameFile(
            user.id,
            workspaceId,
            body.oldPath,
            body.newPath,
        );
    }

    // =========================================
    // Health
    // =========================================

    @Get('health')
    health() {
        return {
            status: 'ok',
            service: 'api-gateway',
            timestamp: new Date().toISOString(),
        };
    }

    @Get('health/runtime')
    runtimeHealth() {
        return this.gatewayService.runtimeHealth();
    }

    // =========================================
    // Private helpers
    // =========================================

    private async getUserFromAuthorizationHeader(
        authorization?: string,
    ) {
        if (!authorization) {
            throw new UnauthorizedException(
                'Missing authorization header',
            );
        }

        const [scheme, token] =
            authorization.trim().split(/\s+/);

        if (
            scheme?.toLowerCase() !== 'bearer' ||
            !token
        ) {
            throw new UnauthorizedException(
                'Invalid authorization header',
            );
        }

        const result: any =
            await this.gatewayService.verifyToken(
                token,
            );

        if (!result?.user) {
            throw new UnauthorizedException(
                'Invalid authentication response',
            );
        }

        return result.user;
    }

    private parseBooleanQuery(
        value: string | undefined,
        defaultValue: boolean,
    ): boolean {
        if (value === undefined) {
            return defaultValue;
        }

        const normalized =
            value.trim().toLowerCase();

        if (
            normalized === 'true' ||
            normalized === '1'
        ) {
            return true;
        }

        if (
            normalized === 'false' ||
            normalized === '0'
        ) {
            return false;
        }

        return defaultValue;
    }
}