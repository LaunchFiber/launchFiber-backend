import { NestFactory } from '@nestjs/core';
import { Transport } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { WorkspaceServiceModule } from './workspace-service.module';

async function bootstrap() {
    const appContext = await NestFactory.createApplicationContext(
        WorkspaceServiceModule,
    );

    const config = appContext.get(ConfigService);

    const host = config.get<string>('WORKSPACE_SERVICE_HOST') || '127.0.0.1';
    const port = Number(config.get<string>('WORKSPACE_SERVICE_PORT')) || 8002;

    await appContext.close();

    const app = await NestFactory.createMicroservice(WorkspaceServiceModule, {
        transport: Transport.TCP,
        options: {
            host,
            port,
        },
    });

    await app.listen();

    console.log(`Workspace microservice running on ${host}:${port}`);
}

bootstrap();