import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "./auth/auth.module";
import { DatabaseModule } from "./database/database.module";
import { HealthController } from "./health.controller";
import { JobsModule } from "./jobs/jobs.module";
import { LaunchesModule } from "./launches/launches.module";
import { ProfilesModule } from "./profiles/profiles.module";

@Module({
  imports: [
    // Loads .env once and makes ConfigService injectable everywhere without
    // re-importing this module per feature.
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      // Tests set their own environment. Loading the developer's .env.local
      // would point the suite at the real Supabase project and the real
      // database — so the file is ignored under test, deliberately.
      ignoreEnvFile: process.env.NODE_ENV === "test",
      // The repo keeps one env file at the root rather than one per app, so the
      // API reads the same file the web app does.
      envFilePath: ["../../.env.local", "../../.env"]
    }),
    DatabaseModule,
    AuthModule,
    ProfilesModule,
    LaunchesModule,
    JobsModule
  ],
  controllers: [HealthController],
  providers: []
})
export class AppModule {}
