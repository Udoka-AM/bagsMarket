import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerModule } from "@nestjs/throttler";
import { AuthModule } from "./auth/auth.module";
import { BagsModule } from "./bags/bags.module";
import { PositionsController } from "./bags/positions.controller";
import { ClaimsModule } from "./claims/claims.module";
import { ProfileThrottlerGuard } from "./common/profile-throttler.guard";
import { DatabaseModule } from "./database/database.module";
import { HealthController } from "./health.controller";
import { JobsModule } from "./jobs/jobs.module";
import { LaunchesModule } from "./launches/launches.module";
import { ProfilesModule } from "./profiles/profiles.module";
import { SignalsModule } from "./signals/signals.module";
import { SolanaModule } from "./solana/solana.module";

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
    // Two windows rather than one: the short burst limit absorbs a double-click
    // or a retry loop, while the longer window is what actually caps sustained
    // abuse. A single limit has to choose between being useless against scripts
    // or hostile to normal use.
    //
    // Configurable because the right numbers depend on deployment — and because
    // the test suite issues bursts no real client would.
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          name: "burst",
          ttl: Number(config.get("THROTTLE_BURST_TTL_MS") ?? 10_000),
          limit: Number(config.get("THROTTLE_BURST_LIMIT") ?? 30)
        },
        {
          name: "sustained",
          ttl: Number(config.get("THROTTLE_SUSTAINED_TTL_MS") ?? 60_000),
          limit: Number(config.get("THROTTLE_SUSTAINED_LIMIT") ?? 200)
        }
      ]
    }),
    DatabaseModule,
    AuthModule,
    BagsModule,
    ProfilesModule,
    LaunchesModule,
    ClaimsModule,
    SignalsModule,
    SolanaModule,
    JobsModule
  ],
  controllers: [HealthController, PositionsController],
  providers: [
    // Applied globally: a new endpoint is rate-limited by default rather than
    // by remembering to decorate it.
    { provide: APP_GUARD, useClass: ProfileThrottlerGuard }
  ]
})
export class AppModule {}
