// Standard Schema interface types
interface StandardSchemaV1<Input = unknown, Output = Input> {
  readonly "~standard": StandardSchemaV1.Props<Input, Output>;
}

namespace StandardSchemaV1 {
  export interface Props<Input = unknown, Output = Input> {
    readonly version: 1;
    readonly vendor: string;
    readonly validate: (
      value: unknown,
    ) => Result<Output> | Promise<Result<Output>>;
    readonly types?: Types<Input, Output> | undefined;
  }

  export type Result<Output> = SuccessResult<Output> | FailureResult;

  export interface SuccessResult<Output> {
    readonly value: Output;
    readonly issues?: undefined;
  }

  export interface FailureResult {
    readonly issues: ReadonlyArray<Issue>;
  }

  export interface Issue {
    readonly message: string;
    readonly path?: ReadonlyArray<PropertyKey | PathSegment> | undefined;
  }

  export interface PathSegment {
    readonly key: PropertyKey;
  }

  export interface Types<Input = unknown, Output = Input> {
    readonly input: Input;
    readonly output: Output;
  }

  export type InferInput<Schema extends StandardSchemaV1> = NonNullable<
    Schema["~standard"]["types"]
  >["input"];

  export type InferOutput<Schema extends StandardSchemaV1> = NonNullable<
    Schema["~standard"]["types"]
  >["output"];
}

type FormStateRecord = Record<string, string | string[]>;
type FieldErrors<T> = Partial<Record<keyof T, string[]>>;

interface FormState<T> {
  record: FormStateRecord;
  fieldErrors: FieldErrors<T>;
  formErrors: string[];
}

class FormInstance<T> {
  private readonly formState: FormState<T>;
  private readonly validationResult?: StandardSchemaV1.Result<T>;

  constructor(
    state: FormState<T>,
    validationResult?: StandardSchemaV1.Result<T>,
  ) {
    this.formState = state;
    this.validationResult = validationResult;
  }

  get<K extends keyof T>(field: K): string {
    const value = this.formState.record[field as string];
    if (!value) return "";
    if (typeof value === "string") {
      return value;
    }
    return value[0];
  }

  getAll<K extends keyof T>(field: K): string[] {
    const value = this.formState.record[field as string];
    if (!value) return [];
    if (typeof value === "string") {
      return [value];
    }
    return value;
  }

  isTrue<K extends keyof T>(field: K): boolean {
    const value = this.get(field);
    if (!value) return false;

    // Convert string values to boolean following HTML form conventions
    const lowerValue = value.toLowerCase();
    return lowerValue !== "" && lowerValue !== "false" && lowerValue !== "0";
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
    this.formState.record[field as string] = "";
    this.formState.fieldErrors[field] = [];
  }

