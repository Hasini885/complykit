import { Suspense } from "react";
import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { OtpSignIn } from "@/components/auth/otp-sign-in";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <AuthShell mode="sign-in">
      <Suspense>
        <OtpSignIn />
      </Suspense>
    </AuthShell>
  );
}
