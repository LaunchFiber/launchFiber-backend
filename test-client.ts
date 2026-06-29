import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

async function bootstrap() {
  const client = ClientProxyFactory.create({
    transport: Transport.TCP,
    options: {
      host: '127.0.0.1',
      port: 8001,
    },
  });

  try {
    await client.connect();
    console.log('Successfully connected to auth-service over TCP!');

    console.log('Sending message pattern { cmd: "getHello" }...');
    const response = await firstValueFrom(client.send({ cmd: 'getHello' }, {}));
    
    console.log('Response received:');
    console.log(response);
  } catch (error) {
    console.error('Error communicating with auth-service:', error);
  } finally {
    client.close();
  }
}

bootstrap();
