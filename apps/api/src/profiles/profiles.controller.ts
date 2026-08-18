import { Controller, Get, UseGuards } from "@nestjs/common";
import type { Me } from "@bagsmarkets/types";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/supabase-jwt.service";
import { ProfilesService } from "./profiles.service";

@Controller("me")
@UseGuards(AuthGuard)
export class ProfilesController {
  constructor(private readonly profiles: ProfilesService) {}

  /**
   * The (app) layout calls this on every authenticated page load: it proves the
   * token is good and guarantees a profile row exists before anything tries to
   * reference it by foreign key. Cheap enough to call every time, and it means
   * there is no sign-in path that can leave a user without a profile.
   */
  @Get()
  async me(@CurrentUser() user: AuthenticatedUser): Promise<Me> {
    return this.profiles.ensure(user);
  }
}
