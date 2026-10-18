export type AuthErrorLike = {
  message?: string | undefined;
  code?: string | undefined;
};

export function authErrorMessage(error: AuthErrorLike | null | undefined): string {
  const code = error?.code ?? "";
  const message = error?.message?.trim() ?? "";

  if (code === "weak_password" || /weak and easy to guess|known to be weak/i.test(message)) {
    return "That password is too common and was rejected. Use at least 8 characters that you don't use on other sites — a short unique phrase works well.";
  }

  if (code === "user_already_exists" || /already registered|already exists/i.test(message)) {
    return "An account with this email already exists. Use Sign in with the same password.";
  }

  if (code === "phone_provider_disabled" || /unsupported phone provider|phone provider/i.test(message)) {
    return "Phone sign-up isn't turned on for this project. Create an account with email instead.";
  }

  if (code === "over_request_rate_limit" || /rate limit/i.test(message)) {
    return "Too many attempts. Wait a minute, then try again.";
  }

  return message || "Something went wrong. Please try again.";
}
