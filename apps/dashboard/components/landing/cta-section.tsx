import Link from "next/link";
import { ArrowRight, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/ui/fade-in";

export function CtaSection() {
  return (
      <section className="py-24 md:py-32">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <FadeIn>
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 p-12 md:p-16 text-center shadow-2xl shadow-indigo-500/30">
              {/* Decorative blobs */}
              <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-white/10 blur-3xl" />

              {/* Logo mark */}
              <div className="inline-flex h-14 w-14 rounded-2xl bg-white/20 backdrop-blur items-center justify-center mb-6 mx-auto">
                <Activity className="size-7 text-white" />
              </div>

              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 tracking-tight">
                Stripe collects recurring revenue.
                <br />
                <span className="text-indigo-200">RailSwitch recovers it.</span>
              </h2>

              <p className="text-indigo-100/80 text-lg max-w-xl mx-auto mb-8 leading-relaxed">
                Start free. Integrate in 15 minutes. Your next billing cycle could run on RailSwitch.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/auth/signup">
                  <Button
                      size="lg"
                      className="h-12 px-8 gap-2 text-base bg-white text-indigo-700 hover:bg-indigo-50 border-0 shadow-lg font-semibold transition-all duration-200 hover:-translate-y-0.5"
                  >
                    Create your account
                    <ArrowRight className="size-4" />
                  </Button>
                </Link>
                <Link href="/auth/signin">
                  <Button
                      variant="ghost"
                      size="lg"
                      className="h-12 px-8 text-base text-white hover:bg-white/10 border border-white/20"
                  >
                    Sign in
                  </Button>
                </Link>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>
  );
}