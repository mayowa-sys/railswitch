import type { Metadata } from "next";
import { SignInForm } from "@/components/auth/sign-in-form";

export const metadata: Metadata = {
  title: "Sign In — RailSwitch",
  description: "Sign in to your RailSwitch merchant dashboard.",
};

export default function SignInPage() {
  return <SignInForm />;
}
