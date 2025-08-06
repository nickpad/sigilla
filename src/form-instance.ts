import { z } from "zod/v4";

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

export { FormInstance, type FormState };
