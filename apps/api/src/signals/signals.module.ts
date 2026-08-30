import { Module } from "@nestjs/common";
import { GithubClient } from "./github.client";
import { IngestGithubHandler } from "./handlers/ingest-github.handler";
import { SignalsController } from "./signals.controller";
import { SignalsService } from "./signals.service";

@Module({
  controllers: [SignalsController],
  providers: [SignalsService, GithubClient, IngestGithubHandler],
  exports: [IngestGithubHandler]
})
export class SignalsModule {}
