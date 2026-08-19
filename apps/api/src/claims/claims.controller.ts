import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common";
import type { Claim, ClaimDraft, Paginated } from "@bagsmarkets/types";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/supabase-jwt.service";
import { ClaimsService } from "./claims.service";

type StartClaimBody = { tokenMint?: unknown };
type RecordSignatureBody = { signature?: unknown };

@Controller("claims")
@UseGuards(AuthGuard)
export class ClaimsController {
  constructor(private readonly claims: ClaimsService) {}

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser): Promise<Paginated<Claim>> {
    const items = await this.claims.listForProfile(user.id);
    return { items, nextCursor: null };
  }

  /**
   * Starts a claim and returns unsigned transactions.
   *
   * 200 rather than 201: this creates a pending record, but the thing the
   * caller cares about is not finished until their wallet signs and the
   * signature comes back.
   */
  @Post()
  @HttpCode(200)
  async start(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: StartClaimBody
  ): Promise<ClaimDraft> {
    // Hand-checked rather than trusted: there is no global validation pipe yet,
    // and a body is the one input a caller fully controls.
    const tokenMint = typeof body?.tokenMint === "string" ? body.tokenMint : "";
    return this.claims.start(user.id, tokenMint);
  }

  @Post(":id/signature")
  @HttpCode(200)
  async recordSignature(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: RecordSignatureBody
  ): Promise<Claim> {
    const signature = typeof body?.signature === "string" ? body.signature : "";
    return this.claims.recordSignature(user.id, id, signature);
  }
}
