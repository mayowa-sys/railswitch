"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Activity, ArrowRight, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: "8+ characters", met: password.length >= 8 },
    { label: "Uppercase letter", met: /[A-Z]/.test(password) },
    { label: "Lowercase letter", met: /[a-z]/.test(password) },
    { label: "Number or symbol", met: /[\d\W]/.test(password) },
  ];
  const score = checks.filter((c) => c.met).length;
  const strengthLabels = ["", "Weak", "Fair", "Good", "Strong"];
  const strengthColors = [
    "bg-zinc-200 dark:bg-zinc-700",
    "bg-rose-500",
    "bg-amber-500",
    "bg-yellow-500",
    "bg-emerald-500",
  ];

  if (!password) return null;

  return (
      <div className="space-y-2 mt-2">
        <div className="flex gap-1">
          {[1, 2, 3, 4].map((i) => (
              <div
                  key={i}
                  className={cn(
                      "h-1 flex-1 rounded-full transition-all duration-300",
                      i <= score ? strengthColors[score] : "bg-zinc-200 dark:bg-zinc-700"
                  )}
              />
          ))}
        </div>
        <div className="flex items-center justify-between">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Password strength:{" "}
            <span
                className={cn(
                    "font-medium",
                    score === 1 && "text-rose-600 dark:text-rose-400",
                    score === 2 && "text-amber-600 dark:text-amber-400",
                    score === 3 && "text-yellow-600 dark:text-yellow-400",
                    score === 4 && "text-emerald-600 dark:text-emerald-400"
                )}
            >
            {strengthLabels[score]}
          </span>
          </p>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          {checks.map((check) => (
              <div key={check.label} className="flex items-center gap-1.5">
                <CheckCircle2
                    className={cn(
                        "size-3 transition-colors",
                        check.met ? "text-emerald-500" : "text-zinc-300 dark:text-zinc-600"
                    )}
                />
                <span
                    className={cn(
                        "text-[11px] transition-colors",
                        check.met ? "text-zinc-700 dark:text-zinc-300" : "text-zinc-400 dark:text-zinc-500"
                    )}
                >
              {check.label}
            </span>
              </div>
          ))}
        </div>
      </div>
  );
}

export function SignUpForm() {
  const router = useRouter();
  const { signup } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [form, setForm] = useState({
    businessName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate() {
    const errs: Record<string, string> = {};
    if (!form.businessName.trim()) errs.businessName = "Business name is required";
    if (!form.email.trim()) {
      errs.email = "Email is required";
    } else if (!EMAIL_REGEX.test(form.email.trim())) {
      errs.email = "Enter a valid email address";
    }
    if (form.password.length < 8) errs.password = "Password must be at least 8 characters";
    if (form.password !== form.confirmPassword)
      errs.confirmPassword = "Passwords do not match";
    return errs;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setIsLoading(true);
    try {
      await signup(form.businessName, form.email, form.password);
      router.push("/dashboard");
    } catch {
      setErrors({ form: "Something went wrong. Please try again." });
    } finally {
      setIsLoading(false);
    }
  }

  return (
      <div className="w-full max-w-md mx-auto rs-fade-up">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <Link
              href="/"
              className="h-12 w-12 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30 mb-4 transition-transform hover:scale-105"
              aria-label="RailSwitch home"
          >
            <Activity className="size-6" />
          </Link>
          <span className="text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-zinc-900 to-zinc-600 dark:from-white dark:to-zinc-400">
          RailSwitch
        </span>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Merchant Dashboard</p>
        </div>

        <Card className="border-zinc-200 dark:border-zinc-800/80 shadow-xl shadow-zinc-200/60 dark:shadow-zinc-950/60 bg-white dark:bg-zinc-900/80 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl">Create your account</CardTitle>
            <CardDescription>
              Start recovering recurring revenue today. No credit card required.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div className="space-y-2">
                <Label htmlFor="signup-business">Business name</Label>
                <Input
                    id="signup-business"
                    type="text"
                    placeholder="Naija Music Pro"
                    autoComplete="organization"
                    required
                    value={form.businessName}
                    onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                    className={cn(
                        "h-10 bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700 focus-visible:ring-indigo-500/30 focus-visible:border-indigo-500",
                        errors.businessName && "border-rose-400 dark:border-rose-600"
                    )}
                />
                {errors.businessName && (
                    <p className="text-xs text-rose-600 dark:text-rose-400">{errors.businessName}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-email">Work email</Label>
                <Input
                    id="signup-email"
                    type="email"
                    placeholder="you@company.com"
                    autoComplete="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className={cn(
                        "h-10 bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700 focus-visible:ring-indigo-500/30 focus-visible:border-indigo-500",
                        errors.email && "border-rose-400 dark:border-rose-600"
                    )}
                />
                {errors.email && (
                    <p className="text-xs text-rose-600 dark:text-rose-400">{errors.email}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-password">Password</Label>
                <div className="relative">
                  <Input
                      id="signup-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      required
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      className={cn(
                          "h-10 pr-10 bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700 focus-visible:ring-indigo-500/30 focus-visible:border-indigo-500",
                          errors.password && "border-rose-400 dark:border-rose-600"
                      )}
                  />
                  <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors rounded-r-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30"
                      tabIndex={-1}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                {errors.password && (
                    <p className="text-xs text-rose-600 dark:text-rose-400">{errors.password}</p>
                )}
                <PasswordStrength password={form.password} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-confirm">Confirm password</Label>
                <div className="relative">
                  <Input
                      id="signup-confirm"
                      type={showConfirm ? "text" : "password"}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      required
                      value={form.confirmPassword}
                      onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                      className={cn(
                          "h-10 pr-10 bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700 focus-visible:ring-indigo-500/30 focus-visible:border-indigo-500",
                          errors.confirmPassword && "border-rose-400 dark:border-rose-600"
                      )}
                  />
                  <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors rounded-r-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30"
                      tabIndex={-1}
                      aria-label={showConfirm ? "Hide password" : "Show password"}
                  >
                    {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                {errors.confirmPassword && (
                    <p className="text-xs text-rose-600 dark:text-rose-400">{errors.confirmPassword}</p>
                )}
              </div>

              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                By creating an account you agree to our{" "}
                <a href="#" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                  Terms of Service
                </a>{" "}
                and{" "}
                <a href="#" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                  Privacy Policy
                </a>
                .
              </p>

              <Button
                  type="submit"
                  disabled={isLoading}
                  className={cn(
                      "w-full h-10 gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white border-0 shadow-md shadow-indigo-500/20 transition-all duration-200",
                      isLoading && "opacity-80"
                  )}
              >
                {isLoading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Creating account…
                    </>
                ) : (
                    <>
                      Create account
                      <ArrowRight className="size-4" />
                    </>
                )}
              </Button>
            </form>
          </CardContent>

          <div className="px-6">
            <Separator />
          </div>

          <CardFooter className="pt-4 flex justify-center">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Already have an account?{" "}
              <Link
                  href="/auth/signin"
                  className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
              >
                Sign in
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
  );
}