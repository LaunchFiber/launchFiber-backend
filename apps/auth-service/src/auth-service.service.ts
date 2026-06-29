import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
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
            throw new BadRequestException("User already exists!")
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
