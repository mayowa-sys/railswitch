import type { Metadata } from "next";
import { SignUpForm } from "@/components/auth/sign-up-form";

export const metadata: Metadata = {
  title: "Create Account — RailSwitch",
  description: "Create your RailSwitch merchant account and start recovering recurring revenue.",
};

export default function SignUpPage() {
  return <SignUpForm />;
}
