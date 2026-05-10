import { HcaptchaException } from "@gvrs/nestjs-hcaptcha";
import { Response as ExpressResponse } from "express";

import { ArgumentsHost, Catch, ExceptionFilter } from "@nestjs/common";

@Catch(HcaptchaException)
export class HcaptchaExceptionFilter implements ExceptionFilter {
  catch(_exception: HcaptchaException, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse<ExpressResponse>();
    const status = 400;

    response.status(status).json({
      statusCode: status,
      message: "Invalid h-captcha-response",
    });
  }
}
