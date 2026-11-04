import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('v1');
  app.enableCors();
  await app.listen(Number(process.env.PORT) || 3000, '0.0.0.0');
}
bootstrap();
