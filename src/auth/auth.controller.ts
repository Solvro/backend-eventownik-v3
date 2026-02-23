import { Body, Controller, Post, UnauthorizedException } from "@nestjs/common";
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";

import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post("register")
  @ApiOperation({ summary: "Register" })
  @ApiCreatedResponse({ description: "User registered successfully" })
  async register(@Body() body: RegisterDto) {
    return this.authService.register(body);
  }

  @Post("login")
  @ApiOperation({ summary: "Login" })
  @ApiOkResponse({ description: "JWT Token" })
  async login(@Body() body: LoginDto) {
    const user = await this.authService.validateUser(body.email, body.password);
    if (user === null) {
      throw new UnauthorizedException();
    }
    return this.authService.login(user);
  }

  @Post("refresh")
  @ApiOperation({ summary: "Refresh Token" })
  @ApiOkResponse({ description: "New JWT Access Token and Refresh Token" })
  async refresh(@Body() body: { refresh_token: string }) {
    return this.authService.refreshTokens(body.refresh_token);
  }
}
