import { Controller, Get, UseGuards } from "@nestjs/common";
import type { Profile } from "@bagsmarkets/types";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/supabase-jwt.service";
import { ProfilesService } from "./profiles.service";

@Controller("me")
@UseGuards(AuthGuard)
export class ProfilesController {
  constructor(private readonly profiles: ProfilesService) {}

  /**
   * The web app calls this immediately after sign-in: it both proves the token
   * is good and guarantees a profile row exists before anything tries to
   * reference it by foreign key.
   */
  @Get()
  async me(@CurrentUser() user: AuthenticatedUser): Promise<Profile> {
    return this.profiles.ensure(user);
  }
}
