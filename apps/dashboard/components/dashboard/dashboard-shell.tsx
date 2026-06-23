"use client";

import { useState } from "react";
import {
  LayoutDashboard,
  Activity,
  Users,
  BookOpen,
  Zap,
  FileText,
  Menu,
  X,
  Bell,
  ChevronDown,
  ArrowUpRight,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { EmptyState } from "@/components/shared/empty-state";

const NAV_ITEMS = [
  { label: "Overview", icon: LayoutDashboard, href: "/dashboard" },
  { label: "Plans", icon: FileText, href: "/dashboard/plans" },
  { label: "Subscriptions", icon: Zap, href: "/dashboard/subscriptions" },
  { label: "Customers", icon: Users, href: "/dashboard/customers" },
  { label: "Audit Log", icon: BookOpen, href: "/dashboard/audit-log" },
];

export default function DashboardShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [hasNewNotifications, setHasNewNotifications] = useState(true);

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  }

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
          <Link href="/" className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Activity className="size-4" />
            </div>
            <span className="font-bold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-600 dark:from-white dark:to-zinc-400">
              RailSwitch
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
              <item.icon className={`size-4 shrink-0 ${isActive(item.href) ? 'text-indigo-700 dark:text-indigo-500' : 'text-zinc-500 dark:text-zinc-400'}`} />
              <p className={`font-semibold ${isActive(item.href) ? 'bg-zinc-100 dark:bg-zinc-800/80' : 'text-zinc-500 dark:text-zinc-400'}`}>{item.label}</p>
            </Link>
          ))}
        </nav>

        {/* User chip */}
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800/80">
          <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/30 cursor-pointer transition-colors duration-200">
            <div className="size-8 rounded-full bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center font-semibold text-xs text-white shrink-0">
              MA
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                Mayowa Adegoke
              </p>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">
                mayowa@naijamusicpro.ng
              </p>
            </div>
            <ChevronDown className="size-3.5 text-zinc-400 shrink-0" />
          </div>
        </div>
      </aside>

      {/* ── Main area ────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top header */}
        <header className="h-16 flex items-center justify-between py-4 px-4 md:px-8 border-b border-zinc-200 dark:border-zinc-800/80 bg-white/70 dark:bg-[#0c0c0e]/70 backdrop-blur-md sticky top-0 z-20">
          {/* Left: hamburger (mobile only) */}
          <div className="flex items-center">
            <button
              className="md:hidden p-2 -ml-2 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar"
            >
              <Menu className="size-5" />
            </button>
          </div>

          <h1 className="text-base sm:text-lg md:text-2xl lg:text-3xl font-bold">Merchant Dashboard</h1>


          {/* Right: bell + new plan button */}
          <div className="flex items-center gap-3 ml-auto">
            {/* Bell — plain button, no base-ui wrapper */}
            <button
              className="relative p-1.5 rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors"
              aria-label="Notifications"
              onClick={() => {
                setNotificationsOpen(true);
                setHasNewNotifications(false);
              }}
            >
              <Bell className="size-4" />
              {hasNewNotifications && (
                <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-indigo-600 dark:bg-indigo-500 animate-pulse" />
              )}
            </button>

            <div className="hidden md:block h-4 w-px bg-zinc-200 dark:bg-zinc-800" />

            {/* New Plan — styled link */}
            <Link
              href="/dashboard/plans"
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white shadow-sm shadow-indigo-500/20 transition-all"
            >
              <span className="hidden sm:inline">New Plan</span>
              <span className="sm:hidden">New</span>
              <ArrowUpRight className="size-3.5" />
            </Link>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto animate-in fade-in-50 slide-in-from-bottom-2 duration-500">
          {children}
        </main>
      </div>

      <Sheet open={notificationsOpen} onOpenChange={setNotificationsOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-md bg-white dark:bg-[#111113] border-l border-zinc-200 dark:border-zinc-800/80 p-0 overflow-y-auto flex flex-col"
        >
          <SheetHeader className="px-6 py-5 border-b border-zinc-100 dark:border-zinc-800/60">
            <SheetTitle className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Notifications
            </SheetTitle>
            <SheetDescription className="text-xs text-zinc-500 dark:text-zinc-400">
              Real-time activity and platform updates.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 flex items-center justify-center p-6">
            <EmptyState
              icon={Bell}
              title="No new notifications"
              description="We will notify you here when transactions recover, plans are modified, or events trigger."
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
