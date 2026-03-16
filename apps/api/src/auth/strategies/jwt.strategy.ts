import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Request } from "express";
import { JwtPayload } from "@app/common";
import { User } from "../../users/entities/user.entity";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => {
          const name = configService.get<string>("cookie.accessTokenName", "access_token");
          return req?.cookies?.[name] ?? null;
        },
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>("jwt.secret"),
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.userRepo.findOne({
      where: { id: payload.sub },
      relations: ["role"],
    });

    if (!user || user.status !== "active") {
      throw new UnauthorizedException("User not found or inactive");
    }

    const permissions: string[] = user.role?.permissions
      ? String(user.role.permissions)
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean)
      : [];

    return {
      id: user.id,
      email: user.email,
      organizationId: user.organizationId,
      branchId: user.branchId,
      roleId: user.roleId,
      role: user.role.name,
      permissions,
    };
  }
}
