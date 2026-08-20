import { Global, Logger, Module, type OnApplicationShutdown } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import IORedis, { type Redis } from "ioredis";

export const REDIS = Symbol("REDIS");

@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Redis | null => {
        const url = config.get<string>("REDIS_URL");
        const logger = new Logger("RedisModule");

        if (!url) {
          // Background work is unavailable rather than fatal: the API serves
          // every request without it, and the queue reports the reason.
          logger.warn("REDIS_URL is not set — background jobs are disabled.");
          return null;
        }

        // BullMQ requires this; with the default (20) a blocking command that
        // outlives the retry budget throws instead of waiting.
        const connection = new IORedis(url, { maxRetriesPerRequest: null });

        connection.on("error", (error) => {
          // Logged, not thrown: ioredis reconnects on its own, and an
          // unhandled error event would take the process down over a blip.
          logger.error(`Redis connection error: ${error.message}`);
        });

        return connection;
      }
    }
  ],
  exports: [REDIS]
})
export class RedisModule implements OnApplicationShutdown {
  async onApplicationShutdown() {
    // The connection is closed by the worker's own shutdown hook, which must
    // run first so in-flight jobs are not cut off mid-write.
  }
}
