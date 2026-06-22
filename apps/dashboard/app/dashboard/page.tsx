"use client";

import { useState } from "react";
import { 
  LayoutDashboard, 
  ArrowUpRight, 
  DollarSign, 
  Activity, 
  CreditCard, 
  Users, 
  Search, 
  Bell, 
  ChevronDown,
  TrendingUp,
  Settings,
  Zap,
  FileText,
  Webhook,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

const NAV_ITEMS = [
  { label: "Overview", icon: LayoutDashboard, id: "overview" },
  { label: "Subscriptions", icon: Zap, id: "subscriptions" },
  { label: "Invoices", icon: FileText, id: "invoices" },
  { label: "Customers", icon: Users, id: "customers" },
  { label: "Payments", icon: CreditCard, id: "payments" },
  { label: "Webhooks", icon: Webhook, id: "webhooks" },
  { label: "Settings", icon: Settings, id: "settings" },
];

const TRANSACTIONS = [
  { id: "tx_01J0A1", customer: "Olivia Martin", email: "olivia.martin@email.com", amount: "₦199,000", status: "success", date: "Just now" },
  { id: "tx_01J0A2", customer: "Jackson Lee", email: "jackson.lee@email.com", amount: "₦39,000", status: "success", date: "1 hour ago" },
  { id: "tx_01J0A3", customer: "Isabella Nguyen", email: "isabella.nguyen@email.com", amount: "₦29,900", status: "pending", date: "3 hours ago" },
  { id: "tx_01J0A4", customer: "William Kim", email: "will@email.com", amount: "₦9,900", status: "recovered", date: "Yesterday" },
  { id: "tx_01J0A5", customer: "Sofia Davis", email: "sofia.davis@email.com", amount: "₦39,000", status: "success", date: "2 days ago" },
];

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="flex h-screen w-full bg-zinc-50 dark:bg-[#0c0c0e] font-sans text-zinc-900 dark:text-zinc-100 overflow-hidden">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#0c0c0e]/50 backdrop-blur-md">
        <div className="h-16 flex items-center px-6 border-b border-zinc-200 dark:border-zinc-800/80">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Activity className="size-4 animate-pulse" />
            </div>
            <span className="font-bold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-600 dark:from-white dark:to-zinc-400">
              RailSwitch
            </span>
          </Link>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                activeTab === item.id
                  ? "bg-zinc-100 dark:bg-zinc-800/80 text-zinc-950 dark:text-white"
                  : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800/30"
              }`}
            >
              <item.icon className="size-4 shrink-0" />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800/80">
          <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/30 cursor-pointer transition-colors duration-200">
            <div className="size-8 rounded-full bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center font-semibold text-xs text-white">
              JD
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">John Doe</p>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">john@acmecorp.ng</p>
            </div>
            <ChevronDown className="size-3.5 text-zinc-400 shrink-0" />
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Header */}
        <header className="h-16 flex items-center justify-between py-4 px-6 md:px-8 border-b border-zinc-200 dark:border-zinc-800/80 bg-white/50 dark:bg-[#0c0c0e]/30 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative w-full max-w-xs md:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-400 dark:text-zinc-500" />
              <input
                type="text"
                placeholder="Search subscriptions, customers…"
                className="w-full h-9 pl-9 pr-4 rounded-lg bg-zinc-100 dark:bg-zinc-800/50 border border-transparent focus:border-zinc-200 dark:focus:border-zinc-700 focus:bg-white dark:focus:bg-[#0c0c0e] text-sm transition-all outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon-sm" className="relative text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">
              <Bell className="size-4" />
              <span className="absolute top-1 right-1 size-1.5 rounded-full bg-indigo-600 dark:bg-indigo-500" />
            </Button>
            <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800" />
            <Button size="sm" className="gap-1.5 font-medium bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white border-0 shadow-sm shadow-indigo-500/20">
              New Subscription
              <ArrowUpRight className="size-3.5" />
            </Button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto space-y-8 animate-in fade-in-50 duration-500">
          {/* Page heading */}
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-zinc-950 via-zinc-800 to-zinc-700 dark:from-white dark:to-zinc-400">
                Dashboard Overview
              </h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Monitor recurring revenue, recovery rates, and subscription health.
              </p>
            </div>
            <div className="flex items-center gap-2 mt-4 sm:mt-0">
              <div className="inline-flex h-9 items-center justify-center rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800/60 text-zinc-500 dark:text-zinc-400 text-xs font-medium">
                <button className="rounded-md px-3 py-1 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm font-semibold transition-all">Today</button>
                <button className="rounded-md px-3 py-1 hover:text-zinc-900 dark:hover:text-white transition-all">7 Days</button>
                <button className="rounded-md px-3 py-1 hover:text-zinc-900 dark:hover:text-white transition-all">30 Days</button>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Monthly Revenue", value: "₦4,523,189", change: "+12.2%", icon: DollarSign, color: "indigo" },
              { label: "Active Subscriptions", value: "2,350", change: "+18.1%", icon: Zap, color: "emerald" },
              { label: "Recovery Rate", value: "73.4%", change: "+5.2%", icon: Activity, color: "violet" },
              { label: "Active Customers", value: "573", change: "+201 new", icon: Users, color: "amber" },
            ].map(({ label, value, change, icon: Icon, color }) => (
              <div key={label} className="relative overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#121215] p-6 shadow-sm hover:shadow-md transition-all duration-300 group">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{label}</p>
                  <div className={`size-8 rounded-lg flex items-center justify-center bg-${color}-50 dark:bg-${color}-950/40 text-${color}-600 dark:text-${color}-400`}>
                    <Icon className="size-4" />
                  </div>
                </div>
                <div className="mt-4">
                  <h3 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">{value}</h3>
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                    <TrendingUp className="size-3.5" />
                    <span>{change} from last month</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Charts + Transactions */}
          <div className="grid gap-6 lg:grid-cols-7">
            {/* Bar chart */}
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#121215] p-6 lg:col-span-4 flex flex-col justify-between">
              <div>
                <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Revenue Overview</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Weekly recovery and collection breakdown.</p>
              </div>
              <div className="h-64 mt-6 flex items-end gap-3 justify-between px-2">
                {[45, 65, 32, 78, 55, 90, 82].map((height, idx) => {
                  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-2 group/bar">
                      <div className="w-full bg-zinc-100 dark:bg-zinc-800/40 rounded-md h-48 flex items-end relative overflow-hidden">
                        <div
                          style={{ height: `${height}%` }}
                          className="w-full bg-gradient-to-t from-indigo-600 to-violet-500 rounded-md transition-all duration-500 ease-out origin-bottom transform group-hover/bar:brightness-110 shadow-sm"
                        />
                      </div>
                      <span className="text-[10px] font-medium text-zinc-400 group-hover/bar:text-zinc-900 dark:group-hover/bar:text-zinc-200 transition-colors">
                        {days[idx]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Recent transactions */}
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#121215] p-6 lg:col-span-3">
              <div>
                <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Recent Payments</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">265 collections this month.</p>
              </div>
              <div className="mt-6 space-y-4">
                {TRANSACTIONS.map((tx, idx) => (
                  <div key={idx} className="flex items-center justify-between group/row">
                    <div className="flex items-center gap-3">
                      <div className="size-9 rounded-full bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-center text-zinc-600 dark:text-zinc-300 font-semibold text-xs border border-zinc-200/50 dark:border-zinc-800/50">
                        {tx.customer.split(" ").map((n) => n[0]).join("")}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate max-w-[120px]">{tx.customer}</p>
                        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate max-w-[120px]">{tx.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <div className="text-right">
                        <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100">{tx.amount}</p>
                        <p className="text-[9px] text-zinc-400 dark:text-zinc-500">{tx.date}</p>
                      </div>
                      {tx.status === "success" && <span className="size-1.5 rounded-full bg-emerald-500" title="Success" />}
                      {tx.status === "pending" && <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" title="Pending" />}
                      {tx.status === "recovered" && <span className="size-1.5 rounded-full bg-indigo-500" title="Recovered via cascade" />}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
