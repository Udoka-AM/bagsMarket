import { Inject, Injectable } from "@nestjs/common";
import { asc, eq, profiles, wallets, type Database } from "@bagsmarkets/db";
import type { Me } from "@bagsmarkets/types";
import type { AuthenticatedUser } from "../auth/supabase-jwt.service";
import { DATABASE } from "../database/database.module";

@Injectable()
export class ProfilesService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  /**
   * Returns the caller's profile and wallets, creating both on first sign-in.
   *
   * Supabase owns `auth.users` and creates the row when a wallet signs in; it
   * knows nothing about our `profiles` table. Rather than a database trigger on
   * a table we do not own, the profile is materialised the first time an
   * authenticated request arrives.
   *
   * `onConflictDoNothing` on both inserts makes this safe against the realistic
   * race: a client firing several requests at once right after sign-in, all
   * finding nothing there yet.
   */
  async ensure(user: AuthenticatedUser): Promise<Me> {
    await this.db.insert(profiles).values({ id: user.id }).onConflictDoNothing();

    // A web3 session proves ownership of the signing address by definition —
    // Supabase already verified the signature against it — so the wallet is
    // recorded as primary and verified rather than pending.
    if (user.walletAddress) {
      await this.db
        .insert(wallets)
        .values({
          profileId: user.id,
          address: user.walletAddress,
          isPrimary: true,
          verifiedAt: new Date()
        })
        .onConflictDoNothing();
    }

    const [profile] = await this.db
      .select()
      .from(profiles)
      .where(eq(profiles.id, user.id))
      .limit(1);

    const linked = await this.db
      .select()
      .from(wallets)
      .where(eq(wallets.profileId, user.id))
      .orderBy(asc(wallets.createdAt));

    return {
      profile: {
        id: profile.id,
        handle: profile.handle,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
        createdAt: profile.createdAt.toISOString()
      },
      wallets: linked.map((row) => ({
        id: row.id,
        address: row.address,
        label: row.label,
        isPrimary: row.isPrimary,
        verifiedAt: row.verifiedAt?.toISOString() ?? null
      }))
    };
  }
}
