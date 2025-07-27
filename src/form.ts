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

interface FormState<T> {
  formData: Partial<Record<keyof T, string | string[]>>;
  fieldErrors: Partial<Record<keyof T, string[]>>;
  formErrors: string[];
}

class FormInstance<T> {
  private readonly formState: FormState<T>;

  constructor(state: FormState<T>) {
    this.formState = state;
  }

  get<K extends keyof T>(field: K): string {
    const value = this.formState.formData[field];
    if (!value) return "";
    if (typeof value === "string") {
      return value;
    }
    return value[0];
  }

  getAll<K extends keyof T>(field: K): string[] {
    const value = this.formState.formData[field];
    if (!value) return [];
    if (typeof value === "string") {
      return [value];
    }
    return value;
  }

  isTrue<K extends keyof T>(field: K): boolean {
    const value = this.get(field);
    if (!value) return false;
    const result = z.coerce.boolean().safeParse(value);
    return result.success;
  }

  error<K extends keyof T>(field: K): string | undefined {
    return this.formState.fieldErrors[field]?.[0];
  }

  errors<K extends keyof T>(field: K): string[] {
    return this.formState.fieldErrors[field] || [];
  }

  isInvalid<K extends keyof T>(field: K): boolean {
    const fieldErrors = this.formState.fieldErrors[field] || [];
    return fieldErrors.length > 0;
  }

  addFormError(msg: string): void {
    this.formState.formErrors.push(msg);
  }

  addFieldError<K extends keyof T>(field: K, msg: string): void {
    if (!this.formState.fieldErrors[field]) {
      this.formState.fieldErrors[field] = [];
    }
    this.formState.fieldErrors[field].push(msg);
  }

  clear<K extends keyof T>(field: K): void {
    this.formState.formData[field] = "";
    this.formState.fieldErrors[field] = [];
  }

  clearAll(): void {
    const fields = new Set<keyof T>();
    for (const field in this.formState.formData) {
      fields.add(field as keyof T);
    }
    for (const field in this.formState.fieldErrors) {
      fields.add(field as keyof T);
    }
    for (const field of fields) {
      this.clear(field);
    }
  }

  allFormErrors(): string[] {
    return this.formState.formErrors;
  }

  isValid(): boolean {
    return (
      this.formState.formErrors.length === 0 &&
      !(Object.values(this.formState.fieldErrors) as string[][]).some(
        (errors) => errors.length > 0,
      )
    );
  }

  isNotValid(): boolean {
    return !this.isValid();
  }

  serialize(): FormState<T> {
    return this.formState;
  }
}

