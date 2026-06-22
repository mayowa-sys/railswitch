import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = {
  title: "Reset Password — RailSwitch",
  description: "Reset your RailSwitch merchant account password.",
};

export default function ResetPasswordPage() {
  return <ResetPasswordForm />;
}
