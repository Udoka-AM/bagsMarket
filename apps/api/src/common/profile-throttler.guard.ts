import { Injectable, type ExecutionContext } from "@nestjs/common";
import { ThrottlerGuard, type ThrottlerLimitDetail } from "@nestjs/throttler";
import type { Response } from "express";
import type { RequestWithUser } from "../auth/auth.guard";

@Injectable()
export class ProfileThrottlerGuard extends ThrottlerGuard {
  /**
   * Rate-limit key: client IP.
   *
   * Keying on the authenticated profile would be better — a shared NAT
   * throttles unrelated users together, and one account rotating addresses
   * evades an IP limit. It is not possible here: this runs as an APP_GUARD, and
   * global guards execute *before* route-level ones, so AuthGuard has not
   * attached `req.user` yet.
   *
   * Reading the token here without verifying it would be worse than useless —
   * `sub` would be attacker-controlled, so anyone could mint a fresh bucket per
   * request by editing it.
   *
   * Moving to per-profile limits means verifying the token twice, or applying
   * the throttler after AuthGuard per controller and losing the "limited by
   * default" property. IP is the honest choice until one of those earns its
   * cost.
   */
  protected async getTracker(req: RequestWithUser): Promise<string> {
    return req.ip ?? "unknown";
  }

  /**
   * Adds a standard `Retry-After` alongside the library's own header.
   *
   * Named throttlers make it emit `Retry-After-burst` / `Retry-After-sustained`,
   * which nothing off-the-shelf understands — HTTP clients, proxies and SDK
   * retry logic all look for plain `Retry-After`. The names are worth keeping
   * for targeting individual windows, so the plain header is added rather than
   * the names dropped.
   */
  protected async throwThrottlingException(
    context: ExecutionContext,
    detail: ThrottlerLimitDetail
  ): Promise<void> {
    const response = context.switchToHttp().getResponse<Response>();

    // Seconds, rounded up: advertising 0 would invite an immediate retry.
    response.header("Retry-After", String(Math.max(1, Math.ceil(detail.timeToBlockExpire))));

    return super.throwThrottlingException(context, detail);
  }
}
