import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';

// Disable ANSI colors in non-TTY environments (e.g. Vercel)
if (!process.stdout.isTTY) {
  process.env.NO_COLOR = '1';
}

let expressApp;

async function bootstrap() {
  expressApp = express();
  const app = await NestFactory.create(
    AppModule,
    new ExpressAdapter(expressApp),
  );
  app.enableCors();
  await app.init();

  // If this module was run directly (e.g. `npm start`) then start a standalone HTTP server.
  // When imported by a serverless platform (Vercel) the file will be required and the
  // initialized `expressApp` will be used by the platform - we must NOT call `listen()` there.
  const shouldListenLocally = require.main === module;
  if (shouldListenLocally) {
    const port = process.env.PORT ? Number(process.env.PORT) : 3333;
    await app.listen(port);
    new Logger('Bootstrap').log(`Listening on http://localhost:${port}`);
  }
}

bootstrap().catch((err) =>
  new Logger('Bootstrap').error('NestJS app failed to start', err),
);

// This is the key export that Vercel (and other serverless platforms) needs
export default expressApp;
