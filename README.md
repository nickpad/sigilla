# Sigilla

<img src="docs/logo.png" alt="Sigilla logo" width="200">

Type-safe form handling for React apps with a tiny, component-less API.

Sigilla helps you parse and validate `FormData` with any [Standard Schema](https://standardschema.dev/) compatible validator, while keeping full control over your markup and UI state.

## Why Sigilla

- Type-safe field access from your schema
- Lightweight API: `newForm`, `validateForm`, `loadForm`
- Component-less by design: bring your own React inputs and patterns
- Works naturally with React Router framework mode (loader/action)
- Supports standard HTML form behavior (checkboxes, repeated fields)

## Install

```bash
pnpm add sigilla
# and a Standard Schema-compatible validator, e.g.:
pnpm add zod
```

## Quick Start

```ts
import { createForm } from "sigilla";
import { z } from "zod/v4";

const schema = z.object({
  email: z.email("Please enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  rememberMe: z.coerce.boolean(),
});

const { validateForm } = createForm(schema);

const formData = new FormData();
formData.set("email", "user@example.com");
formData.set("password", "password123");
formData.set("rememberMe", "on");

const form = await validateForm(formData);

if (form.isNotValid()) {
  console.log(form.error("email"));
  console.log(form.error("password"));
} else {
  const values = form.values();
  // values is fully typed from your schema
  console.log(values.email);
}
```

## React Router Pattern

Sigilla maps cleanly to server-first form flows.

```tsx
import { Form, redirect } from "react-router";
import { createForm } from "sigilla";
import { z } from "zod/v4";

const loginSchema = z.object({
  email: z.email("Invalid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  rememberMe: z.coerce.boolean(),
});

const { newForm, validateForm, loadForm } = createForm(loginSchema);

export async function loader() {
  const form = newForm({ rememberMe: true });
  return { form: form.serialize() };
}

export async function action({ request }: { request: Request }) {
  const formData = await request.formData();
  const form = await validateForm(formData);

  if (form.isNotValid()) {
    return { form: form.serialize() };
  }

  const { email, password, rememberMe } = form.values();
  await signIn(email, password, rememberMe);
  return redirect("/dashboard");
}

export default function LoginRoute({ loaderData, actionData }: any) {
  const form = loadForm(actionData?.form ?? loaderData.form);

  return (
    <Form method="post">
      <label>
        Email
        <input
          name="email"
          type="email"
          defaultValue={form.get("email")}
          aria-invalid={form.isInvalid("email") || undefined}
        />
      </label>
      {form.error("email") && <p>{form.error("email")}</p>}

      <label>
        Password
        <input
          name="password"
          type="password"
          defaultValue={form.get("password")}
          aria-invalid={form.isInvalid("password") || undefined}
        />
      </label>
      {form.error("password") && <p>{form.error("password")}</p>}

      <label>
        <input
          name="rememberMe"
          type="checkbox"
          defaultChecked={form.isTrue("rememberMe")}
        />
        Remember me
      </label>

      {form.allFormErrors().map((message) => (
        <p key={message}>{message}</p>
      ))}

      <button type="submit">Sign in</button>
    </Form>
  );
}
```

## API

### `createForm(schema)`

Creates a typed form utility from a Standard Schema-compatible schema.

Returns:

- `newForm(initialValues?)`
- `validateForm(formData)`
- `loadForm(serializedState)`

### `newForm(initialValues?)`

Create a form instance from optional initial values (useful in loaders and edit forms).

### `validateForm(formData)`

Validates submitted `FormData` and returns a `Promise<FormInstance<T>>`.

### `loadForm(serializedState)`

Hydrates a form instance from a previous `form.serialize()` payload.

### `FormInstance` methods

Field values:

- `get(field)` -> first string value for a field
- `getAll(field)` -> all values for repeated fields (checkbox groups, multi-selects)
- `isTrue(field)` -> boolean-like interpretation of a field

Field and form errors:

- `error(field)` -> first error for a field
- `errors(field)` -> all errors for a field
- `isInvalid(field)` -> whether a field has errors
- `allFormErrors()` -> non-field errors

Mutation helpers:

- `addFieldError(field, message)`
- `addFormError(message)`
- `clear(field)`
- `clearAll()`

Validation state:

- `isValid()`
- `isNotValid()`
- `values()` -> typed parsed output (throws if form is invalid)
- `serialize()` -> plain data for transport between loader/action/component

## Behavior Notes

### Checkbox and boolean semantics

For boolean-like fields:

- Missing field -> `false`
- Empty string -> `false`
- Any other non-empty string -> `true`

This matches common HTML checkbox submission behavior.

### Repeated fields

If a field appears multiple times in `FormData` (for example checkbox groups), use `getAll(field)` to read all submitted values.

### Type coercion

HTML forms submit strings. For non-string schema fields, use coercion in your schema (for example `z.coerce.number()`, `z.coerce.boolean()`, `z.coerce.date()`).

## Advanced Example

```ts
import { createForm } from "sigilla";
import { z } from "zod/v4";

const profileSchema = z.object({
  displayName: z.string().min(1, "Display name is required"),
  age: z.coerce.number().int().min(13, "You must be at least 13"),
  interests: z.array(z.string()).min(1, "Pick at least one interest"),
  newsletter: z.coerce.boolean(),
});

const { validateForm } = createForm(profileSchema);

export async function action({ request }: { request: Request }) {
  const form = await validateForm(await request.formData());

  if (form.isNotValid()) {
    return { ok: false, form: form.serialize() };
  }

  const values = form.values();

  const alreadyTaken = await isDisplayNameTaken(values.displayName);
  if (alreadyTaken) {
    form.addFieldError("displayName", "That display name is unavailable");
    return { ok: false, form: form.serialize() };
  }

  await saveProfile(values);
  return { ok: true };
}
```

## Design Principles

Sigilla is intentionally small and focused:

- No UI components
- No framework lock-in
- No hidden state machines

You keep ownership of rendering, accessibility, and interaction details while still getting predictable, typed validation flow.

## License

MIT
