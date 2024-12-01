import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ExpressAdapter } from '@nestjs/platform-express';
import * as express from 'express';
import serverlessExpress from '@vendia/serverless-express';
import { Handler } from 'aws-lambda';
import { Logger } from '@nestjs/common';

let serverlessExpressHandler: Handler;

async function bootstrap() {
  const expressApp = express();
  const app = await NestFactory.create(
    AppModule,
    new ExpressAdapter(expressApp),
  );

  app.enableCors();

  // Start locally for development
  if (process.env.IS_VERCEL !== 'true') {
    const port = process.env.PORT || 3000;
    await app.listen(port);
    Logger.log(`Application is running on: http://localhost:${port}`);
  } else {
    // Initialize serverlessExpress for Vercel
    await app.init();
    serverlessExpressHandler = serverlessExpress({ app: expressApp });
  }
}

// Bootstrap the app
bootstrap();

// Export the serverless handler for Vercel
export const handler: Handler = (event, context, callback) => {
  if (!serverlessExpressHandler) {
    throw new Error('Serverless handler is not initialized.');
  }
  return serverlessExpressHandler(event, context, callback);
};
