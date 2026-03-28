/** How the account was provisioned / lifecycle (directory + registration rules). */
export enum UserAccountType {
  /** Staff / seeded / admin-created operator accounts */
  SYSTEM = "system",
  /** Self-registered via /register with no pre-existing membership row */
  NORMAL = "normal",
  /** Pre-added membership list (no password until user completes /register OTP) */
  MEMBERSHIP = "membership",
}
