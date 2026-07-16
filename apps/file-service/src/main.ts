// apps/file-service/src/main.ts
import { NestFactory } from '@nestjs/core';
import { Transport } from '@nestjs/microservices';
import { FileServiceModule } from './file-service.module';

async function bootstrap() {
    const host =
        process.env.FILE_SERVICE_HOST || '127.0.0.1';

    const port =
        Number(process.env.FILE_SERVICE_PORT) || 8005;

    const app = await NestFactory.createMicroservice(
        FileServiceModule,
        {
            transport: Transport.TCP,
            options: {
                host,
                port,
            },
        },
    );

    await app.listen();

    console.log(
        `File service running on ${host}:${port}`,
    );
}

bootstrap().catch((error) => {
    console.error(
        'File service failed to start:',
        error,
    );

    process.exit(1);
});