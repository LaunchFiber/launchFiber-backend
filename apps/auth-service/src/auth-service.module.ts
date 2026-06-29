import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthServiceController } from './auth-service.controller';
import { AuthService } from './auth-service.service';
import { PrismaService } from './prisma.service'; // Import local PrismaService

@Module({
    imports: [
        JwtModule.register({
            secret: process.env.JWT_SECRET || 'secret',
            signOptions: { expiresIn: '1h' },
        }),
    ],
    controllers: [AuthServiceController],
    providers: [AuthService, PrismaService], // Add PrismaService to providers
})
export class AuthServiceModule { }