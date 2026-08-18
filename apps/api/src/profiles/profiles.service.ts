import { Inject, Injectable } from "@nestjs/common";
import { eq, profiles, type Database } from "@bagsmarkets/db";
import type { Profile } from "@bagsmarkets/types";
import type { AuthenticatedUser } from "../auth/supabase-jwt.service";
import { DATABASE } from "../database/database.module";

@Injectable()
export class ProfilesService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  /**
   * Returns the caller's profile, creating it on first sign-in.
   *
   * Supabase owns `auth.users` and creates the row when a wallet signs in; it
   * knows nothing about our `profiles` table. Rather than a database trigger on
   * a table we do not own, the profile is materialised the first time an
   * authenticated request arrives.
   *
   * `onConflictDoNothing` makes this safe against the realistic race: a client
   * firing several requests immediately after sign-in, all finding no profile.
   */
  async ensure(user: AuthenticatedUser): Promise<Profile> {
    await this.db.insert(profiles).values({ id: user.id }).onConflictDoNothing();

    const [row] = await this.db.select().from(profiles).where(eq(profiles.id, user.id)).limit(1);

    return {
      id: row.id,
      handle: row.handle,
      displayName: row.displayName,
      avatarUrl: row.avatarUrl,
      createdAt: row.createdAt.toISOString()
    };
  }
}
