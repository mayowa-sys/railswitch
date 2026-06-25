"use client";

import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Receipt,
  CreditCard,
  Wallet,
  Settings,
  Menu,
  X,
  Bell,
  ChevronDown,
  AlertCircle,
  Copy,
  CheckCircle,
  RefreshCw,
  HelpCircle,
  ShieldAlert
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { loadPortalState, savePortalState, formatNaira, PLANS } from "@/lib/mock-data";

const NAV_ITEMS = [
  { label: "Overview", icon: LayoutDashboard, href: "/portal" },
  { label: "Invoices", icon: Receipt, href: "/portal/invoices" },
  { label: "Subscriptions", icon: CreditCard, href: "/portal/subscriptions" },
  { label: "Payment Methods", icon: Wallet, href: "/portal/payment-methods" },
  { label: "Settings", icon: Settings, href: "/portal/settings" },
];

export default function PortalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Portal State
  const [state, setState] = useState(loadPortalState());

  useEffect(() => {
    // Keep local component state in sync with localStorage updates
    const handleStorageChange = () => {
      setState(loadPortalState());
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const subscription = state.subscription;
  const currentPlan = PLANS.find((p) => p.id === subscription.planId) || PLANS[0];
  const isPastDue = subscription.status === "past_due";

  function isActive(href: string) {
    if (href === "/portal") return pathname === "/portal";
    return pathname.startsWith(href);
  }

  // Copy bank transfer account
  const handleCopyAccount = () => {
    navigator.clipboard.writeText("9012345678");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Toggle past_due for demo purposes
  const toggleDemoPastDue = () => {
    const nextStatus = subscription.status === "past_due" ? "active" : "past_due";
    const updatedSub = { ...subscription, status: nextStatus };
    
    // If setting to active, make sure we have at least one default card
    savePortalState({ subscription: updatedSub });
    setState((s) => ({ ...s, subscription: updatedSub }));
    setProfileOpen(false);
    router.refresh();
  };

  // Reset demo state completely
  const resetDemoState = () => {
    localStorage.clear();
    const cleanState = loadPortalState();
    savePortalState(cleanState);
    setState(cleanState);
    setProfileOpen(false);
    router.refresh();
  };

  return (
    <div className="flex h-screen w-full bg-zinc-50 dark:bg-[#0c0c0e] font-sans text-zinc-900 dark:text-zinc-100 overflow-hidden">
      
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 z-30 bg-zinc-950/40 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        />
      )}

      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside
        className={cn(
          "fixed md:static inset-y-0 left-0 z-40 flex flex-col w-64 shrink-0",
          "border-r border-zinc-200 dark:border-zinc-800/80",
          "bg-white dark:bg-[#0c0c0e]/95 backdrop-blur-md",
          "transition-transform duration-300 md:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo row */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-zinc-200 dark:border-zinc-800/80">
          <Link href="/portal" className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <ShieldAlert className="size-4 animate-pulse" />
            </div>
            <span className="font-bold text-base tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-600 dark:from-white dark:to-zinc-400">
              Railswitch Portal
            </span>
          </Link>
          <button
            className="md:hidden p-1 rounded text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-4 py-5 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={cn(
                "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                isActive(item.href)
                  ? "bg-zinc-100 dark:bg-zinc-800/80"
                  : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800/30"
              )}
            >
              <item.icon className={cn(
                "size-4 shrink-0",
                isActive(item.href)
                  ? "text-indigo-600 dark:text-indigo-400"
                  : "text-zinc-500 dark:text-zinc-400"
              )} />
              <p className={cn(
                "font-semibold",
                isActive(item.href)
                  ? "text-zinc-900 dark:text-zinc-100"
                  : "text-zinc-500 dark:text-zinc-400"
              )}>{item.label}</p>
            </Link>
          ))}
        </nav>

        {/* User profile / demo trigger chip */}
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800/80 relative">
          {profileOpen && (
            <>
              <div 
                className="fixed inset-0 z-40 cursor-default" 
                onClick={() => setProfileOpen(false)} 
              />
              <div className="absolute bottom-16 left-4 right-4 z-50 rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#121215] p-3.5 shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-200">
                <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-2 px-1">
                  Developer Utilities
                </p>
                <button
                  onClick={toggleDemoPastDue}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-xs font-semibold hover:bg-zinc-50 dark:hover:bg-zinc-800/40 text-zinc-700 dark:text-zinc-300 transition-colors"
                >
                  <RefreshCw className="size-3.5 shrink-0 text-indigo-500" />
                  {subscription.status === "past_due" ? "Set status: Active" : "Simulate Dunning (Past Due)"}
                </button>
                <button
                  onClick={resetDemoState}
                  className="w-full flex items-center gap-2 px-2.5 py-2 mt-1 rounded-lg text-left text-xs font-semibold hover:bg-red-50 dark:hover:bg-red-950/20 text-red-600 dark:text-red-400 transition-colors"
                >
                  <X className="size-3.5 shrink-0" />
                  Reset Portal State
                </button>
              </div>
            </>
          )}

          <div 
            onClick={() => setProfileOpen(!profileOpen)}
            className="flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/30 cursor-pointer transition-colors duration-200 border border-transparent hover:border-zinc-200 dark:hover:border-zinc-800"
          >
            <div className="size-8 rounded-full bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center font-semibold text-xs text-white shrink-0">
              JD
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">John Doe</p>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">john.doe@acme.corp</p>
            </div>
            <ChevronDown className="size-3.5 text-zinc-400 shrink-0" />
          </div>
        </div>
      </aside>

      {/* ── Main area ────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        
        {/* Top header */}
        <header className="h-16 flex items-center justify-between py-4 px-4 md:px-8 border-b border-zinc-200 dark:border-zinc-800/80 bg-white/70 dark:bg-[#0c0c0e]/70 backdrop-blur-md shrink-0 z-20">
          <div className="flex items-center">
            <button
              className="md:hidden p-2 -ml-2 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar"
            >
              <Menu className="size-5" />
            </button>
            <span className="hidden md:inline text-xs font-semibold px-2.5 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200/50 dark:border-zinc-700/50">
              Merchant: <strong className="text-zinc-900 dark:text-zinc-100 font-bold">NaijaMusicPro</strong>
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Notifications trigger */}
            <div className="relative">
              <button
                className="relative p-1.5 rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors"
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                aria-label="Notifications"
              >
                <Bell className="size-4" />
                {isPastDue && (
                  <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-red-500 animate-pulse" />
                )}
              </button>

              {notificationsOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setNotificationsOpen(false)} />
                  <div className="absolute right-0 mt-2 w-80 rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#121215] p-4 shadow-xl z-40 animate-in fade-in slide-in-from-top-1 duration-200">
                    <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 mb-2">Notifications</h4>
                    {isPastDue ? (
                      <div className="flex gap-2.5 p-2 rounded-lg bg-red-50/50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/40 text-xs">
                        <AlertCircle className="size-4 text-red-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-red-800 dark:text-red-400">Payment Failed</p>
                          <p className="text-red-600 dark:text-red-500/80 mt-0.5">We were unable to charge your Visa card ending in 4242. Auto-billing is paused.</p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 text-center py-4">No new notifications</p>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800" />
            <Link
              href="/portal/invoices"
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white shadow-sm shadow-indigo-500/20 transition-all"
            >
              View Invoices
            </Link>
          </div>
        </header>

        {/* ── Recovery Status Banner ────────────────────────────────────────── */}
        {isPastDue && (
          <div className="w-full bg-red-600 text-white shrink-0 shadow-md">
            <div className="max-w-7xl mx-auto px-4 py-3 md:px-8 flex flex-col md:flex-row items-center justify-between gap-3 text-center md:text-left">
              <div className="flex items-center gap-2.5 text-sm font-medium">
                <AlertCircle className="size-5 shrink-0 animate-bounce" />
                <span>
                  We tried your card on the 15th. Pay <strong>{formatNaira(currentPlan.price)}</strong> via bank transfer to keep your subscription: account <strong className="font-mono bg-red-700/50 px-1.5 py-0.5 rounded">9012345678</strong> at <strong className="underline">Wema Bank</strong>.
                </span>
              </div>
              <button
                onClick={handleCopyAccount}
                className="shrink-0 flex items-center gap-1.5 h-7 px-3 rounded-md bg-white text-red-600 hover:bg-zinc-100 text-xs font-bold transition-all shadow-sm"
              >
                {copied ? (
                  <><CheckCircle className="size-3.5 text-emerald-600" /> Copied!</>
                ) : (
                  <><Copy className="size-3.5" /> Copy Account</>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 md:px-8">
          <div className="mx-auto animate-in fade-in-50 slide-in-from-bottom-2 duration-500">
            {children}
          </div>
        </main>

      </div>
    </div>
  );
}