/**
 * Creates a form utility with validation based on a Zod schema.
 *
 * Returns three functions for managing form state in React Router apps:
 * - `newForm()`: Creates a new form instance with optional initial values (use in loaders)
 * - `validateForm()`: Validates FormData from form submissions (use in actions)
 * - `loadForm()`: Loads a form from serialized state (use in components)
 *
 * ## Boolean Field Handling
 *
 * Boolean fields in the schema are automatically handled for HTML form compatibility:
 * - Missing field in FormData → `false` (unchecked checkbox)
 * - Empty string in FormData → `false` (unchecked checkbox with empty value)
 * - Any non-empty string → `true` (checked checkbox with any value like "on", "1", "true")
 *
 * @param schema - Zod schema defining the form structure and validation rules
 * @returns Object containing newForm, validateForm, and loadForm functions
 *
 * @example
 * ```ts
 * // Define your form schema
 * const loginSchema = z.object({
 *   email: z.email("Invalid email format"),
 *   password: z.string().min(8, "Password must be at least 8 characters"),
 *   rememberMe: z.boolean(), // Boolean field
 * });
 *
 * const { newForm, validateForm, loadForm } = createForm(loginSchema);
 *
 * // In a loader (GET request - initialize form)
 * export async function loader() {
 *   const form = newForm({ email: "user@example.com", rememberMe: true }); // Optional initial values
 *   return { form: form.serialize() };
 * }
 *
 * // In an action (POST request - handle form submission)
 * export async function action({ request }: Route.ActionArgs) {
 *   const formData = await request.formData();
 *   const form = validateForm(formData);
 *
 *   if (form.isNotValid()) {
 *     return { form: form.serialize() }; // Return with errors
 *   }
 *
 *   // Form is valid, proceed with business logic
 *   const email = form.value("email"); // Type: string
 *   const password = form.value("password"); // Type: string
 *   const rememberMe = form.value("rememberMe"); // Type: boolean
 *   // ... authenticate user
 *
 *   return redirect("/dashboard");
 * }
 *
 * // In a route component (render form)
 * export default function LoginRoute({ loaderData, actionData }: Route.ComponentProps) {
 *   // Use form from action if available (has validation errors), otherwise from loader
 *   const form = loadForm(actionData?.form || loaderData.form);
 *
 *   return (
 *     <Form method="post">
 *       <input
 *         name="email"
 *         defaultValue={form.value("email")} // Type: string
 *         aria-invalid={form.error("email") ? true : undefined}
 *       />
 *       {form.error("email") && <span>{form.error("email")}</span>}
 *
 *       <input
 *         name="password"
 *         type="password"
 *         defaultValue={form.value("password")} // Type: string
 *         aria-invalid={form.error("password") ? true : undefined}
 *       />
 *       {form.error("password") && <span>{form.error("password")}</span>}
 *
 *       <input
 *         name="rememberMe"
 *         type="checkbox"
 *         defaultChecked={form.value("rememberMe")} // Type: boolean
 *         aria-invalid={form.error("rememberMe") ? true : undefined}
 *       />
 *       <label htmlFor="rememberMe">Remember me</label>
 *       {form.error("rememberMe") && <span>{form.error("rememberMe")}</span>}
 *
 *       <button type="submit">Login</button>
 *     </Form>
 *   );
 * }
 * ```
 *
 * @example
 * ```ts
 * // Example with array and boolean fields
 * const surveySchema = z.object({
 *   name: z.string().min(1, "Name is required"),
 *   interests: z.array(z.string()).min(1, "Select at least one interest"),
 *   newsletter: z.boolean(), // Subscribe to newsletter
 *   terms: z.boolean(), // Accept terms and conditions
 * });
 *
 * const { validateForm } = createForm(surveySchema);
 *
 * // In an action
 * export async function action({ request }: Route.ActionArgs) {
 *   const formData = await request.formData();
 *   // FormData might contain:
 *   // name="John", interests="coding", interests="music", newsletter="on"
 *   // Note: terms checkbox not checked, so no value in FormData (interpreted as false)
 *   const form = validateForm(formData);
 *
 *   if (form.isValid()) {
 *     const name = form.value("name"); // Type: string
 *     const interests = form.value("interests"); // Type: string[]
 *     const newsletter = form.value("newsletter"); // Type: boolean (true - "on" is truthy)
 *     const terms = form.value("terms"); // Type: boolean (false - missing from FormData)
 *   }
 * }
 * ```
 */
export function createForm<T extends z.ZodObject<any>>(schema: T) {
  // Validate schema compatibility at runtime
  validateSchemaCompatibility(schema);

  type SchemaType = z.infer<T>;

  const newForm = (initialValues?: Partial<SchemaType>) => {
    const formData: Partial<Record<keyof SchemaType, string | string[]>> = {};

    // Convert initialValues to FormData-compatible string representations
    if (initialValues) {
      for (const [field, value] of Object.entries(initialValues)) {
        const fieldKey = field as keyof SchemaType;

        if (value === undefined || value === null) {
          continue;
        }

        if (Array.isArray(value)) {
          // Convert array elements to strings
          formData[fieldKey] = value.map((item) =>
            item === null || item === undefined ? "" : item.toString(),
          );
        } else {
          // Convert single value to string
          formData[fieldKey] = value.toString();
        }
      }
    }

    return new FormInstance<SchemaType>({
      formData,
      fieldErrors: {},
      formErrors: [],
    });
  };

  const validateForm = (formData: FormData): FormInstance<SchemaType> => {
    const state: FormState<SchemaType> = {
      formData: {},
      fieldErrors: {},
      formErrors: [],
    };

    // Populate with FormData
    for (const field of Object.keys(schema.shape)) {
      const fieldKey = field as keyof SchemaType;
      const fieldSchema = schema.shape[field];

      if (fieldSchema instanceof z.ZodArray) {
        state.formData[fieldKey] = formData
          .getAll(field)
          .map((item) => item.toString());
      } else {
        state.formData[fieldKey] = formData.get(field)?.toString() || "";
      }
    }

    // Validate
    const parsed = schema.safeParse(state.formData);

    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        if (issue.path.length === 0) {
          state.formErrors.push(issue.message);
        } else {
          const field = issue.path[0] as keyof SchemaType;
          state.fieldErrors[field] ||= [];
          state.fieldErrors[field].push(issue.message);
        }
      }
    }

    return new FormInstance<SchemaType>(state);
  };

  const loadForm = (
    serializedState: FormState<SchemaType>,
  ): FormInstance<SchemaType> => {
    return new FormInstance<SchemaType>(serializedState);
  };

  return { newForm, validateForm, loadForm } as const;
}

export { FormInstance, type FormState };
