// apps/auth-service/src/main.ts
import { NestFactory } from '@nestjs/core';
import { Transport } from '@nestjs/microservices';
import { AuthServiceModule } from './auth-service.module';

async function bootstrap() {
    const app = await NestFactory.createMicroservice(AuthServiceModule, {
        transport: Transport.TCP,
        options: {
            host: process.env.AUTH_SERVICE_HOST || '127.0.0.1',
            port: parseInt(process.env.AUTH_SERVICE_PORT || '8001'),
        },
    });

    console.log(
        `🚀 AUTH SERVICE IS RUNNING ON ${process.env.AUTH_SERVICE_HOST || '127.0.0.1'
        }:${process.env.AUTH_SERVICE_PORT || 8001}`,
    );
    await app.listen();
}

bootstrap();
