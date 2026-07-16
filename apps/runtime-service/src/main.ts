// apps/runtime-service/src/main.ts
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Transport } from '@nestjs/microservices';
import { RuntimeServiceModule } from './runtime-service.module';

async function bootstrap() {
  const context = await NestFactory.createApplicationContext(
    RuntimeServiceModule,
  );

  const config = context.get(ConfigService);

  const host =
    config.get<string>('RUNTIME_SERVICE_HOST') || '127.0.0.1';

  const port =
    Number(config.get<string>('RUNTIME_SERVICE_PORT')) || 4003;

  await context.close();

  const app = await NestFactory.createMicroservice(
    RuntimeServiceModule,
    {
      transport: Transport.TCP,
      options: {
        host,
        port,
      },
    },
  );

  await app.listen();

  console.log(`Runtime service running on ${host}:${port}`);
}

bootstrap().catch((error) => {
  console.error('Failed to start runtime service', error);
  process.exit(1);
});