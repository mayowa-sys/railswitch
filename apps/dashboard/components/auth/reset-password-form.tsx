"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Activity, ArrowLeft, ArrowRight, Loader2, Mail, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";

export function ResetPasswordForm() {
  const { resetPassword } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      setError("Please enter your email address");
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      await resetPassword(email);
      setSent(true);
      setResendIn(30);
    } catch {
      setError("Failed to send reset link. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleResend() {
    if (resendIn > 0) return;
    setResendIn(30);
    try {
      await resetPassword(email);
    } catch {
      // silently fail on resend
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
          {!sent ? (
              <>
                <CardHeader className="pb-4">
                  <CardTitle className="text-xl">Reset your password</CardTitle>
                  <CardDescription>
                    Enter your email and we{"\u2019"}ll send you a link to reset your password.
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  {error && (
                      <div className="mb-4 rounded-lg border border-rose-200 dark:border-rose-800/60 bg-rose-50 dark:bg-rose-950/40 px-4 py-3 text-sm text-rose-700 dark:text-rose-400">
                        {error}
                      </div>
                  )}
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="reset-email">Email address</Label>
                      <Input
                          id="reset-email"
                          type="email"
                          placeholder="you@company.com"
                          autoComplete="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className={cn(
                              "h-10 bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700 focus-visible:ring-indigo-500/30 focus-visible:border-indigo-500 dark:focus-visible:border-indigo-400",
                              error && "border-rose-400 dark:border-rose-600"
                          )}
                      />
                    </div>

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
                            Sending reset link…
                          </>
                      ) : (
                          <>
                            Send reset link
                            <ArrowRight className="size-4" />
                          </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </>
          ) : (
              <>
                <CardHeader className="pb-4 text-center">
                  <div className="flex justify-center mb-4">
                    <div className="h-14 w-14 rounded-full bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center">
                      <CheckCircle2 className="size-7 text-emerald-500" />
                    </div>
                  </div>
                  <CardTitle className="text-xl">Check your email</CardTitle>
                  <CardDescription>
                    We{"\u2019"}ve sent a password reset link to{" "}
                    <span className="font-medium text-zinc-700 dark:text-zinc-300">{email}</span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg border border-indigo-100 dark:border-indigo-900/60 bg-indigo-50/60 dark:bg-indigo-950/30 px-4 py-3 flex items-start gap-3">
                    <Mail className="size-4 text-indigo-500 mt-0.5 shrink-0" />
                    <p className="text-sm text-indigo-700 dark:text-indigo-300">
                      The link expires in 1 hour. If you don{"\u2019"}t see the email, check your spam folder.
                    </p>
                  </div>
                  <Button
                      variant="outline"
                      onClick={handleResend}
                      disabled={resendIn > 0}
                      className="w-full h-10"
                  >
                    {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend email"}
                  </Button>
                </CardContent>
              </>
          )}

          <div className="px-6">
            <Separator />
          </div>

          <CardFooter className="pt-4 flex justify-center">
            <Link
                href="/auth/signin"
                className="flex items-center gap-1.5 text-sm text-indigo-600 dark:text-indigo-400 font-medium hover:underline hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
            >
              <ArrowLeft className="size-3.5" />
              Back to sign in
            </Link>
          </CardFooter>
        </Card>
      </div>
  );
}