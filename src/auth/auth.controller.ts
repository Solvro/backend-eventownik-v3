import {
  Body,
  Controller,
  Get,
  Post,
  Request,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import {
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
import { LoginDto } from "./dto/login.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { RegisterDto } from "./dto/register.dto";
import { TokenResponseDto } from "./dto/token-response.dto";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { AuthUser } from "./jwt.strategy";

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  constructor(private authService: AuthService) {}

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
  async login(@Body() body: LoginDto): Promise<TokenResponseDto> {
    const user = await this.authService.validateUser(body.email, body.password);
    if (user === null) {
      throw new UnauthorizedException("Invalid credentials");
    }
    return this.authService.login(user);
  }

  @Post("refresh")
  @ApiOperation({ summary: "Refresh Access Token" })
  @ApiOkResponse({
    description: "New JWT Access Token and Refresh Token",
    type: TokenResponseDto,
  })
  @ApiUnauthorizedResponse({ description: "Invalid or expired refresh token" })
  async refresh(@Body() body: RefreshTokenDto): Promise<TokenResponseDto> {
    return this.authService.refreshTokens(body.refresh_token);
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get current authenticated user profile" })
  @ApiOkResponse({ description: "Current user information", type: AdminDto })
  @ApiUnauthorizedResponse({ description: "Unauthorized" })
  getMe(@Request() request: { user: AuthUser }): AdminDto {
    const {
      password: _password,
      permissions: _permissions,
      ...user
    } = request.user;
    return user;
  }
}
