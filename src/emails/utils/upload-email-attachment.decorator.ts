import { memoryStorage } from "multer";

import { UseInterceptors, applyDecorators } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBody, ApiConsumes } from "@nestjs/swagger";

export function UploadEmailAttachment() {
  return applyDecorators(
    UseInterceptors(
      FileInterceptor("file", {
        storage: memoryStorage(),
        // Hard ceiling; service enforces EMAIL_ATTACHMENT_MAX_FILE_SIZE.
        limits: { fileSize: 25 * 1024 * 1024 },
      }),
    ),
    ApiConsumes("multipart/form-data"),
    ApiBody({
      schema: {
        type: "object",
        required: ["file"],
        properties: {
          file: {
            type: "string",
            format: "binary",
            description: "Email attachment file",
          },
        },
      },
    }),
  );
}
