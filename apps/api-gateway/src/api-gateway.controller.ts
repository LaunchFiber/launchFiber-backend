import { Body, Controller, Delete, Get, Headers, Param, Post, UnauthorizedException } from '@nestjs/common';
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

    @Get('auth/verify')
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

        console.log('Created workspace request:', body);
        const user = await this.getUserFromAuthorizationHeader(authorization);

        console.log('User:', user);

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
