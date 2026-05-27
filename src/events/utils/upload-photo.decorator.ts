import { memoryStorage } from "multer";

import {
  BadRequestException,
  UseInterceptors,
  applyDecorators,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";

export function UploadPhoto() {
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
  );
}
