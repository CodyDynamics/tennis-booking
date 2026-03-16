/** Permission codes for RBAC: resource:action */
export const PERMISSION_RESOURCES = [
  { resource: "courts", label: "Courts", actions: ["view", "create", "update", "delete"] as const },
  { resource: "users", label: "Users", actions: ["view", "create", "update", "delete"] as const },
  { resource: "roles", label: "Roles & Permissions", actions: ["view", "update"] as const },
  { resource: "branches", label: "Branches", actions: ["view", "create", "update", "delete"] as const },
  { resource: "bookings", label: "Bookings", actions: ["view", "create", "cancel"] as const },
] as const;

export function getAllPermissionCodes(): string[] {
  const codes: string[] = [];
  for (const { resource, actions } of PERMISSION_RESOURCES) {
    for (const action of actions) {
      codes.push(`${resource}:${action}`);
    }
  }
  return codes;
}
