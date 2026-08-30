import { Global, Module } from "@nestjs/common";
import { JobsController } from "./jobs.controller";
import { JobsQueue } from "./jobs.queue";
import { JobsService } from "./jobs.service";
import { JobsWorker } from "./jobs.worker";
import { ReconcileClaimsHandler } from "./handlers/reconcile-claims.handler";
import { SignalsModule } from "../signals/signals.module";
import { RedisModule } from "./redis.module";

/**
 * Global so feature modules can enqueue work without importing this.
 *
 * That is what keeps the graph acyclic: JobsModule imports SignalsModule to
 * reach its handler, and SignalsModule reaches JobsQueue through the global
 * scope rather than importing back.
 */
@Global()
@Module({
  imports: [RedisModule, SignalsModule],
  controllers: [JobsController],
  providers: [JobsService, JobsQueue, JobsWorker, ReconcileClaimsHandler],
  exports: [JobsQueue]
})
export class JobsModule {}
