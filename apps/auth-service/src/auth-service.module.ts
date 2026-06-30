import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthServiceController } from './auth-service.controller';
import { AuthService } from './auth-service.service';
import { PrismaService } from 'libs/prisma/src/prisma.service'; // Import local PrismaService
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: '.env',
        }),
        JwtModule.registerAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({
                secret: config.get<string>('JWT_SECRET') || 'fiberdev_secret',
                signOptions: {
                    expiresIn: config.get<string | any>('JWT_EXPIRES_IN') || '1d',
                },
            }),
        }),
    ],
    controllers: [AuthServiceController],
    providers: [AuthService, PrismaService],
})
export class AuthServiceModule { }