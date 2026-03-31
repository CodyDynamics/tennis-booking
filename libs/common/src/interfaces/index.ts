export interface JwtPayload {
  sub: string;
  email: string;
  roleId?: string;
  /** Unique id for access-token blacklist on logout (Redis). */
  jti?: string;
  iat?: number;
  exp?: number;
}
