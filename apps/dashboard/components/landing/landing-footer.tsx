import Link from "next/link";
import { Activity } from "lucide-react";

export function LandingFooter() {
  return (
    <footer className="border-t border-zinc-200 dark:border-zinc-800/60 bg-white dark:bg-zinc-950">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div className="h-7 w-7 rounded-lg bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-sm">
                <Activity className="size-3.5" />
              </div>
              <span className="font-bold text-base text-zinc-900 dark:text-white">RailSwitch</span>
            </Link>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed max-w-xs">
              Recurring billing infrastructure built for Nigeria. Recover the revenue other
              processors give up on.
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-widest text-zinc-900 dark:text-zinc-100 mb-4">Product</h4>
            <ul className="space-y-2.5 text-sm text-zinc-500 dark:text-zinc-400">
              {["Features", "How it works", "Pricing", "Changelog"].map((item) => (
                <li key={item}>
                  <a href="#" className="hover:text-zinc-900 dark:hover:text-white transition-colors">{item}</a>
                </li>
              ))}
            </ul>
          </div>

          {/* Developers */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-widest text-zinc-900 dark:text-zinc-100 mb-4">Developers</h4>
            <ul className="space-y-2.5 text-sm text-zinc-500 dark:text-zinc-400">
              {["API Reference", "Node.js SDK", "Python SDK", "Postman Collection"].map((item) => (
                <li key={item}>
                  <a href="#" className="hover:text-zinc-900 dark:hover:text-white transition-colors">{item}</a>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-widest text-zinc-900 dark:text-zinc-100 mb-4">Company</h4>
            <ul className="space-y-2.5 text-sm text-zinc-500 dark:text-zinc-400">
              {["About", "Security", "Privacy Policy", "Terms of Service"].map((item) => (
                <li key={item}>
                  <a href="#" className="hover:text-zinc-900 dark:hover:text-white transition-colors">{item}</a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-zinc-100 dark:border-zinc-800/60 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-zinc-400 dark:text-zinc-500">
            © {new Date().getFullYear()} RailSwitch. All rights reserved. Built on{" "}
            <a href="#" className="font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">
              Nomba
            </a>
            .
          </p>
          <div className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs text-zinc-400 dark:text-zinc-500">All systems operational</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
