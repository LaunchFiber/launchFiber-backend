import { NestFactory } from '@nestjs/core';
import { TerminalServiceModule } from './terminal-service.module';

async function bootstrap() {
  const app = await NestFactory.create(TerminalServiceModule);
  await app.listen(process.env.port ?? 3000);
}
bootstrap();
