"use client";

import { useState, useEffect } from "react";
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
  ArrowUpRight,
  Settings2,
  LogOut,
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
import { useAuth } from "@/lib/auth-context";

const NAV_ITEMS = [
  { label: "Overview", icon: LayoutDashboard, href: "/dashboard" },
  { label: "Plans", icon: FileText, href: "/dashboard/plans" },
  { label: "Subscriptions", icon: Zap, href: "/dashboard/subscriptions" },
  { label: "Customers", icon: Users, href: "/dashboard/customers" },
  { label: "Audit Log", icon: BookOpen, href: "/dashboard/audit-log" },
  { label: "Settings", icon: Settings2, href: "/dashboard/settings" },
];

export default function DashboardShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [hasNewNotifications, setHasNewNotifications] = useState(true);
  const [notificationCount, setNotificationCount] = useState(0);
  const [notifications, setNotifications] = useState<Array<{id: string; title: string; body: string; time: string; type: string}>>([]);

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  }

  // Fetch real notifications
  useEffect(() => {
    if (!user?.apiKey) return;
    const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    
    const fetchNotifications = () => {
      Promise.all([
        fetch(`${API}/v1/subscriptions?limit=5`, { headers: { Authorization: `Bearer ${user.apiKey}` } }).then(r => r.json()),
        fetch(`${API}/v1/webhooks/deliveries?limit=5`, { headers: { Authorization: `Bearer ${user.apiKey}` } }).then(r => r.json()),
      ]).then(([subsData, webhooksData]) => {
        const items: Array<{id: string; title: string; body: string; time: string; type: string}> = [];
        
        // Recent subscriptions
        const subs = subsData.data || [];
        const recentSubs = subs.filter((s: any) => {
          const created = new Date(s.created_at).getTime();
          return Date.now() - created < 86400000; // Last 24 hours
        });
        
        if (recentSubs.length > 0) {
          const count = recentSubs.length;
          items.push({
            id: 'subs-batch',
            title: `${count} new subscription${count > 1 ? 's' : ''}`,
            body: recentSubs.slice(0, 3).map((s: any) => s.id.slice(0, 12)).join(', ') + (count > 3 ? ` +${count - 3} more` : ''),
            time: new Date(recentSubs[0].created_at).toLocaleString('en-NG', { hour: '2-digit', minute: '2-digit' }),
            type: 'subscription'
          });
        }
        
        // Recent webhook deliveries
        const deliveries = webhooksData.data || [];
        const failedDeliveries = deliveries.filter((d: any) => d.status === 'failed');
        if (failedDeliveries.length > 0) {
          items.push({
            id: 'webhook-batch',
            title: `${failedDeliveries.length} webhook failure${failedDeliveries.length > 1 ? 's' : ''}`,
            body: 'Delivery attempts failed. Check webhook settings.',
            time: new Date(failedDeliveries[0].created_at).toLocaleString('en-NG', { hour: '2-digit', minute: '2-digit' }),
            type: 'webhook'
          });
        }
        
        setNotifications(items);
        setNotificationCount(items.reduce((sum, i) => sum + (i.type === 'subscription' ? parseInt(i.title) || 0 : 0), 0));
        if (items.length > 0) setHasNewNotifications(true);
      }).catch(() => {});
    };
    
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, [user?.apiKey]);

  const initials = user
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "??";

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
              {user?.company || "RailSwitch"}
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
              <p className={`font-semibold ${isActive(item.href) ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 dark:text-zinc-400'}`}>{item.label}</p>
            </Link>
          ))}
        </nav>

        {/* User chip */}
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800/80">
          <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors duration-200">
            <div className="size-8 rounded-full bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center font-semibold text-xs text-white shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                {user?.name ?? "User"}
              </p>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">
                {user?.email ?? ""}
              </p>
            </div>
            <button
              onClick={logout}
              className="p-1 rounded text-zinc-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
              aria-label="Sign out"
            >
              <LogOut className="size-3.5 shrink-0" />
            </button>
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
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center px-1">
                  {notificationCount > 8 ? "9+" : notificationCount || ""}
                </span>
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
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                <Bell className="size-8 text-zinc-300 dark:text-zinc-600 mb-3" />
                <p className="text-sm font-medium text-zinc-500">No new notifications</p>
                <p className="text-xs text-zinc-400 mt-1">We'll notify you of new subscriptions and recovery events.</p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                {notifications.map((n) => (
                  <div key={n.id} className="px-6 py-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/20 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className={`size-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                        n.type === 'subscription' ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600' :
                        'bg-amber-50 dark:bg-amber-950/30 text-amber-600'
                      }`}>
                        {n.type === 'subscription' ? <Zap className="size-4" /> : <Bell className="size-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{n.title}</p>
                        <p className="text-xs text-zinc-500 mt-0.5 truncate">{n.body}</p>
                        <p className="text-[10px] text-zinc-400 mt-1">{n.time}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
