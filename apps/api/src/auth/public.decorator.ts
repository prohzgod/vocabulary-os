import { SetMetadata, createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { User } from "@vocab-os/shared";

export const IS_PUBLIC = "isPublic";

/** Skips the global AuthGuard for this route. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** The signed-in user, set on the request by AuthGuard. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): User => context.switchToHttp().getRequest().user
);