  clearAll(): void {
    const fields = new Set<keyof T>();
    for (const field in this.formState.record) {
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

  values(): T {
    if (!this.validationResult || this.validationResult.issues) {
      throw new Error("Cannot get values from invalid form");
    }
    return this.validationResult.value;
  }

  serialize(): FormState<T> {
    return this.formState;
  }
}

function toFormObject(formData: FormData): FormStateRecord {
  const result: FormStateRecord = {};

  for (const key of formData.keys()) {
    const values = formData.getAll(key);
    result[key] =
      values.length === 1
        ? values[0].toString()
        : values.map((value) => value.toString());
  }

  return result;
}

/**
 * Creates a form utility with validation based on any Standard Schema compliant schema.
 *
 * Returns functions for managing form state in React Router apps:
 * - `newForm()`: Creates a new form instance with optional initial values (use in loaders)
 * - `validateForm()`: Validates FormData from form submissions (use in actions) - returns Promise
 * - `loadForm()`: Loads a form from serialized state (use in components)
 *
 * ## Boolean Field Handling
 *
 * Boolean fields in the schema are automatically handled for HTML form compatibility:
 * - Missing field in FormData → `false` (unchecked checkbox)
 * - Empty string in FormData → `false` (unchecked checkbox with empty value)
 * - Any non-empty string → `true` (checked checkbox with any value like "on", "1", "true")
 *
 * @param schema - Any schema implementing Standard Schema interface
 * @returns Object containing newForm, validateForm, and loadForm functions
 *
 * @example
 * ```ts
 * // Define your form schema (example with any Standard Schema compliant library)
 * // This could be Zod, Valibot, ArkType, Effect Schema, etc.
 * const loginSchema = createLoginSchema(); // Your schema creation function
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
 *   const form = await validateForm(formData); // Always returns Promise
 *
 *   if (form.isNotValid()) {
 *     return { form: form.serialize() }; // Return with errors
 *   }
 *
 *   // Form is valid, proceed with business logic
 *   const email = form.get("email"); // Get field value as string
 *   const password = form.get("password"); // Get field value as string
 *   const rememberMe = form.isTrue("rememberMe"); // Get boolean field
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
 *         defaultValue={form.get("email")}
 *         aria-invalid={form.error("email") ? true : undefined}
 *       />
 *       {form.error("email") && <span>{form.error("email")}</span>}
 *
 *       <input
 *         name="password"
 *         type="password"
 *         defaultValue={form.get("password")}
 *         aria-invalid={form.error("password") ? true : undefined}
 *       />
 *       {form.error("password") && <span>{form.error("password")}</span>}
 *
 *       <input
 *         name="rememberMe"
 *         type="checkbox"
 *         defaultChecked={form.isTrue("rememberMe")}
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
 * const surveySchema = createSurveySchema(); // Your Standard Schema compliant schema
 *
 * const { validateForm } = createForm(surveySchema);
 *
 * // In an action
 * export async function action({ request }: Route.ActionArgs) {
 *   const formData = await request.formData();
 *   // FormData might contain:
 *   // name="John", interests="coding", interests="music", newsletter="on"
 *   // Note: terms checkbox not checked, so no value in FormData (interpreted as false)
 *   const form = await validateForm(formData); // Always async
 *
 *   if (form.isValid()) {
 *     const name = form.get("name"); // Get string value
 *     const interests = form.getAll("interests"); // Get array of strings
 *     const newsletter = form.isTrue("newsletter"); // true - "on" is truthy
 *     const terms = form.isTrue("terms"); // false - missing from FormData
 *   }
 * }
 * ```
 */
function createForm<T extends StandardSchemaV1>(schema: T) {
  type SchemaType = StandardSchemaV1.InferOutput<T>;

  const newForm = (initialValues?: Partial<SchemaType>) => {
    let formData: FormStateRecord = {};

    if (initialValues) {
      for (const [key, value] of Object.entries(initialValues)) {
        if (Array.isArray(value)) {
          formData[key] = value.map((item) => item.toString());
        } else {
          formData[key] = value ? String(value) : "";
        }
      }
    }

    return new FormInstance<SchemaType>({
      record: formData,
      fieldErrors: {},
      formErrors: [],
    });
  };

  const validateForm = async (
    formData: FormData,
  ): Promise<FormInstance<SchemaType>> => {
    const record = toFormObject(formData);
    const result = await schema["~standard"].validate(record);

    const fieldErrors: FieldErrors<SchemaType> = {};
    const formErrors: string[] = [];

    if (result.issues) {
      for (const issue of result.issues) {
        if (!issue.path || issue.path.length === 0) {
          formErrors.push(issue.message);
        } else {
          const field = issue.path[0] as keyof SchemaType;
          fieldErrors[field] ||= [];
          fieldErrors[field].push(issue.message);
        }
      }
    }

    return new FormInstance<SchemaType>(
      { record, fieldErrors, formErrors },
      result,
    );
  };

  const loadForm = (
    serializedState: FormState<SchemaType>,
  ): FormInstance<SchemaType> => {
    return new FormInstance<SchemaType>(serializedState);
  };

  return { newForm, validateForm, loadForm } as const;
}

export { createForm, FormInstance, type FormState };
