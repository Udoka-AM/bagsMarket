import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { HealthController } from "./health.controller";

@Module({
  imports: [
    // Loads .env once and makes ConfigService injectable everywhere without
    // re-importing this module per feature.
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true
    })
  ],
  controllers: [HealthController],
  providers: []
})
export class AppModule {}
