import { memoryStorage } from "multer";

import type { Type } from "@nestjs/common";
import {
  BadRequestException,
  UseInterceptors,
  applyDecorators,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiBody,
  ApiConsumes,
  ApiExtraModels,
  getSchemaPath,
} from "@nestjs/swagger";

export function UploadPhoto(bodyDto: Type<unknown>) {
  return applyDecorators(
    UseInterceptors(
      FileInterceptor("photo", {
        storage: memoryStorage(),
        limits: { fileSize: 10 * 1024 * 1024 },
        fileFilter: (_request, file, callback) => {
          const allowedTypes = [
            "image/png",
            "image/jpeg",
            "image/jpg",
            "image/gif",
          ];
          if (allowedTypes.includes(file.mimetype)) {
            callback(null, true);
          } else {
            callback(
              new BadRequestException(
                "Invalid file type. Only PNG, JPG, JPEG, and GIF are allowed.",
              ),
              false,
            );
          }
        },
      }),
    ),
    ApiConsumes("multipart/form-data"),
    ApiExtraModels(bodyDto),
    ApiBody({
      schema: {
        allOf: [
          { $ref: getSchemaPath(bodyDto) },
          {
            type: "object",
            properties: {
              photo: {
                type: "string",
                format: "binary",
                description: "Event photo (PNG, JPG, JPEG or GIF, max 10 MB)",
              },
            },
          },
        ],
      },
    }),
  );
}
