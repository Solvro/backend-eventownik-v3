import {
  applyDecorators,
  BadRequestException,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiBody,
  ApiConsumes,
  ApiExtraModels,
  getSchemaPath,
} from "@nestjs/swagger";
import { memoryStorage } from "multer";

import { ParticipantsImportDto } from "../dto/participants-import.dto";

const XLSX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export function ImportParticipants() {
  return applyDecorators(
    UseInterceptors(
      FileInterceptor("participantsFile", {
        storage: memoryStorage(),
        limits: { fileSize: 10 * 1024 * 1024 },
        fileFilter: (_request, file, callback) => {
          if (file.mimetype === XLSX_MIME_TYPE) {
            callback(null, true);
          } else {
            callback(
              new BadRequestException(
                "Invalid file type. Only XLSX is allowed.",
              ),
              false,
            );
          }
        },
      }),
    ),
    ApiConsumes("application/json", "multipart/form-data"),
    ApiExtraModels(ParticipantsImportDto),
    ApiBody({
      schema: {
        oneOf: [
          { $ref: getSchemaPath(ParticipantsImportDto) },
          {
            type: "object",
            required: ["participantsFile"],
            properties: {
              participantsFile: {
                type: "string",
                format: "binary",
                description: "xlsx file with participants (max 10 MB)",
              },
            },
          },
        ],
      },
    }),
  );
}
