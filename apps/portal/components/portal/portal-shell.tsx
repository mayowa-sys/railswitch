"use client";

import { useState, useEffect } from "react";
import { LayoutDashboard, Receipt, CreditCard, Wallet, Settings, Menu, X, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { resolveToken, type PortalCustomer } from "@/lib/config";

const NAV_ITEMS = [
  { label: "Overview", icon: LayoutDashboard, href: "/portal" },
  { label: "Invoices", icon: Receipt, href: "/portal/invoices" },
  { label: "Subscriptions", icon: CreditCard, href: "/portal/subscriptions" },
  { label: "Payment Methods", icon: Wallet, href: "/portal/payment-methods" },
  { label: "Settings", icon: Settings, href: "/portal/settings" },
];

export default function PortalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [customer, setCustomer] = useState<PortalCustomer | null>(null);
  const merchantName = "FitCore Nigeria";

  useEffect(() => {
    if (!token) return;
    resolveToken(token).then(data => {
      if (data) setCustomer(data.customer as unknown as PortalCustomer);
    }).catch(() => {});
  }, [token]);

  function isActive(href: string) {
    if (href === "/portal") return pathname === "/portal";
    return pathname.startsWith(href);
  }

  const initials = customer?.name?.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) || "??";
  const displayName = customer?.name || "Customer";
  const displayEmail = customer?.email || "";

  return (
    <div className="flex h-screen w-full bg-zinc-50 dark:bg-[#0c0c0e] font-sans text-zinc-900 dark:text-zinc-100 overflow-hidden">
      {sidebarOpen && <div className="md:hidden fixed inset-0 z-30 bg-zinc-950/40 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} aria-hidden />}

      <aside className={cn("fixed md:static inset-y-0 left-0 z-40 flex flex-col w-64 shrink-0", "border-r border-zinc-200 dark:border-zinc-800/80", "bg-white dark:bg-[#0c0c0e]/95 backdrop-blur-md", "transition-transform duration-300 md:translate-x-0", sidebarOpen ? "translate-x-0" : "-translate-x-full")}>
        <div className="h-16 flex items-center justify-between px-6 border-b border-zinc-200 dark:border-zinc-800/80">
          <Link href={`/portal?token=${token}`} className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <ShieldAlert className="size-4" />
            </div>
            <span className="font-bold text-base tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-600 dark:from-white dark:to-zinc-400">Railswitch Portal</span>
          </Link>
          <button className="md:hidden p-1 rounded text-zinc-500 hover:text-zinc-900 dark:hover:text-white" onClick={() => setSidebarOpen(false)} aria-label="Close sidebar"><X className="size-5" /></button>
        </div>

        <nav className="flex-1 px-4 py-5 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map((item) => (
            <Link key={item.href} href={`${item.href}?token=${token}`} onClick={() => setSidebarOpen(false)}
              className={cn("flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                isActive(item.href) ? "bg-zinc-100 dark:bg-zinc-800/80" : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800/30")}>
              <item.icon className={cn("size-4 shrink-0", isActive(item.href) ? "text-indigo-600 dark:text-indigo-400" : "text-zinc-500 dark:text-zinc-400")} />
              <p className={cn("font-semibold", isActive(item.href) ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-500 dark:text-zinc-400")}>{item.label}</p>
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800/80">
          <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors duration-200">
            <div className="size-8 rounded-full bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center font-semibold text-xs text-white shrink-0">{initials}</div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">{displayName}</p>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">{displayEmail}</p>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 flex items-center justify-between py-4 px-4 md:px-8 border-b border-zinc-200 dark:border-zinc-800/80 bg-white/70 dark:bg-[#0c0c0e]/70 backdrop-blur-md shrink-0 z-20">
          <div className="flex items-center">
            <button className="md:hidden p-2 -ml-2 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-white" onClick={() => setSidebarOpen(true)} aria-label="Open sidebar"><Menu className="size-5" /></button>
            <span className="hidden md:inline text-xs font-semibold px-2.5 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200/50 dark:border-zinc-700/50">
              Merchant: <strong className="text-zinc-900 dark:text-zinc-100 font-bold">{merchantName}</strong>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link href={`/portal/invoices?token=${token}`} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white shadow-sm shadow-indigo-500/20 transition-all">View Invoices</Link>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:px-8">
          <div className="mx-auto animate-in fade-in-50 slide-in-from-bottom-2 duration-500">{children}</div>
        </main>
      </div>
    </div>
  );
}
