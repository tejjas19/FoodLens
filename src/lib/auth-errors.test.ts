import { describe, expect, it } from "vitest";
import { authErrorMessage } from "./auth-errors";

describe("authErrorMessage", () => {
  it("explains a breached password instead of leaving signup looking stuck", () => {
    expect(
      authErrorMessage({
        code: "weak_password",
        message: "Password is known to be weak and easy to guess, please choose a different one.",
      }),
    ).toMatch(/too common/);
  });

  it("sends an existing email to sign in", () => {
    expect(authErrorMessage({ code: "user_already_exists", message: "User already registered" })).toMatch(/Sign in/);
  });

  it("explains that phone signup is unavailable", () => {
    expect(authErrorMessage({ code: "phone_provider_disabled", message: "Unsupported phone provider" })).toMatch(/email/);
  });

  it("keeps an unknown server message", () => {
    expect(authErrorMessage({ message: "Database error saving new user" })).toBe("Database error saving new user");
  });
});
