import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  // Reflecting any origin with credentials enabled lets any site read
  // authenticated responses, so the allowlist is explicit and comes from the
  // environment. Local development falls back to the Next dev server.
  const origins = (config.get<string>("CORS_ORIGINS") ?? "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: origins,
    credentials: true
  });

  const port = Number(config.get<string>("PORT") ?? 4000);
  await app.listen(port);
}

void bootstrap();
