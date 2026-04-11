import { diskStorage } from "multer";
import { existsSync, mkdirSync } from "node:fs";
// eslint-disable-next-line unicorn/import-style
import { extname } from "node:path";

import { UseInterceptors, applyDecorators } from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";

export function UploadFiles(fieldName = "files", maxCount = 10) {
  return applyDecorators(
    UseInterceptors(
      FilesInterceptor(fieldName, maxCount, {
        storage: diskStorage({
          destination: (_request, _file, callback) => {
            const eventId = _request.params.eventId;
            const formId = _request.params.id;

            const uploadPath = `./uploads/forms/${eventId}/${formId}`;
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
        limits: { fileSize: 100 * 1024 * 1024 },
      }),
    ),
  );
}
