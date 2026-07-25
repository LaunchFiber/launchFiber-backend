import {
    Injectable,
} from '@nestjs/common';

import { RpcException } from '@nestjs/microservices';
import { JwtService } from '@nestjs/jwt';

import { PrismaService } from '@app/prisma';

import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';

import { ccc } from '@ckb-ccc/core';

@Injectable()
export class AuthService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly jwtService: JwtService,
    ) { }

    async register(data: {
        name: string;
        email: string;
        password: string;
    }) {
        const normalizedEmail =
            data.email.trim().toLowerCase();

        const existingUser =
            await this.prisma.user.findUnique({
                where: {
                    email: normalizedEmail,
                },
            });

        if (existingUser) {
            throw new RpcException(
                'User already exists!',
            );
        }

        const passwordHash = await bcrypt.hash(
            data.password,
            10,
        );

        const user = await this.prisma.user.create({
            data: {
                name: data.name.trim(),
                email: normalizedEmail,
                passwordHash,
                authProvider: 'EMAIL',
            },
        });

        return this.buildAuthResponse(user);
    }

    async login(data: {
        email: string;
        password: string;
    }) {
        const normalizedEmail =
            data.email.trim().toLowerCase();

        const user =
            await this.prisma.user.findUnique({
                where: {
                    email: normalizedEmail,
                },
            });

        if (!user || !user.passwordHash) {
            throw new RpcException(
                'Invalid credentials',
            );
        }

        const isPasswordValid =
            await bcrypt.compare(
                data.password,
                user.passwordHash,
            );

        if (!isPasswordValid) {
            throw new RpcException(
                'Invalid credentials',
            );
        }

        return this.buildAuthResponse(user);
    }

    async createWalletChallenge(data: {
        walletAddress: string;
    }) {
        const walletAddress =
            data.walletAddress.trim();

        if (!walletAddress) {
            throw new RpcException(
                'Wallet address is required',
            );
        }

        await this.validateWalletAddress(
            walletAddress,
        );

        const nonce = randomBytes(32).toString('hex');
        const expiresAt = new Date(
            Date.now() + 5 * 60 * 1000,
        );

        const message = this.buildWalletMessage({
            walletAddress,
            nonce,
            expiresAt,
        });

        const challenge =
            await this.prisma.walletChallenge.create({
                data: {
                    walletAddress,
                    nonce,
                    message,
                    expiresAt,
                },
            });

        return {
            challengeId: challenge.id,
            nonce: challenge.nonce,
            message: challenge.message,
            expiresAt: challenge.expiresAt,
        };
    }

    async walletLogin(data: {
        walletAddress: string;
        challengeId: string;
        signature: unknown;
    }) {
        const walletAddress =
            data.walletAddress.trim();

        const challenge =
            await this.prisma.walletChallenge.findUnique({
                where: {
                    id: data.challengeId,
                },
            });

        if (!challenge) {
            throw new RpcException(
                'Wallet challenge not found',
            );
        }

        if (challenge.walletAddress !== walletAddress) {
            throw new RpcException(
                'Wallet address does not match the challenge',
            );
        }

        if (challenge.usedAt) {
            throw new RpcException(
                'Wallet challenge has already been used',
            );
        }

        if (challenge.expiresAt.getTime() < Date.now()) {
            throw new RpcException(
                'Wallet challenge has expired',
            );
        }

        let signatureIsValid = false;

        try {
            signatureIsValid =
                await ccc.Signer.verifyMessage(
                    challenge.message,
                    data.signature as never,
                );
        } catch {
            signatureIsValid = false;
        }

        if (!signatureIsValid) {
            throw new RpcException(
                'Invalid wallet signature',
            );
        }

        const result =
            await this.prisma.$transaction(
                async (transaction) => {
                    const currentChallenge =
                        await transaction.walletChallenge.findUnique({
                            where: {
                                id: challenge.id,
                            },
                        });

                    if (
                        !currentChallenge ||
                        currentChallenge.usedAt
                    ) {
                        throw new RpcException(
                            'Wallet challenge has already been used',
                        );
                    }

                    const existingUser =
                        await transaction.user.findUnique({
                            where: {
                                walletAddress,
                            },
                        });

                    const user =
                        existingUser ??
                        (await transaction.user.create({
                            data: {
                                name: this.walletDisplayName(
                                    walletAddress,
                                ),
                                walletAddress,
                                authProvider: 'CKB_WALLET',
                            },
                        }));

                    await transaction.walletChallenge.update({
                        where: {
                            id: challenge.id,
                        },
                        data: {
                            usedAt: new Date(),
                            userId: user.id,
                        },
                    });

                    return user;
                },
            );

        return this.buildAuthResponse(result);
    }

    async verifyToken(token: string) {
        try {
            const payload =
                await this.jwtService.verifyAsync(token, {
                    secret:
                        process.env.JWT_SECRET ||
                        'fiberdev_secret',
                });

            const user =
                await this.prisma.user.findUnique({
                    where: {
                        id: payload.sub,
                    },
                });

            if (!user) {
                throw new RpcException(
                    'User not found',
                );
            }

            return {
                valid: true,
                user: this.sanitizeUser(user),
            };
        } catch {
            throw new RpcException('Invalid token');
        }
    }

    async getProfile(userId: string) {
        const user =
            await this.prisma.user.findUnique({
                where: {
                    id: userId,
                },
            });

        if (!user) {
            throw new RpcException('User not found');
        }

        return this.sanitizeUser(user);
    }

    private async validateWalletAddress(
        walletAddress: string,
    ) {
        try {
            const isMainnet =
                walletAddress.startsWith('ckb1');

            const client = isMainnet
                ? new ccc.ClientPublicMainnet()
                : new ccc.ClientPublicTestnet();

            await ccc.Address.fromString(
                walletAddress,
                client,
            );
        } catch {
            throw new RpcException(
                'Invalid CKB wallet address',
            );
        }
    }

    private buildWalletMessage(input: {
        walletAddress: string;
        nonce: string;
        expiresAt: Date;
    }): string {
        return [
            'Corven Wallet Authentication',
            '',
            'Sign this message to authenticate with Corven.',
            'This action does not create a blockchain transaction or spend funds.',
            '',
            `Wallet: ${input.walletAddress}`,
            `Nonce: ${input.nonce}`,
            `Expires At: ${input.expiresAt.toISOString()}`,
        ].join('\n');
    }

    private walletDisplayName(
        walletAddress: string,
    ): string {
        return `CKB User ${walletAddress.slice(-6)}`;
    }

    private buildAuthResponse(user: {
        id: string;
        email: string | null;
        walletAddress: string | null;
        role: string;
        name: string;
        authProvider: string;
        createdAt: Date;
    }) {
        const payload = {
            sub: user.id,
            email: user.email,
            walletAddress: user.walletAddress,
            authProvider: user.authProvider,
        };

        const accessToken =
            this.jwtService.sign(payload);

        return {
            accessToken,
            user: this.sanitizeUser(user),
        };
    }

    private sanitizeUser(user: {
        id: string;
        email: string | null;
        walletAddress: string | null;
        role: string;
        name: string;
        authProvider: string;
        createdAt: Date;
    }) {
        return {
            id: user.id,
            name: user.name,
            email: user.email,
            walletAddress: user.walletAddress,
            authProvider: user.authProvider,
            role: user.role,
            createdAt: user.createdAt,
        };
    }
}