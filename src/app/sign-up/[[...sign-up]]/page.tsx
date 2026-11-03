import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { OtpSignUp } from "@/components/auth/otp-sign-up";

export const metadata: Metadata = { title: "Create account" };

export default function SignUpPage() {
  return (
    <AuthShell mode="sign-up">
      <OtpSignUp />
    </AuthShell>
  );
}
