import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import type { Request } from "express";
import { SupabaseJwtService, type AuthenticatedUser } from "./supabase-jwt.service";

export type RequestWithUser = Request & { user?: AuthenticatedUser };

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly jwt: SupabaseJwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const header = request.headers.authorization;

    if (!header?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing bearer token");
    }

    // Verified payload is attached to the request so handlers read an identity
    // that has already been checked, rather than re-parsing the header.
    request.user = await this.jwt.verify(header.slice("Bearer ".length).trim());

    return true;
  }
}
