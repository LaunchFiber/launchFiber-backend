import { Body, Controller, Get, Headers, Post, UnauthorizedException } from '@nestjs/common';
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


    @Get('health')
    health() {
        return {
            status: 'ok',
            service: 'api-gateway',
            timestamp: new Date().toISOString(),
        };
    }
}
