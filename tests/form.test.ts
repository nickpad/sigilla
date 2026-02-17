import { createForm } from "../src/form";
import { describe, expect, it } from "vitest";
import { z } from "zod/v4";

describe("createForm", () => {
  describe("with a simple login schema", () => {
    // Login form schema for testing
    const loginSchema = z.object({
      email: z.email("Invalid email format"),
      password: z.string().min(8, "Password must be at least 8 characters"),
    });

    const { newForm, validateForm } = createForm(loginSchema);

    describe("validateForm", () => {
      it("should parse valid FormData correctly", async () => {
        const formData = new FormData();
        formData.append("email", "user@example.com");
        formData.append("password", "password123");

        const form = await validateForm(formData);

        expect(form.get("email")).toBe("user@example.com");
        expect(form.get("password")).toBe("password123");
        expect(form.isValid()).toBe(true);
        expect(form.error("email")).toBeUndefined();
        expect(form.error("password")).toBeUndefined();
      });

      it("should handle invalid email in FormData", async () => {
        const formData = new FormData();
        formData.append("email", "invalid-email");
        formData.append("password", "password123");

        const form = await validateForm(formData);

        expect(form.get("email")).toBe("invalid-email");
        expect(form.get("password")).toBe("password123");
        expect(form.isValid()).toBe(false);
        expect(form.error("email")).toBe("Invalid email format");
        expect(form.error("password")).toBeUndefined();
      });

      it("should handle short password in FormData", async () => {
        const formData = new FormData();
        formData.append("email", "user@example.com");
        formData.append("password", "123");

        const form = await validateForm(formData);

        expect(form.get("email")).toBe("user@example.com");
        expect(form.get("password")).toBe("123");
        expect(form.isValid()).toBe(false);
        expect(form.error("email")).toBeUndefined();
        expect(form.error("password")).toBe(
          "Password must be at least 8 characters",
        );
      });

      it("should handle empty FormData", async () => {
        const formData = new FormData();

        const form = await validateForm(formData);

        expect(form.get("email")).toBe("");
        expect(form.get("password")).toBe("");
        expect(form.isValid()).toBe(false);
        expect(form.error("email")).toBe("Invalid email format");
        expect(form.error("password")).toContain("Invalid input");
      });

      it("should handle FormData with missing fields", async () => {
        const formData = new FormData();
        formData.append("email", "user@example.com");
        // password is missing

        const form = await validateForm(formData);

        expect(form.get("email")).toBe("user@example.com");
        expect(form.get("password")).toBe("");
        expect(form.isValid()).toBe(false);
        expect(form.error("email")).toBeUndefined();
        expect(form.error("password")).toContain("Invalid input");
      });

      it("should handle FormData with extra fields", async () => {
        const formData = new FormData();
        formData.append("email", "user@example.com");
        formData.append("password", "password123");
        formData.append("extraField", "should be ignored");

        const form = await validateForm(formData);

        expect(form.get("email")).toBe("user@example.com");
        expect(form.get("password")).toBe("password123");
        expect(form.isValid()).toBe(true);
      });

      it("should handle multiple field errors", async () => {
        const formData = new FormData();
        formData.set("email", "invalid-email");
        formData.set("password", "123");

        const form = await validateForm(formData);

        expect(form.isValid()).toBe(false);
        expect(form.error("email")).toBe("Invalid email format");
        expect(form.error("password")).toBe(
          "Password must be at least 8 characters",
        );
      });

      it("handles list of values", async () => {
        const formData = new FormData();
        formData.append("mealOptions", "chicken");
        formData.append("mealOptions", "beef");
        formData.append("mealOptions", "omelette");
        const { validateForm } = createForm(
          z.object({
            mealOptions: z.array(z.string()).min(1).max(3),
          }),
        );

        const form = await validateForm(formData);

        expect(form.isValid()).toBe(true);
        expect(form.getAll("mealOptions")).toEqual([
          "chicken",
          "beef",
          "omelette",
        ]);
      });
    });

    describe("newForm", () => {
      it("should parse valid object correctly", async () => {
        const data = {
          email: "user@example.com",
          password: "password123",
        };

        const form = newForm(data);

        expect(form.get("email")).toBe("user@example.com");
        expect(form.get("password")).toBe("password123");
        expect(form.error("email")).toBeUndefined();
        expect(form.error("password")).toBeUndefined();
      });

      it("should handle empty object", async () => {
        const data = {};

        const form = newForm(data);

        expect(form.get("email")).toBe("");
        expect(form.get("password")).toBe("");
        expect(form.error("email")).toBeUndefined();
        expect(form.error("password")).toBeUndefined();
      });
    });
  });

  describe("with more strict schema", () => {
    const strictSchema = z.object({
      email: z.email("Invalid email format").min(3, "Email is required"),
      password: z.string().min(8, "Password must be at least 8 characters"),
    });

    const { validateForm } = createForm(strictSchema);

    it("should return all errors for a field", async () => {
      const formData = new FormData();
      formData.append("email", "x");
      formData.append("password", "123");

      const form = await validateForm(formData);

      expect(form.errors("email")).toEqual([
        "Invalid email format",
        "Email is required",
      ]);
      expect(form.errors("password")).toEqual([
        "Password must be at least 8 characters",
      ]);
    });
  });

  describe("with mixed field types", () => {
    const mixedSchema = z.object({
      name: z.string().min(1, "Name is required"),
      age: z.coerce.number().min(0, "Age must be positive"),
      tags: z.array(z.string()).min(1, "At least one tag required"),
      active: z.coerce.boolean(),
      newsletter: z.coerce.boolean(),
    });

    const { newForm, validateForm } = createForm(mixedSchema);

    it("should handle mixed types correctly in newForm", async () => {
      const form = newForm({
        name: "John",
        active: true,
      });

      expect(form.get("name")).toBe("John");
      expect(form.get("age")).toBe(""); // string default
      expect(form.getAll("tags")).toEqual([]); // array default
      expect(form.isTrue("active")).toBe(true); // provided boolean
      expect(form.isTrue("newsletter")).toBe(false); // boolean default
    });

    it("should handle mixed types in FormData validation", async () => {
      const formData = new FormData();
      formData.append("name", "Jane");
      formData.append("age", "25");
      formData.append("tags", "work");
      formData.append("tags", "typescript");
      formData.append("active", "true");
      // newsletter not included (should be false)

      const form = await validateForm(formData);

      expect(form.get("name")).toBe("Jane");
      expect(form.get("age")).toBe("25"); // Coerced to number
      expect(form.getAll("tags")).toEqual(["work", "typescript"]);
      expect(form.isTrue("active")).toBe(true);
      expect(form.isTrue("newsletter")).toBe(false);
    });
  });

  describe("boolean field handling", () => {
    const booleanSchema = z.object({
      email: z.email("Invalid email format"),
      newsletter: z.coerce.boolean(),
      terms: z.coerce.boolean(),
    });

    const { newForm, validateForm } = createForm(booleanSchema);

    it("should handle boolean field with non-empty value as true", async () => {
      const formData = new FormData();
      formData.append("email", "user@example.com");
      formData.append("newsletter", "on");
      formData.append("terms", "true");

      const form = await validateForm(formData);

      expect(form.get("email")).toBe("user@example.com");
      expect(form.isTrue("newsletter")).toBe(true);
      expect(form.isTrue("terms")).toBe(true);
      expect(form.isValid()).toBe(true);
    });

    it("should handle boolean field with empty string as false", async () => {
      const formData = new FormData();
      formData.append("email", "user@example.com");
      formData.append("newsletter", "");
      formData.append("terms", "on");

      const form = await validateForm(formData);

      expect(form.isTrue("newsletter")).toBe(false);
      expect(form.isValid()).toBe(true);
    });

    it("should handle missing boolean field as false", async () => {
      const formData = new FormData();
      formData.append("email", "user@example.com");
      // newsletter and terms are missing

      const form = await validateForm(formData);

      expect(form.isTrue("newsletter")).toBe(false);
      expect(form.isTrue("terms")).toBe(false);
      expect(form.isValid()).toBe(true);
    });

    it("should initialize boolean fields correctly in newForm", async () => {
      const form = newForm({
        email: "user@example.com",
        newsletter: true,
      });

      expect(form.get("email")).toBe("user@example.com");
      expect(form.isTrue("newsletter")).toBe(true);
      expect(form.isTrue("terms")).toBe(false); // default value
    });

    it("should clear boolean fields to false", async () => {
      const formData = new FormData();
      formData.append("email", "user@example.com");
      formData.append("newsletter", "on");
      formData.append("terms", "true");

      const form = await validateForm(formData);
      expect(form.isTrue("newsletter")).toBe(true);

      form.clear("newsletter");
      expect(form.isTrue("newsletter")).toBe(false);
    });

    it("should handle checkbox-like behavior", async () => {
      const formData = new FormData();
      formData.append("email", "user@example.com");
      // Checkbox checked: value present
      formData.append("newsletter", "1");
      // Checkbox unchecked: value not present (missing from FormData)

      const form = await validateForm(formData);

      expect(form.get("email")).toBe("user@example.com");
      expect(form.isTrue("newsletter")).toBe(true); // has value "1"
      expect(form.isTrue("terms")).toBe(false); // missing from FormData
      expect(form.isValid()).toBe(true);
    });

    it("should handle various truthy string values as true", async () => {
      const testCases = [
        "on",
        "1",
        "true",
        "yes",
        "checked",
        "any-non-empty-string",
      ];

      for (const value of testCases) {
        const formData = new FormData();
        formData.append("email", "user@example.com");
        formData.append("newsletter", value);

        const form = await validateForm(formData);

        expect(form.isTrue("newsletter")).toBe(true);
        expect(form.isValid()).toBe(true);
      }
    });

    it("should handle clearAll with boolean fields", async () => {
      const formData = new FormData();
      formData.append("email", "user@example.com");
      formData.append("newsletter", "on");
      formData.append("terms", "true");

      const form = await validateForm(formData);
      expect(form.isTrue("newsletter")).toBe(true);
      expect(form.isTrue("terms")).toBe(true);

      form.clearAll();
      expect(form.get("email")).toBe("");
      expect(form.isTrue("newsletter")).toBe(false);
      expect(form.isTrue("terms")).toBe(false);
    });
  });

  describe("addFieldError", () => {
    const testSchema = z.object({
      username: z.string().min(3, "Username too short"),
      email: z.email("Invalid email"),
      age: z.coerce.number().min(18, "Must be 18 or older"),
    });

    const { newForm } = createForm(testSchema);

    it("should add error to field with no existing errors", async () => {
      const form = newForm({ username: "test", email: "test@example.com" });

      form.addFieldError("username", "Username already taken");

      expect(form.error("username")).toBe("Username already taken");
      expect(form.errors("username")).toEqual(["Username already taken"]);
      expect(form.isInvalid("username")).toBe(true);
      expect(form.isValid()).toBe(false);
    });

    it("should add multiple errors to the same field", async () => {
      const form = newForm({ username: "test" });

      form.addFieldError("username", "First error");
      form.addFieldError("username", "Second error");
      form.addFieldError("username", "Third error");

      expect(form.error("username")).toBe("First error"); // returns first error
      expect(form.errors("username")).toEqual([
        "First error",
        "Second error",
        "Third error",
      ]);
      expect(form.isInvalid("username")).toBe(true);
    });

    it("should add errors to multiple different fields", async () => {
      const form = newForm();

      form.addFieldError("username", "Username error");
      form.addFieldError("email", "Email error");
      form.addFieldError("age", "Age error");

      expect(form.error("username")).toBe("Username error");
      expect(form.error("email")).toBe("Email error");
      expect(form.error("age")).toBe("Age error");
      expect(form.isValid()).toBe(false);
    });

    it("should handle adding errors to fields that already have validation errors", async () => {
      const formData = new FormData();
      formData.append("username", "x"); // too short, will cause validation error
      formData.append("email", "invalid-email"); // invalid email

      const { validateForm } = createForm(testSchema);
      const form = await validateForm(formData);

      // Form already has validation errors
      expect(form.errors("username")).toEqual(["Username too short"]);
      expect(form.errors("email")).toEqual(["Invalid email"]);

      // Add custom errors on top of validation errors
      form.addFieldError("username", "Custom username error");
      form.addFieldError("email", "Custom email error");

      expect(form.errors("username")).toEqual([
        "Username too short",
        "Custom username error",
      ]);
      expect(form.errors("email")).toEqual([
        "Invalid email",
        "Custom email error",
      ]);
    });

    it("should maintain field error state after clearing and re-adding", async () => {
      const form = newForm();

      form.addFieldError("username", "Initial error");
      expect(form.isInvalid("username")).toBe(true);

      form.clear("username");
      expect(form.isInvalid("username")).toBe(false);
      expect(form.errors("username")).toEqual([]);

      form.addFieldError("username", "New error after clear");
      expect(form.error("username")).toBe("New error after clear");
      expect(form.isInvalid("username")).toBe(true);
    });

    it("should not affect other fields when adding errors", async () => {
      const form = newForm({ username: "valid", email: "test@example.com" });

      form.addFieldError("username", "Username error");

      expect(form.error("username")).toBe("Username error");
      expect(form.error("email")).toBeUndefined();
      expect(form.error("age")).toBeUndefined();
      expect(form.isInvalid("username")).toBe(true);
      expect(form.isInvalid("email")).toBe(false);
      expect(form.isInvalid("age")).toBe(false);
    });

    it("should allow empty string as error message", async () => {
      const form = newForm();

      form.addFieldError("username", "");

      expect(form.error("username")).toBe("");
      expect(form.errors("username")).toEqual([""]);
      expect(form.isInvalid("username")).toBe(true);
    });

    it("should handle special characters and unicode in error messages", async () => {
      const form = newForm();

      const specialMessage = "Error with émojis 🚫 and spëcial chārs!";
      form.addFieldError("username", specialMessage);

      expect(form.error("username")).toBe(specialMessage);
      expect(form.errors("username")).toEqual([specialMessage]);
    });
  });

  describe("values() method", () => {
    const userSchema = z.object({
      name: z.string().min(1, "Name is required"),
      email: z.email("Invalid email format"),
      age: z.coerce.number().min(18, "Must be 18 or older"),
      tags: z.array(z.string()).optional(),
      newsletter: z.coerce.boolean(),
    });

    const { validateForm } = createForm(userSchema);

    it("should return validated values when form is valid", async () => {
      const formData = new FormData();
      formData.append("name", "John Doe");
      formData.append("email", "john@example.com");
      formData.append("age", "25");
      formData.append("tags", "typescript");
      formData.append("tags", "react");
      formData.append("newsletter", "true");

      const form = await validateForm(formData);

      expect(form.isValid()).toBe(true);
      const values = form.values();
      expect(values).toEqual({
        name: "John Doe",
        email: "john@example.com",
        age: 25,
        tags: ["typescript", "react"],
        newsletter: true,
      });
    });

    it("should throw error when form is invalid", async () => {
      const formData = new FormData();
      formData.append("name", "");
      formData.append("email", "invalid-email");
      formData.append("age", "15");

      const form = await validateForm(formData);

      expect(form.isValid()).toBe(false);
      expect(() => form.values()).toThrow(
        "Cannot get values from invalid form",
      );
    });
  });
});
