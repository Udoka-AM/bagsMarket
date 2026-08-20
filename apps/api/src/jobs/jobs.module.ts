import { Module } from "@nestjs/common";
import { JobsController } from "./jobs.controller";
import { JobsQueue } from "./jobs.queue";
import { JobsService } from "./jobs.service";
import { JobsWorker } from "./jobs.worker";
import { ReconcileClaimsHandler } from "./handlers/reconcile-claims.handler";
import { RedisModule } from "./redis.module";

@Module({
  imports: [RedisModule],
  controllers: [JobsController],
  providers: [JobsService, JobsQueue, JobsWorker, ReconcileClaimsHandler],
  exports: [JobsQueue]
})
export class JobsModule {}
