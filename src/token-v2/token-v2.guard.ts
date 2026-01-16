import { Request } from "express";
import { Base64 } from "js-base64";
import { createHash } from "node:crypto";
import { PrismaService } from "src/prisma/prisma.service";

import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from "@nestjs/common";

const tokenPrefix = "oat_";

@Injectable()
export class TokenV2Guard implements CanActivate {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    const bearerToken = request.headers.authorization;

    if (typeof bearerToken !== "string") {
      return false;
    }

    if (!bearerToken.startsWith(tokenPrefix)) {
      return false;
    }

    const token = bearerToken.slice(tokenPrefix.length);

    const [identifier, ...tokenValue] = token.split(".");
    if (!identifier || tokenValue.length === 0) {
      return false;
    }

    const decodedIdentifier = Number(Base64.decode(identifier));
    const decodedSecret = Base64.decode(tokenValue.join("."));
    if (Number.isNaN(decodedIdentifier) || !decodedSecret) {
      return false;
    }
    const newHash = createHash("sha256").update(decodedSecret).digest("hex");

    const accessToken = await this.prisma.authAccessToken.findFirst({
      where: { id: decodedIdentifier },
    });

    if (accessToken === null) {
      return false;
    }

    return accessToken.hash === newHash;
  }
}
