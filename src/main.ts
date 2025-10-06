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
  app.enableCors();
  await app.init();

  // If this module was run directly (e.g. `npm start`) then start a standalone HTTP server.
  // When imported by a serverless platform (Vercel) the file will be required and the
  // initialized `expressApp` will be used by the platform - we must NOT call `listen()` there.
  const shouldListenLocally = require.main === module;
  if (shouldListenLocally) {
    const port = process.env.PORT ? Number(process.env.PORT) : 3333;
    await app.listen(port);
    console.log(`NestJS (express) listening on http://localhost:${port}`);
  }
}

bootstrap().catch((err) => console.error('NestJS app failed to start', err));

// This is the key export that Vercel (and other serverless platforms) needs
export default expressApp;
