import { Global, Inject, Module, type OnApplicationShutdown } from "@nestjs/common";
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
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  /**
   * Closes the connection pool.
   *
   * postgres-js keeps sockets open, and an open socket keeps the Node event
   * loop alive — so without this the process never exits on SIGTERM and the
   * platform escalates to SIGKILL (exit 137), cutting off whatever was still
   * running.
   */
  async onApplicationShutdown() {
    // A few seconds for in-flight queries, then close regardless: a deploy
    // will not wait forever, and a stuck query should not block the rollout.
    await this.db.$client.end({ timeout: 5 });
  }
}
