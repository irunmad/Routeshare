import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('v1');
  // Render terminates TLS and forwards one trusted proxy hop.
  app.getHttpAdapter().getInstance().set('trust proxy', 1);
  app.enableCors();
  await app.listen(Number(process.env.PORT) || 3000, '0.0.0.0');
}
bootstrap();
