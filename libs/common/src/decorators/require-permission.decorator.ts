import { SetMetadata } from "@nestjs/common";

export const REQUIRE_PERMISSION_KEY = "requirePermission";

/**
 * Require a specific permission (e.g. courts:create) to access the route.
 * Use together with PermissionsGuard. Admin role bypasses the check.
 */
export const RequirePermission = (permission: string) =>
  SetMetadata(REQUIRE_PERMISSION_KEY, permission);
