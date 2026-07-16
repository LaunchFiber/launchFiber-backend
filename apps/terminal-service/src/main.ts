// apps/terminal-service/src/main.ts
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { TerminalServiceModule } from './terminal-service.module';

async function bootstrap() {
  const app = await NestFactory.create(TerminalServiceModule);

  const config = app.get(ConfigService);

  const port =
    Number(config.get<string>('TERMINAL_SERVICE_PORT')) || 8004;

  app.enableCors({
    origin: true,
    credentials: true,
  });

  await app.listen(port);

  console.log(
    `Terminal service running on http://localhost:${port}`,
  );
}

bootstrap().catch((error) => {
  console.error('Terminal service failed to start', error);
  process.exit(1);
});