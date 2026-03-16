import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { REQUIRE_PERMISSION_KEY } from "../decorators/require-permission.decorator";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string>(REQUIRE_PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as { role?: string; permissions?: string[] } | undefined;
    if (!user) throw new ForbiddenException("Not authenticated");

    if (user.role === "admin") return true;
    const hasPermission = user.permissions?.includes(required) ?? false;
    if (!hasPermission) {
      throw new ForbiddenException(`Missing permission: ${required}`);
    }
    return true;
  }
}
