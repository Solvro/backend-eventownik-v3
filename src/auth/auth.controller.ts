import { Request, Response } from "express";
import { Public } from "nest-keycloak-connect";

import { Controller, Get, Post, Req, Res, UseGuards } from "@nestjs/common";

import { SessionAuthGuard } from "./guards/session-auth.guard";
import { SessionService } from "./session.service";
import { AuthenticatedUser } from "./types/keycloak.types";

@Controller("auth")
export class AuthController {
  constructor(private readonly sessionService: SessionService) {}

  @Get("login")
  @Public()
  @UseGuards(SessionAuthGuard)
  async login(): Promise<void> {
    // Passport will handle the redirect to Keycloak
  }

  @Get("callback")
  @Public()
  @UseGuards(SessionAuthGuard)
  async callback(@Res() res: Response): Promise<void> {
    // Session is already stored by the strategy
    res.redirect(`http://localhost:3000/auth/profile`);
  }

  @Post("logout")
  async logout(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.sessionService.clearSession(req);
    res.json({ message: "Logged out successfully" });
  }

  @Get("profile")
  @UseGuards(SessionAuthGuard)
  getProfile(@Req() req: Request): AuthenticatedUser {
    if (req.user == null) {
      throw new Error("User not authenticated");
    }
    return req.user;
  }

  @Get("token")
  @UseGuards(SessionAuthGuard)
  getToken(@Req() req: Request): { accessToken: string } {
    const accessToken = this.sessionService.getAccessToken(req);

    if (accessToken == null) {
      throw new Error("No access token found");
    }

    return { accessToken };
  }

  @Get("session-status")
  @Public()
  getSessionStatus(@Req() req: Request): {
    hasSession: boolean;
    hasToken: boolean;
    user: Partial<AuthenticatedUser> | null;
  } {
    const user = this.sessionService.getUser(req);
    const accessToken = this.sessionService.getAccessToken(req);

    return {
      hasSession: Boolean(req.session.user),
      hasToken: Boolean(accessToken),
      user:
        user == null
          ? null
          : {
              id: user.id,
              username: user.username,
              email: user.email,
            },
    };
  }
}
