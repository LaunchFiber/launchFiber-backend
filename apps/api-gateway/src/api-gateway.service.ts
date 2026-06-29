import { BadRequestException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { catchError, firstValueFrom, throwError, timeout } from 'rxjs';

@Injectable()
export class ApiGatewayService {
    constructor(
        @Inject('AUTH_SERVICE')
        private readonly authClient: ClientProxy,
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

    private async sendToAuthService(cmd: string, payload: any) {
        return firstValueFrom(
            this.authClient.send({ cmd }, payload).pipe(
                timeout(5000),
                catchError((error) => {
                    const message =
                        error?.response?.message ||
                        error?.message ||
                        'Auth service unavailable';

                    if (message.includes('Invalid') || message.includes('Unauthorized')) {
                        return throwError(() => new UnauthorizedException(message));
                    }

                    return throwError(() => new BadRequestException(message));
                })
            )
        )
    }
}
