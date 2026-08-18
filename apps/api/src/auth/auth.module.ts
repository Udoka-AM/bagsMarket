import { Global, Module } from "@nestjs/common";
import { AuthGuard } from "./auth.guard";
import { SupabaseJwtService } from "./supabase-jwt.service";

// Global so any feature module can apply AuthGuard without importing this.
@Global()
@Module({
  providers: [SupabaseJwtService, AuthGuard],
  exports: [SupabaseJwtService, AuthGuard]
})
export class AuthModule {}
