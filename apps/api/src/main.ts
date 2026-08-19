import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { Logger } from "@nestjs/common";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const logger = new Logger("bootstrap");

  const isProduction = config.get<string>("NODE_ENV") === "production";
  const configured = config.get<string>("CORS_ORIGINS");

  // Reflecting any origin with credentials enabled lets any site read
  // authenticated responses. The allowlist is explicit, and in production a
  // missing one is fatal rather than silently falling back to localhost — a
  // deployment that quietly allows nothing (or worse, the wrong thing) is
  // harder to notice than one that refuses to start.
  if (isProduction && !configured) {
    throw new Error(
      "CORS_ORIGINS must be set in production. Set it to the deployed web origin."
    );
  }

  const origins = (configured ?? "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (isProduction && origins.some((origin) => origin.includes("localhost"))) {
    throw new Error(
      `CORS_ORIGINS contains localhost in production: ${origins.join(", ")}. ` +
        "This is almost always a copied .env rather than an intent."
    );
  }

  app.enableCors({ origin: origins, credentials: true });

  // Shrinks the blast radius of a mistake: the API serves JSON to a known
  // origin, so it has no reason to advertise its framework.
  app.getHttpAdapter().getInstance().disable("x-powered-by");

  const port = Number(config.get<string>("PORT") ?? 4000);
  await app.listen(port);

  logger.log(`API listening on ${port}; CORS allows ${origins.join(", ")}`);
}

void bootstrap();
