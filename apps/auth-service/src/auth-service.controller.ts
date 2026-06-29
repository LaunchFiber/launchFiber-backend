import { Controller, Get } from '@nestjs/common';
import { AuthService } from './auth-service.service';
import { MessagePattern, Payload } from '@nestjs/microservices';

@Controller()
export class AuthServiceController {
    constructor(private readonly authService: AuthService) { }

    @MessagePattern({ cmd: "auth.register" })
    register(@Payload() data: {
        name: string
        email: string,
        password: string,
    },
    ) {
        return this.authService.register(data)
    }
}
