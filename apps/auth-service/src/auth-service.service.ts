import { Injectable, UnauthorizedException } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { PrismaService } from '@app/prisma';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';

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
        const existingUser = await this.prisma.user.findUnique({
            where: {
                email: data.email,
            },
        })

        if (existingUser) {
            throw new RpcException('User already exists!');
        }

        const passwordHash = await bcrypt.hash(data.password, 10);

        const user = await this.prisma.user.create({
            data: {
                name: data.name,
                email: data.email,
                passwordHash,
            },
        });

        return this.buildAuthResponse(user)
    }

    async login(data: {
        email: string;
        password: string;
    }) {
        const user = await this.prisma.user.findUnique({
            where: {
                email: data.email,
            },
        })

        if (!user) {
            throw new RpcException("Invalid credentials");
        }

        const isPasswordValid = await bcrypt.compare(
            data.password,
            user.passwordHash
        )

        if (!isPasswordValid) {
            throw new RpcException('Invalid credentials');
        }

        return this.buildAuthResponse(user);
    }

    async verifyToken(token: string) {
        try {
            const payload = await this.jwtService.verifyAsync(token, {
                secret: process.env.JWT_SECRET || 'fiberdev_secret',
            });


            const user = await this.prisma.user.findUnique({
                where: {
                    id: payload.sub,
                },
            });

            if (!user) {
                throw new RpcException('User not found');
            }

            return {
                valid: true,
                user: this.sanitizeUser(user),
            };
        } catch (e) {
            throw new RpcException('Invalid token');
        }
    }

    async getProfile(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: {
                id: userId,
            },
        });

        if (!user) {
            throw new RpcException('User not found');
        }

        return this.sanitizeUser(user);
    }


    private buildAuthResponse(user: any) {
        const payload = {
            sub: user.id,
            email: user.email,
        };

        const accessToken = this.jwtService.sign(payload);

        return {
            accessToken,
            user: this.sanitizeUser(user)
        }
    }

    private sanitizeUser(user: any) {
        return {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            createdAt: user.createdAt,
        }
    }
}
