import { normaliseMobile } from "@/lib/portfolio/mobile";

/**
 * Checks for the sign-up and sign-in forms. Kept apart from the forms so the
 * rules are tested on their own.
 */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Problems with the sign-up details, by field. Empty when they can be sent. */
export function checkSignUp(v: {
  name: string;
  mobile: string;
  email: string;
  password?: string;
  confirm?: string;
}): Record<string, string> {
  const errors: Record<string, string> = {};
  if (v.password !== undefined) {
    // Any password the user chooses; Clerk's own settings decide the minimum.
    if (!v.password) errors.password = "Choose a password.";
    else if (v.confirm !== undefined && v.confirm !== v.password) errors.confirm = "The two passwords do not match.";
  }
  if (v.name.trim().length < 2) errors.name = "Enter your full name.";
  if (!v.mobile.trim()) errors.mobile = "Enter your mobile number.";
  else if (!normaliseMobile(v.mobile)) errors.mobile = "Enter a 10-digit mobile number starting 6–9.";
  if (!v.email.trim()) errors.email = "Enter your email address.";
  else if (!EMAIL.test(v.email.trim())) errors.email = "That email address is not valid.";
  return errors;
}

export function checkEmail(email: string): string | null {
  if (!email.trim()) return "Enter your email address.";
  return EMAIL.test(email.trim()) ? null : "That email address is not valid.";
}

/** A one-time code: six digits. */
export function otpInput(value: string): string {
  return value.replace(/\D/g, "").slice(0, 6);
}
