import { Controller } from '@nestjs/common';

import {
    MessagePattern,
    Payload,
} from '@nestjs/microservices';

import { AuthService } from './auth-service.service';

@Controller()
export class AuthServiceController {
    constructor(
        private readonly authService: AuthService,
    ) { }

    @MessagePattern({
        cmd: 'auth.register',
    })
    register(
        @Payload()
        data: {
            name: string;
            email: string;
            password: string;
        },
    ) {
        return this.authService.register(data);
    }

    @MessagePattern({
        cmd: 'auth.login',
    })
    login(
        @Payload()
        data: {
            email: string;
            password: string;
        },
    ) {
        return this.authService.login(data);
    }

    @MessagePattern({
        cmd: 'auth.wallet.challenge',
    })
    createWalletChallenge(
        @Payload()
        data: {
            walletAddress: string;
        },
    ) {
        return this.authService.createWalletChallenge(
            data,
        );
    }

    @MessagePattern({
        cmd: 'auth.wallet.login',
    })
    walletLogin(
        @Payload()
        data: {
            walletAddress: string;
            challengeId: string;
            signature: unknown;
        },
    ) {
        return this.authService.walletLogin(data);
    }

    @MessagePattern({
        cmd: 'auth.verify',
    })
    verify(
        @Payload()
        data: {
            token: string;
        },
    ) {
        return this.authService.verifyToken(
            data.token,
        );
    }

    @MessagePattern({
        cmd: 'auth.profile',
    })
    profile(
        @Payload()
        data: {
            userId: string;
        },
    ) {
        return this.authService.getProfile(
            data.userId,
        );
    }
}