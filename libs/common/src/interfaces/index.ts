export interface JwtPayload {
  sub: string;
  email: string;
  organizationId?: string;
  roleId?: string;
  iat?: number;
  exp?: number;
}
