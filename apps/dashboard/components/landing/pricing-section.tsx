import { Check } from "lucide-react";
import { FadeIn } from "@/components/ui/fade-in";
import { Button } from "@/components/ui/button";
import Link from "next/link";

const PLANS = [
  {
    name: "Basic",
    price: "₦9,900",
    period: "/month",
    description: "For individuals starting their fitness journey.",
    features: [
      "Access to 1 location",
      "Open gym floor",
      "Locker room access",
      "1 group class/week",
      "Mobile app check-in",
    ],
    cta: "Start with Basic",
    popular: false,
    gradient: "from-zinc-500 to-zinc-700",
  },
  {
    name: "Pro",
    price: "₦29,900",
    period: "/month",
    description: "For dedicated members who want full access and training.",
    features: [
      "All locations access",
      "Unlimited group classes",
      "Personal trainer (2/mo)",
      "Pool & sauna",
      "Guest passes (2/mo)",
      "Priority booking",
    ],
    cta: "Start with Pro",
    popular: true,
    gradient: "from-blue-500 to-indigo-600",
  },
  {
    name: "Elite",
    price: "₦79,900",
    period: "/month",
    description: "Premium experience with personal training and recovery.",
    features: [
      "Everything in Pro",
      "Unlimited personal training",
      "Nutrition planning",
      "Recovery lounge",
      "Exclusive events",
      "24/7 access",
    ],
    cta: "Start with Elite",
    popular: false,
    gradient: "from-violet-500 to-purple-600",
  },
  {
    name: "Corporate",
    price: "₦249,000",
    period: "/month",
    description: "Complete wellness solution for your team.",
    features: [
      "Up to 20 employees",
      "Dedicated account manager",
      "Custom wellness programs",
      "On-site classes",
      "Health analytics",
      "Priority support",
    ],
    cta: "Start with Corporate",
    popular: false,
    gradient: "from-amber-500 to-orange-600",
  },
];

export function PricingSection() {
  return (
    <section id="pricing" className="py-24 md:py-32">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <FadeIn className="text-center max-w-2xl mx-auto mb-16">
          <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-3">
            Pricing
          </p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-zinc-900 dark:text-white mb-4">
            Simple, transparent pricing
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed">
            RailSwitch recovers 20-40% of revenue that would otherwise be lost to failed
            card payments. Every plan includes the full cascade — the pricing below reflects
            the merchant&apos;s subscription plans, not RailSwitch fees.
          </p>
        </FadeIn>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
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
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">{plan.period}</span>
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
            RailSwitch charges a percentage of recovered revenue only — merchants never pay for failed recoveries.
          </p>
        </FadeIn>
      </div>
    </section>
  );
}
