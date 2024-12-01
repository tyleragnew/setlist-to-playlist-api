import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';

let expressApp;

async function bootstrap() {
  expressApp = express();
  const app = await NestFactory.create(
    AppModule,
    new ExpressAdapter(expressApp),
  );

  await app.init();
}

bootstrap().catch((err) => console.error('NestJS app failed to start', err));

// This is the key export that Vercel needs
export default expressApp;
