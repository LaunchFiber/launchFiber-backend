import { Body, Controller, Delete, Get, Headers, Param, Post, Query, UnauthorizedException, Put } from '@nestjs/common';
import { ApiGatewayService } from './api-gateway.service';

@Controller()
export class ApiGatewayController {
    constructor(private readonly gatewayService: ApiGatewayService) { }

    @Post('auth/register')
    register(
        @Body()
        body: {
            name: string;
            email: string;
            password: string;
        }) {
        return this.gatewayService.register(body);
    }

    @Post('auth/login')
    login(
        @Body()
        body: {
            email: string;
            password: string;
        }) {
        return this.gatewayService.login(body);
    }

    @Post('auth/verify')
    verify(
        @Body()
        body: {
            token: string;
        }) {
        return this.gatewayService.verifyToken(body.token);
    }

    @Get('auth/me')
    async me(@Headers('authorization') authorization?: string) {
        if (!authorization) {
            throw new UnauthorizedException('Missing authorization header');
        }

        const token = authorization.replace('Bearer ', '');

        const result = await this.gatewayService.verifyToken(token);

        return result.user;
    }

    @Post('workspaces')
    async createWorkspace(
        @Headers('authorization') authorization: string,
        @Body() body: { name: string; templateId?: string },
    ) {

        const user = await this.getUserFromAuthorizationHeader(authorization);

        return this.gatewayService.createWorkspace({
            userId: user.id,
            name: body.name,
            templateId: body.templateId,
        });
    }


    @Get('workspaces')
    async findMyWorkspaces(@Headers('authorization') authorization: string) {
        const user = await this.getUserFromAuthorizationHeader(authorization);

        return this.gatewayService.findMyWorkspaces(user.id);
    }

    @Get('workspaces/:id')
    async findOneWorkspace(
        @Headers('authorization') authorization: string,
        @Param('id') id: string,
    ) {
        const user = await this.getUserFromAuthorizationHeader(authorization);

        return this.gatewayService.findOneWorkspace(user.id, id);
    }

    @Post('workspaces/:id/start')
    async startWorkspace(
        @Headers('authorization') authorization: string,
        @Param('id') id: string,
    ) {
        const user = await this.getUserFromAuthorizationHeader(authorization);

        return this.gatewayService.startWorkspace(user.id, id);
    }

    @Post('workspaces/:id/stop')
    async stopWorkspace(
        @Headers('authorization') authorization: string,
        @Param('id') id: string,
    ) {
        const user = await this.getUserFromAuthorizationHeader(authorization);

        return this.gatewayService.stopWorkspace(user.id, id);
    }

    @Delete('workspaces/:id')
    async deleteWorkspace(
        @Headers('authorization') authorization: string,
        @Param('id') id: string,
    ) {
        const user = await this.getUserFromAuthorizationHeader(authorization);

        return this.gatewayService.deleteWorkspace(user.id, id);
    }

    @Get('workspace/:id/status')
    async getWorkspaceStatus(
        @Headers('authorization') authorization: string,
        @Param('id') workspaceId: string,
    ) {
        const user = await this.getUserFromAuthorizationHeader(
            authorization,
        );

        return this.gatewayService.getWorkspaceStatus(
            user.id,
            workspaceId,
        );
    }

    @Get('workspace/:id/files')
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

    @Get('workspace/:id/files/content')
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

    @Post('workspace/:id/files')
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

    @Put('workspace/:id/files')
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

    @Delete('workspace/:id/files')
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

    @Post('workspace/:id/directories')
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

    @Put('workspace/:id/files/rename')
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



    @Get('health')
    health() {
        return {
            status: 'ok',
            service: 'api-gateway',
            timestamp: new Date().toISOString(),
        };
    }

    private async getUserFromAuthorizationHeader(authorization?: string) {
        if (!authorization) {
            throw new UnauthorizedException('Missing authorization header');
        }

        const token = authorization.replace('Bearer ', '');

        const result = await this.gatewayService.verifyToken(token);

        return result.user;
    }
}
