"use client";

import Link from "next/link";
import { ArrowRight, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden py-24 md:py-32 lg:py-40">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-[600px] w-[900px] rounded-full bg-gradient-to-br from-indigo-500/10 via-violet-500/10 to-purple-500/5 blur-3xl" />
      </div>

      {/* Grid pattern */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03] dark:opacity-[0.06]"
        style={{
          backgroundImage: `linear-gradient(rgba(99,102,241,1) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,1) 1px, transparent 1px)`,
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50 dark:bg-indigo-950/50 px-4 py-1.5 mb-8">
          <Zap className="size-3.5 text-indigo-600 dark:text-indigo-400" />
          <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 tracking-wide uppercase">
            Recovery-first subscriptions engine
          </span>
        </div>

        {/* Headline */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.1] mb-6">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-700 dark:from-white dark:via-zinc-200 dark:to-zinc-400">
            Recurring billing for a
          </span>
          <br />
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600">
            country where cards fail.
          </span>
        </h1>

        {/* Sub */}
        <p className="text-lg md:text-xl text-zinc-500 dark:text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          Nigerian card declines run 20–30%. RailSwitch recovers them — automatically falling
          back from card retries to virtual accounts, USSD, and WhatsApp until your customer
          pays. Subscriptions stay alive. You keep the revenue.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/auth/signup">
            <Button
              size="lg"
              className="h-12 px-8 gap-2 text-base bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white border-0 shadow-lg shadow-indigo-500/25 transition-all duration-200 hover:shadow-xl hover:shadow-indigo-500/30 hover:-translate-y-0.5"
            >
              Start for free
              <ArrowRight className="size-4" />
            </Button>
          </Link>
          <Link href="/auth/signin">
            <Button
              variant="outline"
              size="lg"
              className="h-12 px-8 text-base border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-900"
            >
              Sign in to dashboard
            </Button>
          </Link>
        </div>

        {/* Social proof */}
        <p className="mt-8 text-xs text-zinc-400 dark:text-zinc-500">
          No credit card required · Built on{" "}
          <span className="font-semibold text-zinc-600 dark:text-zinc-400">Nomba</span> infrastructure
        </p>
      </div>
    </section>
  );
}
