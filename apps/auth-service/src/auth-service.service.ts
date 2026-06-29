import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly jwtService: JwtService,
    ) { }

    async reguster(data: {
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

        const passwordHash = await bcry
    }
}
