import { ExtractJwt, Strategy } from "passport-jwt";
import { Admin, PermissionType } from "src/generated/prisma/client";

import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";

import { PrismaService } from "../prisma/prisma.service";

export interface JwtPayload {
  email: string;
  sub: string;
}

export interface AuthUser extends Admin {
  permissions: {
    eventId: string;
    permission: PermissionType;
  }[];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>("JWT_SECRET"),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    const user = await this.prisma.admin.findUnique({
      where: { uuid: payload.sub },
      include: {
        permissions: true,
      },
    });

    if (user === null) throw new UnauthorizedException();

    const { password, ...result } = user;

    return {
      ...result,
      permissions: user.permissions.map((p) => ({
        eventId: p.eventUuid,
        permission: p.permission,
      })),
    } as AuthUser;
  }
}
