import { memoryStorage } from "multer";

import { UseInterceptors, applyDecorators } from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";

export function UploadFiles(fieldName = "files", maxCount = 10) {
  return applyDecorators(
    UseInterceptors(
      FilesInterceptor(fieldName, maxCount, {
        storage: memoryStorage(),
        limits: { fileSize: 100 * 1024 * 1024 },
      }),
    ),
  );
}
