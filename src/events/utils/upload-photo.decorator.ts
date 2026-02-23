import { diskStorage } from "multer";
import { existsSync, mkdirSync } from "node:fs";
import { extname } from "node:path/win32";

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
        storage: diskStorage({
          destination: (_request, _file, callback) => {
            const uploadPath = "./uploads/events";
            if (!existsSync(uploadPath)) {
              mkdirSync(uploadPath, { recursive: true });
            }
            callback(null, uploadPath);
          },
          filename: (_request, file, callback) => {
            const now = Date.now().toString();
            const random = Math.round(Math.random() * 1e9).toString();
            const uniqueSuffix = `${now}-${random}`;
            const extension = extname(file.originalname);
            callback(null, `${uniqueSuffix}${extension}`);
          },
        }),
        limits: { fileSize: 10 * 1024 * 1024 },
        fileFilter: (_request, file, callback) => {
          const allowedTypes = ["image/png", "image/jpeg", "image/jpg"];
          if (allowedTypes.includes(file.mimetype)) {
            callback(null, true);
          } else {
            callback(
              new BadRequestException(
                "Invalid file type. Only PNG and JPEG are allowed.",
              ),
              false,
            );
          }
        },
      }),
    ),
  );
}
