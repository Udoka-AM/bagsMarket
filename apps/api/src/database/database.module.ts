import { Global, Module, type OnApplicationShutdown } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createDatabase, type Database } from "@bagsmarkets/db";

export const DATABASE = Symbol("DATABASE");

// Global so feature modules can inject DATABASE without re-importing this.
@Global()
@Module({
  providers: [
    {
      provide: DATABASE,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Database => {
        const url = config.get<string>("DATABASE_URL");

        if (!url) {
          // Failing at startup beats every query failing later with a less
          // obvious error.
          throw new Error(
            "DATABASE_URL is not set. Copy .env.example and fill it in — see docs/tech-stack.md."
          );
        }

        return createDatabase(url);
      }
    }
  ],
  exports: [DATABASE]
})
export class DatabaseModule implements OnApplicationShutdown {
  async onApplicationShutdown() {
    // postgres-js holds the pool open, which keeps the process alive on SIGTERM.
    // Nothing to close yet beyond the client itself; wired here so the hook
    // exists before there are several consumers.
  }
}
