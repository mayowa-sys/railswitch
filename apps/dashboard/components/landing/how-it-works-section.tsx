import { ArrowRight, CreditCard, Smartphone, MessageCircle, CheckCircle2 } from "lucide-react";

const STEPS = [
  {
    step: "01",
    title: "Cycle renewal triggers",
    description: "At the billing date, RailSwitch initiates a charge against the customer's tokenized card via Nomba.",
    icon: CreditCard,
    color: "from-indigo-500 to-violet-500",
  },
  {
    step: "02",
    title: "Smart retries",
    description: "If the card fails, up to 3 retries are scheduled — timing-optimized for payday windows and Nigerian banking liquidity hours.",
    icon: ArrowRight,
    color: "from-violet-500 to-purple-500",
  },
  {
    step: "03",
    title: "Virtual account fallback",
    description: "After retries are exhausted, a one-time virtual account is generated. Amount-locked. Expires when paid or at cycle end.",
    icon: CreditCard,
    color: "from-purple-500 to-pink-500",
  },
  {
    step: "04",
    title: "USSD + WhatsApp",
    description: "If the VA window closes, a USSD push fires, followed by a WhatsApp message with all payment options. Customer pays via any channel.",
    icon: MessageCircle,
    color: "from-pink-500 to-rose-500",
  },
  {
    step: "05",
    title: "Subscription restored",
    description: "The moment payment lands via any rail, the state machine transitions to active. Webhook fires. Invoice marked paid. Revenue recovered.",
    icon: CheckCircle2,
    color: "from-emerald-500 to-teal-500",
  },
];

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-24 md:py-32 bg-zinc-50/80 dark:bg-zinc-950/50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-3">
            The cascade
          </p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-zinc-900 dark:text-white mb-4">
            How RailSwitch recovers a failed payment
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed">
            Each rail is a configurable step in an automated pipeline. Merchants set the policy;
            the engine handles the rest — idempotently, atomically, with full audit logging.
          </p>
        </div>

        {/* Steps */}
        <div className="relative">
          {/* Connector line */}
          <div className="absolute left-7 top-10 bottom-10 w-px bg-gradient-to-b from-indigo-300 to-emerald-300 dark:from-indigo-800 dark:to-emerald-800 hidden md:block" />

          <div className="space-y-8">
            {STEPS.map(({ step, title, description, icon: Icon, color }) => (
              <div key={step} className="relative flex gap-6 md:gap-8">
                {/* Step indicator */}
                <div className="flex-shrink-0 relative z-10">
                  <div className={`h-14 w-14 rounded-2xl bg-gradient-to-br ${color} flex items-center justify-center shadow-lg`}>
                    <Icon className="size-6 text-white" />
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 pt-2 pb-8">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xs font-bold text-zinc-400 dark:text-zinc-500 tracking-widest">
                      STEP {step}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">{title}</h3>
                  <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed max-w-xl">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
