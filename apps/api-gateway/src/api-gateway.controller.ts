import { Body, Controller, Get, Post } from '@nestjs/common';
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

    @Get('health')
    health() {
        return {
            status: 'ok',
            service: 'api-gateway',
            timestamp: new Date().toISOString(),
        };
    }
}
