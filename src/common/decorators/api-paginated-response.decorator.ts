import type { Type } from "@nestjs/common";
import { applyDecorators } from "@nestjs/common";
import { ApiExtraModels, ApiOkResponse, getSchemaPath } from "@nestjs/swagger";

import { PageDto } from "../dto/page.dto";

export const ApiPaginatedResponse = (model: Type) => {
  return applyDecorators(
    ApiExtraModels(PageDto, model),
    ApiOkResponse({
      description: "Paginated list of entities",
      schema: {
        allOf: [
          { $ref: getSchemaPath(PageDto) },
          {
            properties: {
              data: {
                type: "array",
                items: { $ref: getSchemaPath(model) },
              },
            },
          },
        ],
      },
    }),
  );
};
