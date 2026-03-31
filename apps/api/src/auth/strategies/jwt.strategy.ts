import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Request } from "express";
import { JwtPayload } from "@app/common";
import { User } from "../../users/entities/user.entity";
import { RedisService } from "../../redis/redis.service";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private redisService: RedisService,
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
    if (
      payload.jti &&
      (await this.redisService.isAccessTokenJtiBlacklisted(payload.jti))
    ) {
      throw new UnauthorizedException("Session revoked");
    }

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
      roleId: user.roleId,
      role: user.role?.name ?? null,
      permissions,
    };
  }
}
