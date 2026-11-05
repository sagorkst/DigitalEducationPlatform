
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '../../.env') });

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');

  app.enableCors();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen(process.env.PORT ?? 4000);

  console.log(
    'Shikhasetu API is running on http://localhost:4000/api',
  );
}

bootstrap();
