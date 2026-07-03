import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";

import { AuthService } from "./auth.service";
import { AdminDto } from "./dto/auth-user.dto";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { TokenResponseDto } from "./dto/token-response.dto";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { AuthUser } from "./jwt.strategy";
import { Request, Response } from "express";
import { ConfigService } from "@nestjs/config";

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
  ) {}

  @Post("register")
  @ApiOperation({ summary: "Register new admin" })
  @ApiCreatedResponse({
    description: "User registered successfully",
    type: AdminDto,
  })
  @ApiConflictResponse({ description: "Email already in use" })
  async register(@Body() body: RegisterDto): Promise<AdminDto> {
    return this.authService.register(body);
  }

  @Post("login")
  @ApiOperation({ summary: "Login with email and password" })
  @ApiOkResponse({
    description: "JWT Access and Refresh Tokens",
    type: TokenResponseDto,
  })
  @ApiUnauthorizedResponse({ description: "Invalid credentials" })
  async login(
    @Body() body: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<TokenResponseDto> {
    const user = await this.authService.validateUser(body.email, body.password);
    if (user === null) {
      throw new UnauthorizedException("Invalid credentials");
    }
    const { access_token, refresh_token } = await this.authService.login(user);

    response.cookie("refresh_token", refresh_token, {
      httpOnly: true,
      secure:
        this.configService.getOrThrow<string>("NODE_ENV") === "production",
      sameSite: "strict",
      maxAge:
        this.configService.getOrThrow<number>("REFRESH_TOKEN_TTL_DAYS") *
        24 *
        60 *
        60 *
        1000,
      domain: this.configService.getOrThrow<string>("APP_DOMAIN"),
      path: "/api/v3/auth",
    });

    return { access_token };
  }

  @Post("refresh")
  @ApiOperation({ summary: "Refresh Access Token" })
  @ApiOkResponse({
    description: "New JWT Access Token and Refresh Token",
    type: TokenResponseDto,
  })
  @ApiUnauthorizedResponse({ description: "Invalid or expired refresh token" })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<TokenResponseDto> {
    const oldToken = request.cookies.refresh_token as string | undefined;
    if (oldToken === undefined || oldToken === "") {
      throw new UnauthorizedException("Invalid refresh token");
    }
    const { access_token, refresh_token } =
      await this.authService.refreshTokens(oldToken);

    response.cookie("refresh_token", refresh_token, {
      httpOnly: true,
      secure:
        this.configService.getOrThrow<string>("NODE_ENV") === "production",
      sameSite: "strict",
      maxAge:
        this.configService.getOrThrow<number>("REFRESH_TOKEN_TTL_DAYS") *
        24 *
        60 *
        60 *
        1000,
      domain: this.configService.getOrThrow<string>("APP_DOMAIN"),
      path: "/api/v3/auth",
    });

    return { access_token };
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get current authenticated user profile" })
  @ApiOkResponse({ description: "Current user information", type: AdminDto })
  @ApiUnauthorizedResponse({ description: "Unauthorized" })
  getMe(@Req() request: { user: AuthUser }): AdminDto {
    const {
      password: _password,
      permissions: _permissions,
      ...user
    } = request.user;
    return user;
  }

  @Post("forgot-password")
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    description: "If the email exists, a reset link has been sent",
  })
  @ApiBadRequestResponse({
    description: "Validation error (invalid email)",
  })
  @ApiOperation({ summary: "Generate password reset token and send an email" })
  async forgotPassword(@Body() body: ForgotPasswordDto) {
    await this.authService.forgotPassword(body.email);
    return {
      message: "If the email exists, a reset link has been sent",
    };
  }

  @Post("reset-password")
  @HttpCode(HttpStatus.OK)
  @ApiBadRequestResponse({
    description:
      "Validation error (password didn't meet criteria, token does not exist/expired)",
  })
  @ApiOkResponse({
    description: "Password has been reset",
  })
  @ApiOperation({ summary: "Resets a password" })
  async resetPassword(@Body() body: ResetPasswordDto) {
    await this.authService.resetPassword(body.token, body.password);
    return {
      message: "Password has been reset",
    };
  }

  @Post("logout")
  @ApiOperation({ summary: "Logs out a user" })
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    description: "Logged out",
  })
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken = request.cookies.refresh_token as string | undefined;

    response.clearCookie("refresh_token", {
      httpOnly: true,
      secure:
        this.configService.getOrThrow<string>("NODE_ENV") === "production",
      sameSite: "strict",
      domain: this.configService.getOrThrow<string>("APP_DOMAIN"),
      path: "/api/v3/auth",
    });
    if (refreshToken !== undefined && refreshToken !== "") {
      return await this.authService.logout(refreshToken);
    }

    return { message: "Logged out successfully!" };
  }
}
