import {
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  registerDecorator,
} from "class-validator";
import { AttributeType } from "src/generated/prisma/enums";

@ValidatorConstraint({ name: "IsConfigValidForAttributeType", async: false })
export class IsConfigValidForAttributeTypeConstraint implements ValidatorConstraintInterface {
  validate(
    config: any,
    args?: ValidationArguments,
  ): Promise<boolean> | boolean {
    const object = args?.object as any;
    const type = object.type as AttributeType;

    if (!config) {
      return true;
    }

    switch (type) {
      case AttributeType.select:
      case AttributeType.multiSelect:
        if (!Array.isArray(config.options) || config.options.length === 0) {
          return false;
        }
        if (
          config.allowOther !== undefined &&
          typeof config.allowOther !== "boolean"
        ) {
          return false;
        }
        if (
          type == AttributeType.multiSelect &&
          config.maxSelections !== undefined &&
          typeof config.maxSelections !== "number"
        ) {
          return false;
        }
        return true;
      case AttributeType.block:
        if (
          config.maxSelections !== undefined &&
          typeof config.maxSelections !== "number"
        ) {
          return false;
        }
        return true;
      // TODO: we can add more specific validations for other types if needed in the futurte (like file types, max file size, etc.)
      default:
        return true;
    }
  }
  defaultMessage?(args?: ValidationArguments): string {
    const type = (args?.object as any)?.type;
    switch (type) {
      case AttributeType.select:
      case AttributeType.multiSelect:
        return "Config for select and multiSelect types must include a non-empty options array, and can optionally include allowOther (boolean) and maxSelections (number, only for multiSelect)";
      case AttributeType.block:
        return "Config for block type can optionally include maxSelections (number)";
      default:
        return "Invalid config for the given attribute type";
    }
  }
}

export function IsConfigValidForAttributeType(
  validationOptions?: ValidationOptions,
) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsConfigValidForAttributeTypeConstraint,
    });
  };
}
