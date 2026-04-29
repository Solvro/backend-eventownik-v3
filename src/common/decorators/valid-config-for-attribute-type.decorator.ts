import type {
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraintInterface,
} from "class-validator";
import { ValidatorConstraint, registerDecorator } from "class-validator";
import { AttributeType } from "src/generated/prisma/enums";

type ConfigObject = Record<string, unknown>;

function isConfigObject(config: unknown): config is ConfigObject {
  return (
    typeof config === "object" && config !== null && !Array.isArray(config)
  );
}

function getConfigValue(config: ConfigObject, key: string): unknown {
  return config[key];
}

@ValidatorConstraint({ name: "IsConfigValidForAttributeType", async: false })
export class IsConfigValidForAttributeTypeConstraint implements ValidatorConstraintInterface {
  validate(
    config: unknown,
    arguments_?: ValidationArguments,
  ): Promise<boolean> | boolean {
    const type = (arguments_?.object as { type?: AttributeType } | undefined)
      ?.type;

    if (type === AttributeType.select || type === AttributeType.multiSelect) {
      if (!isConfigObject(config)) {
        return false;
      }

      const options = getConfigValue(config, "options");
      if (!Array.isArray(options) || options.length === 0) {
        return false;
      }
      if (
        !options.every(
          (option) => typeof option === "string" && option.trim().length > 0,
        )
      ) {
        return false;
      }

      const allowOther = getConfigValue(config, "allowOther");
      if (allowOther !== undefined && typeof allowOther !== "boolean") {
        return false;
      }

      if (type === AttributeType.multiSelect) {
        const maxSelections = getConfigValue(config, "maxSelections");
        if (maxSelections !== undefined && typeof maxSelections !== "number") {
          return false;
        }
      }

      return true;
    }

    if (type === AttributeType.block) {
      if (config == null) {
        return true;
      }

      if (!isConfigObject(config)) {
        return false;
      }

      const maxSelections = getConfigValue(config, "maxSelections");
      if (maxSelections !== undefined && typeof maxSelections !== "number") {
        return false;
      }

      const participantFields = getConfigValue(config, "participantFields");
      if (
        participantFields !== undefined &&
        (!Array.isArray(participantFields) ||
          !participantFields.every((f) => typeof f === "string"))
      ) {
        return false;
      }

      return true;
    }

    return true;
  }

  defaultMessage?(arguments_?: ValidationArguments): string {
    const type = (arguments_?.object as { type?: AttributeType } | undefined)
      ?.type;
    if (type === AttributeType.select || type === AttributeType.multiSelect) {
      return "Config for select and multiSelect types must include a non-empty options array, and can optionally include allowOther (boolean) and maxSelections (number, only for multiSelect)";
    }

    if (type === AttributeType.block) {
      return "Config for block type can optionally include maxSelections (number) and participantFields (array of attribute uuids as strings)";
    }

    return "Invalid config for the given attribute type";
  }
}

export function IsConfigValidForAttributeType(
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsConfigValidForAttributeTypeConstraint,
    });
  };
}
