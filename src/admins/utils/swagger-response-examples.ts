import { PageDto } from "src/common/dto/page.dto";

import { getSchemaPath } from "@nestjs/swagger";

import { Admin } from "../entities/admin.entity";

export const createAdminBadRequestResponse = {
  description: "Invalid input data.",
  content: {
    "application/json": {
      example: {
        statusCode: 400,
        message: [
          "email must be an email",
          "password must be longer than or equal to 8 characters",
        ],
        error: "Bad Request",
      },
    },
  },
};

export const adminForbiddenResponse = {
  description: "Invalid account type.",
  content: {
    "application/json": {
      example: {
        statusCode: 403,
        message:
          "Superadmin privileges and an active account are required to perform this action.",
        error: "Forbidden",
      },
    },
  },
};

export const adminConflictResponse = {
  description: "Unique field constraint violated.",
  content: {
    "application/json": {
      example: {
        statusCode: 409,
        message: "Admin with the same email already exists.",
        error: "Conflict",
      },
    },
  },
};

export const listAdminResponse = {
  description: "Returns list of admins.",
  schema: {
    allOf: [
      { $ref: getSchemaPath(PageDto) },
      {
        properties: {
          data: {
            type: "array",
            items: { $ref: getSchemaPath(Admin) },
          },
        },
      },
    ],
  },
};

export const adminNotFoundResponse = {
  description: "Admin was not found.",
  content: {
    "application/json": {
      example: {
        statusCode: 404,
        message: "Admin with given ID was not found.",
        error: "Not Found",
      },
    },
  },
};
