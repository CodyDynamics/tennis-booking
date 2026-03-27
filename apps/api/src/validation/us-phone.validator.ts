import {
  registerDecorator,
  ValidationOptions,
} from "class-validator";
import { parsePhoneNumberFromString } from "libphonenumber-js";

/** Validates a US phone number using libphonenumber-js. */
export function isValidUsPhone(raw: string): boolean {
  const phone = parsePhoneNumberFromString(raw || "", "US");
  return !!phone && phone.country === "US" && phone.isValid();
}

export function IsUsPhone(
  _allowedAreaCodes: string[] = [],
  validationOptions?: ValidationOptions,
) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: "isUsPhone",
      target: object.constructor,
      propertyName,
      constraints: [_allowedAreaCodes],
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          if (value === undefined || value === null || value === "") return true;
          return typeof value === "string" && isValidUsPhone(value);
        },
      },
    });
  };
}
