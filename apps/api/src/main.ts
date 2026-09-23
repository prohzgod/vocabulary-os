import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";
import { config } from "./config";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Auth is a bearer token (no cookies), so allowing any origin is safe and
  // lets the extension (chrome-extension://…) and any web host call the API.
  app.enableCors();
  // Hosts like Render, Fly and Railway put a proxy in front, so the client IP
  // (used for rate limiting) comes from X-Forwarded-For.
  app.set("trust proxy", 1);
  app.enableShutdownHooks();
  await app.listen(config.port);
  console.log(`API listening on http://localhost:${config.port}`);
}

void bootstrap();
