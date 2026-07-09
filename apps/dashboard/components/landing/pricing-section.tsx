import { Check } from "lucide-react";
import { FadeIn } from "@/components/ui/fade-in";
import { Button } from "@/components/ui/button";
import Link from "next/link";

const PLANS = [
  {
    name: "Starter",
    price: "Free",
    description: "For merchants just getting started with recurring billing.",
    features: [
      "Up to 50 active subscriptions",
      "Basic card retries (up to 2)",
      "Virtual account fallback",
      "Customer portal",
      "Dashboard analytics",
      "Email notifications",
    ],
    cta: "Start free",
    popular: false,
  },
  {
    name: "Growth",
    price: "5%",
    period: "of recovered revenue",
    description: "For growing businesses that want the full recovery suite.",
    features: [
      "Unlimited subscriptions",
      "3-stage smart card retries",
      "Virtual account + USSD fallback",
      "WhatsApp recovery messages",
      "Priority webhook delivery",
      "HMAC-signed outbound webhooks",
      "API access + SDKs",
      "Audit log",
    ],
    cta: "Start with Growth",
    popular: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    description: "For large merchants with custom recovery policies and SLA requirements.",
    features: [
      "Everything in Growth",
      "Custom dunning policy",
      "Dedicated VA pool",
      "SLA-backed webhook delivery",
      "White-label portal",
      "Dedicated account manager",
      "On-premise deployment option",
      "24/7 priority support",
    ],
    cta: "Contact sales",
    popular: false,
  },
];

export function PricingSection() {
  return (
    <section id="pricing" className="py-24 md:py-32">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <FadeIn className="text-center max-w-2xl mx-auto mb-16">
          <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-3">
            Pricing
          </p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-zinc-900 dark:text-white mb-4">
            Pay only for recovered revenue
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed">
            RailSwitch charges a percentage of revenue we recover — not a flat monthly fee.
            Failed recoveries cost nothing. We only succeed when you succeed.
          </p>
        </FadeIn>

        <div className="grid md:grid-cols-3 gap-6">
          {PLANS.map((plan, i) => (
            <FadeIn key={plan.name} delay={i * 80}>
              <div
                className={`relative h-full rounded-2xl border p-6 flex flex-col transition-all duration-300 hover:-translate-y-1 ${
                  plan.popular
                    ? "border-indigo-300 dark:border-indigo-700 bg-white dark:bg-zinc-900/50 shadow-lg shadow-indigo-500/10"
                    : "border-zinc-200 dark:border-zinc-800/60 bg-white dark:bg-zinc-900/30"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md">
                      Most popular
                    </span>
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-lg font-bold text-zinc-900 dark:text-white">{plan.name}</h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">{plan.description}</p>
                </div>

                <div className="mb-6">
                  <span className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
                    {plan.price}
                  </span>
                  {plan.period && (
                    <span className="text-sm text-zinc-500 dark:text-zinc-400 ml-1">{plan.period}</span>
                  )}
                </div>

                <ul className="space-y-2.5 mb-8 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm">
                      <Check className="size-4 text-emerald-500 mt-0.5 shrink-0" />
                      <span className="text-zinc-600 dark:text-zinc-300">{f}</span>
                    </li>
                  ))}
                </ul>

                <Link href="/auth/signup" className="mt-auto">
                  <Button
                    className={`w-full h-10 text-sm font-semibold ${
                      plan.popular
                        ? "bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white border-0 shadow-sm shadow-indigo-500/20"
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                    }`}
                  >
                    {plan.cta}
                  </Button>
                </Link>
              </div>
            </FadeIn>
          ))}
        </div>

        <FadeIn className="text-center mt-12">
          <p className="text-xs text-zinc-400 dark:text-zinc-500">
            All plans include the full cascade engine, HMAC-signed webhooks, and PostgreSQL RLS multi-tenancy.
          </p>
        </FadeIn>
      </div>
    </section>
  );
}
