import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { AuthenticatedUser } from "./supabase-jwt.service";
import type { RequestWithUser } from "./auth.guard";

/**
 * Reads the user that AuthGuard attached.
 *
 * Only valid on routes behind AuthGuard — without it there is no user on the
 * request and this returns undefined, so the guard is what makes the type
 * honest.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    return request.user!;
  }
);
