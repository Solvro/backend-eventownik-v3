import { TokenResponseDto } from "src/auth/dto/token-response.dto";

import { Body, Controller, Post } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
} from "@nestjs/swagger";

import {
  CodeVerificationRequestDTO,
  CodeVerificationResponseDTO,
} from "./dto/code-verification-rquest.dto";
import { RequestLoginCodeRequestDTO } from "./dto/request-code-request.dto";
import { RequestLoginCodeResponseDTO } from "./dto/request-code-response.dto";
import { ParticipantsAuthService } from "./participants-auth.service";

@ApiTags("Participants Auth")
@Controller("participants-auth")
export class ParticipantsAuthController {
  constructor(
    private readonly participantsAuthService: ParticipantsAuthService,
  ) {}

  @Post("request-code")
  @ApiOperation({ summary: "Request a login code" })
  @ApiOkResponse({ type: RequestLoginCodeResponseDTO })
  @ApiBadRequestResponse({ description: "Email is not correct" })
  @ApiTooManyRequestsResponse({ description: "Rate limit exceeded" })
  async requestCode(
    @Body() requestLoginCodeRequestDTO: RequestLoginCodeRequestDTO,
  ) {
    await this.participantsAuthService.sendLoginCode(
      requestLoginCodeRequestDTO,
    );

    return {
      message: "If this email is registered, a login code has been sent.",
    };
  }

  @Post("verify-code")
  @ApiOperation({ summary: "Validate a login code" })
  @ApiOkResponse({ type: TokenResponseDto })
  async vrifyCode(
    @Body() codeVerificationRequestDTO: CodeVerificationRequestDTO,
  ) {
    return await this.participantsAuthService.vrifyCode(
      codeVerificationRequestDTO,
    );
  }

  // @Post("refresh")
  // async refresh() {}
  //
  // @Post("logout")
  // async logout() {}
}
