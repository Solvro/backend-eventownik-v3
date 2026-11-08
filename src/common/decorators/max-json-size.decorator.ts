import type {
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraintInterface,
} from "class-validator";
import { ValidatorConstraint, registerDecorator } from "class-validator";

@ValidatorConstraint({ name: "MaxJsonSize", async: false })
export class MaxJsonSizeConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, arguments_: ValidationArguments): boolean {
    if (value == null) {
      return true;
    }

    const [maxBytes] = arguments_.constraints as [number];
    return JSON.stringify(value).length <= maxBytes;
  }

  defaultMessage(arguments_: ValidationArguments): string {
    const [maxBytes] = arguments_.constraints as [number];
    return `${arguments_.property} must not exceed ${String(maxBytes)} bytes when serialized as JSON`;
  }
}

export function MaxJsonSize(
  maxBytes: number,
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [maxBytes],
      validator: MaxJsonSizeConstraint,
    });
  };
}
