import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { DatabaseModule } from "./database/database.module";
import { HealthController } from "./health.controller";
import { JobsModule } from "./jobs/jobs.module";

@Module({
  imports: [
    // Loads .env once and makes ConfigService injectable everywhere without
    // re-importing this module per feature.
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      // The repo keeps one env file at the root rather than one per app, so the
      // API reads the same file the web app does.
      envFilePath: ["../../.env.local", "../../.env"]
    }),
    DatabaseModule,
    JobsModule
  ],
  controllers: [HealthController],
  providers: []
})
export class AppModule {}
