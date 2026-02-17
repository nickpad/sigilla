import { z } from "zod/v4";

// Runtime validation for schema compatibility
function validateSchemaCompatibility(schema: z.ZodObject<any>): void {
  for (const [fieldName, fieldSchema] of Object.entries(schema.shape)) {
    validateFieldSchema(fieldName, fieldSchema);
  }
}

function validateFieldSchema(fieldName: string, fieldSchema: any): void {
  // Unwrap modifiers (optional, default, etc.)
  const unwrapped = unwrapModifiers(fieldSchema);

  // Handle arrays
  if (unwrapped instanceof z.ZodArray) {
    const elementType = unwrapModifiers(unwrapped.element);
    validateBaseFieldType(fieldName, elementType, true);
    return;
  }

  // Handle base types
  validateBaseFieldType(fieldName, unwrapped, false);
}

function unwrapModifiers(schema: any): any {
  let current = schema;

  // Keep unwrapping until we get to the base type
  while (true) {
    if (current instanceof z.ZodOptional || current instanceof z.ZodDefault) {
      current = current.def.innerType;
    } else if ((current as any).def?.typeName === "ZodEffects") {
      // Handle coerced types (z.coerce.*)
      current = (current as any).def.schema;
    } else {
      break;
    }
  }

  return current;
}

function validateBaseFieldType(
  fieldName: string,
  fieldSchema: any,
  isArrayElement: boolean,
): void {
  const typeName = fieldSchema.constructor.name;
  const suffix = isArrayElement ? "[] (array element)" : "";

  // Check if it's an allowed type
  const isString = fieldSchema instanceof z.ZodString;
  const isStringFormat = fieldSchema instanceof z.ZodStringFormat;
  const isBoolean = fieldSchema instanceof z.ZodBoolean;
  const isNumber = fieldSchema instanceof z.ZodNumber;
  const isDate = fieldSchema instanceof z.ZodDate;
  const isBigInt = fieldSchema instanceof z.ZodBigInt;

  const isAllowedType =
    isString || isStringFormat || isBoolean || isNumber || isDate || isBigInt;

  if (!isAllowedType) {
    throw new Error(
      `Form field "${fieldName}${suffix}" uses unsupported type "${typeName}". Allowed types are: string, boolean, number, Date, BigInt, and email/URL/other string formats.`,
    );
  }

  // Check if non-string types accept string input
  if (!isString && !isStringFormat) {
    // For non-string types, they must be coerced to accept string input
    const def = (fieldSchema as any).def;
    const isCoerced = def?.coerce || def?.typeName === "ZodEffects";

    if (!isCoerced) {
      const typeDescription = isBoolean
        ? "boolean"
        : isNumber
          ? "number"
          : isDate
            ? "Date"
            : isBigInt
              ? "BigInt"
              : "this type";
      throw new Error(
        `Form field "${fieldName}${suffix}" is a ${typeDescription} but doesn't use coercion. Use z.coerce.${typeDescription.toLowerCase()}() instead of z.${typeDescription.toLowerCase()}() to accept string input from HTML forms.`,
      );
    }
  }
}

export { validateSchemaCompatibility };
