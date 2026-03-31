/** Permission codes for RBAC: resource:action. Only super_admin has full access; others get permissions from role. */
export const PERMISSION_RESOURCES = [
  { resource: "dashboard", label: "Overview", actions: ["view"] as const },
  { resource: "courts", label: "Courts", actions: ["view", "create", "update", "delete"] as const },
  { resource: "users", label: "Users", actions: ["view", "create", "update", "delete"] as const },
  { resource: "memberships", label: "User Membership", actions: ["view", "create", "update", "delete"] as const },
  { resource: "roles", label: "Roles & Permissions", actions: ["view", "update"] as const },
  { resource: "locations", label: "Locations", actions: ["view", "create", "update", "delete"] as const },
  { resource: "areas", label: "Areas", actions: ["view", "create", "update", "delete"] as const },
  { resource: "sports", label: "Sports", actions: ["view", "create", "update", "delete"] as const },
  { resource: "branches", label: "Branches", actions: ["view", "create", "update", "delete"] as const },
  { resource: "organizations", label: "Organizations", actions: ["view", "create", "update", "delete"] as const },
  { resource: "bookings", label: "Bookings", actions: ["view", "create", "update", "cancel"] as const },
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
