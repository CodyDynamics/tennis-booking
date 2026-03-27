import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";

/**
 * Allows only JWT users whose role is `admin` or `super_admin`.
 * Use after JwtAuthGuard so `request.user.role` is set.
 */
@Injectable()
export class AdminRoleGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{
      user?: { role?: string };
    }>();
    const role = req.user?.role;
    if (role === "admin" || role === "super_admin") return true;
    throw new ForbiddenException("Admin access required");
  }
}
