import { NestFactory } from '@nestjs/core';
import { ApiGatewayModule } from './api-gateway.module';

async function bootstrap() {
    const app = await NestFactory.create(ApiGatewayModule);

    app.enableCors({
        origin: '*',
        credentials: true,
    })

    app.setGlobalPrefix('api');

    const port = process.env.API_GATEWAY_PORT || 8000;

    console.log(`🚀 API GATEWAY IS RUNNING ON ${process.env.API_GATEWAY_HOST || '127.0.0.1'}:${port}`);
    await app.listen(port);
}
bootstrap();
