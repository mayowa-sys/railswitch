import {
  CreditCard,
  Smartphone,
  MessageCircle,
  RotateCcw,
  Shield,
  BarChart3,
  Webhook,
  Code2,
  FileText,
} from "lucide-react";

const FEATURES = [
  {
    icon: RotateCcw,
    title: "Smart card retries",
    description:
      "Payday-aware scheduling (25th–30th bias) and Nigerian banking liquidity windows (10:00–14:00 WAT). Exponential backoff with jitter, configurable per merchant.",
    color: "indigo",
  },
  {
    icon: CreditCard,
    title: "Virtual account fallback",
    description:
      "One-time Nomba VAs scoped to the subscription cycle. Amount-locked, reference-bound — no fake-alert risk. Customer pays via bank transfer, subscription activates.",
    color: "violet",
  },
  {
    icon: Smartphone,
    title: "USSD push",
    description:
      "Nomba-powered USSD prompts for supported banks. Customer dials a code, enters their PIN, money moves. No app, no internet required.",
    color: "purple",
  },
  {
    icon: MessageCircle,
    title: "WhatsApp recovery",
    description:
      "Templated WhatsApp messages with all payment options (VA number, USSD code, checkout link). Meets customers where they already are.",
    color: "emerald",
  },
  {
    icon: Shield,
    title: "Multi-tenant security",
    description:
      "Three isolation layers: scoped API keys, Drizzle ORM middleware, and Postgres Row-Level Security. Automated cross-tenant tests in CI.",
    color: "amber",
  },
  {
    icon: BarChart3,
    title: "Proration & previews",
    description:
      "Live preview before any plan change — line items, credits, net charge, next billing date. Supports upgrades, downgrades, pause credits, and cycle switches.",
    color: "rose",
  },
  {
    icon: Webhook,
    title: "Signed webhooks",
    description:
      "HMAC-SHA256 signed deliveries to your endpoints. Retry policy (30s → 24h), replay tool in dashboard, and delivery logs for debugging.",
    color: "sky",
  },
  {
    icon: Code2,
    title: "Two SDKs",
    description:
      "`@railswitch/node` on npm and `railswitch` on PyPI. TypeScript and Python — the two languages most Nigerian SaaS shops ship in.",
    color: "teal",
  },
  {
    icon: FileText,
    title: "Audit log",
    description:
      "Every state transition logged immutably: merchant_id, subscription_id, from/to state, actor, reason, timestamp. Visible in the dashboard.",
    color: "orange",
  },
];

const COLOR_MAP: Record<string, { bg: string; icon: string; ring: string }> = {
  indigo: { bg: "bg-indigo-50 dark:bg-indigo-950/40", icon: "text-indigo-600 dark:text-indigo-400", ring: "ring-indigo-100 dark:ring-indigo-900/50" },
  violet: { bg: "bg-violet-50 dark:bg-violet-950/40", icon: "text-violet-600 dark:text-violet-400", ring: "ring-violet-100 dark:ring-violet-900/50" },
  purple: { bg: "bg-purple-50 dark:bg-purple-950/40", icon: "text-purple-600 dark:text-purple-400", ring: "ring-purple-100 dark:ring-purple-900/50" },
  emerald: { bg: "bg-emerald-50 dark:bg-emerald-950/40", icon: "text-emerald-600 dark:text-emerald-400", ring: "ring-emerald-100 dark:ring-emerald-900/50" },
  amber: { bg: "bg-amber-50 dark:bg-amber-950/40", icon: "text-amber-600 dark:text-amber-400", ring: "ring-amber-100 dark:ring-amber-900/50" },
  rose: { bg: "bg-rose-50 dark:bg-rose-950/40", icon: "text-rose-600 dark:text-rose-400", ring: "ring-rose-100 dark:ring-rose-900/50" },
  sky: { bg: "bg-sky-50 dark:bg-sky-950/40", icon: "text-sky-600 dark:text-sky-400", ring: "ring-sky-100 dark:ring-sky-900/50" },
  teal: { bg: "bg-teal-50 dark:bg-teal-950/40", icon: "text-teal-600 dark:text-teal-400", ring: "ring-teal-100 dark:ring-teal-900/50" },
  orange: { bg: "bg-orange-50 dark:bg-orange-950/40", icon: "text-orange-600 dark:text-orange-400", ring: "ring-orange-100 dark:ring-orange-900/50" },
};

export function FeaturesSection() {
  return (
    <section id="features" className="py-24 md:py-32">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-3">
            Everything you need
          </p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-zinc-900 dark:text-white mb-4">
            A complete subscriptions engine,{" "}
            <span className="text-indigo-600 dark:text-zinc-500">with recovery built in</span>
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed">
            Plans, billing cycles, proration, dunning, customer portal, webhooks, SDKs. The cascade
            is the headline — the rest is what makes it shippable.
          </p>
        </div>

        {/* Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map(({ icon: Icon, title, description, color }) => {
            const c = COLOR_MAP[color];
            return (
              <div
                key={title}
                className="group relative rounded-2xl border border-zinc-200 dark:border-zinc-800/60 bg-white dark:bg-zinc-900/50 p-6 hover:shadow-lg hover:shadow-zinc-200/60 dark:hover:shadow-zinc-950/60 transition-all duration-300 hover:-translate-y-0.5"
              >
                <div className={`inline-flex size-10 rounded-xl items-center justify-center mb-4 ring-1 ${c.bg} ${c.ring}`}>
                  <Icon className={`size-5 ${c.icon}`} />
                </div>
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">{title}</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">{description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
