"use client";

import { useState } from "react";
import { 
  LayoutDashboard, 
  ArrowUpRight, 
  ArrowDownRight, 
  DollarSign, 
  Activity, 
  CreditCard, 
  Users, 
  Search, 
  Bell, 
  ChevronDown,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  Receipt,
  ShieldCheck,
  Wallet,
  Settings,
  HelpCircle,
  ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Home() {
  const [activeTab, setActiveTab] = useState("dashboard");

  // Mock data for customer invoices
  const invoices = [
    { id: "INV-2026-004", service: "Enterprise Cloud Hosting", amount: "$890.00", status: "paid", date: "June 15, 2026" },
    { id: "INV-2026-003", service: "Premium API Access", amount: "$150.00", status: "paid", date: "May 15, 2026" },
    { id: "INV-2026-002", service: "SSL Certificate (Annual)", amount: "$49.00", status: "paid", date: "April 22, 2026" },
    { id: "INV-2026-001", service: "Custom Domain Registration", amount: "$12.00", status: "paid", date: "April 18, 2026" },
    { id: "INV-2026-005", service: "Professional Consulting (2hr)", amount: "$300.00", status: "pending", date: "Due in 3 days" },
  ];

  // Mock subscriptions
  const subscriptions = [
    { name: "Enterprise Cloud Hosting", price: "$890.00/mo", status: "active" },
    { name: "Premium API Access", price: "$150.00/mo", status: "active" },
    { name: "Developer Support Add-on", price: "$99.00/mo", status: "paused" },
  ];

  return (
    <div className="flex h-screen w-full bg-zinc-50 dark:bg-[#0c0c0e] font-sans text-zinc-900 dark:text-zinc-100 overflow-hidden">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#0c0c0e]/50 backdrop-blur-md">
        <div className="h-16 flex items-center px-6 border-b border-zinc-200 dark:border-zinc-800/80">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <ShieldCheck className="size-4 animate-pulse" />
            </div>
            <span className="font-bold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-600 dark:from-white dark:to-zinc-400">
              Railswitch Portal
            </span>
          </div>
        </div>
        
        <nav className="flex-1 px-4 py-6 space-y-1.5">
          <button 
            onClick={() => setActiveTab("dashboard")}
            className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
              activeTab === "dashboard" 
                ? "bg-zinc-100 dark:bg-zinc-800/80 text-zinc-950 dark:text-white" 
                : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800/30"
            }`}
          >
            <LayoutDashboard className="size-4" />
            Dashboard
          </button>
          <button 
            onClick={() => setActiveTab("invoices")}
            className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
              activeTab === "invoices" 
                ? "bg-zinc-100 dark:bg-zinc-800/80 text-zinc-950 dark:text-white" 
                : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800/30"
            }`}
          >
            <Receipt className="size-4" />
            Invoices
          </button>
          <button 
            onClick={() => setActiveTab("subscriptions")}
            className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
              activeTab === "subscriptions" 
                ? "bg-zinc-100 dark:bg-zinc-800/80 text-zinc-950 dark:text-white" 
                : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800/30"
            }`}
          >
            <CreditCard className="size-4" />
            Subscriptions
          </button>
          <button 
            onClick={() => setActiveTab("payment-methods")}
            className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
              activeTab === "payment-methods" 
                ? "bg-zinc-100 dark:bg-zinc-800/80 text-zinc-950 dark:text-white" 
                : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800/30"
            }`}
          >
            <Wallet className="size-4" />
            Payment Methods
          </button>
          <button 
            onClick={() => setActiveTab("settings")}
            className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
              activeTab === "settings" 
                ? "bg-zinc-100 dark:bg-zinc-800/80 text-zinc-950 dark:text-white" 
                : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800/30"
            }`}
          >
            <Settings className="size-4" />
            Portal Settings
          </button>
        </nav>

        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800/80">
          <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/30 cursor-pointer transition-colors duration-200">
            <div className="size-8 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center font-semibold text-xs text-zinc-700 dark:text-zinc-300">
              JD
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">John Doe</p>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">john.doe@acme.corp</p>
            </div>
            <ChevronDown className="size-3.5 text-zinc-400" />
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
                placeholder="Search invoices, services..."
                className="w-full h-9 pl-9 pr-4 rounded-lg bg-zinc-100 dark:bg-zinc-800/50 border border-transparent focus:border-zinc-200 dark:focus:border-zinc-800 focus:bg-white dark:focus:bg-[#0c0c0e] text-sm transition-all outline-none"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon-sm" className="relative text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">
              <Bell className="size-4" />
              <span className="absolute top-1 right-1 size-1.5 rounded-full bg-indigo-600 dark:bg-indigo-500"></span>
            </Button>
            <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800"></div>
            <Button variant="outline" size="sm" className="gap-1.5 font-medium">
              Help Center
              <HelpCircle className="size-3.5" />
            </Button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto space-y-8 animate-in fade-in-50 duration-500">
          {/* Welcome Message */}
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-zinc-950 via-zinc-800 to-zinc-700 dark:from-white dark:to-zinc-400">
                Customer Billing Portal
              </h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Manage your services, billing methods, and download past invoices.
              </p>
            </div>
            <div className="flex items-center gap-2 mt-4 sm:mt-0">
              <div className="inline-flex h-9 items-center justify-center rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800/60 text-zinc-500 dark:text-zinc-400 text-xs font-medium">
                <button className="rounded-md px-3 py-1 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm font-semibold transition-all">Overview</button>
                <button className="rounded-md px-3 py-1 hover:text-zinc-900 dark:hover:text-white transition-all">Statements</button>
                <button className="rounded-md px-3 py-1 hover:text-zinc-900 dark:hover:text-white transition-all">Access logs</button>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Stat Card 1 */}
            <div className="relative overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#121215] p-6 shadow-sm hover:shadow-md transition-all duration-300 group">
              <div className="absolute top-0 right-0 p-3 opacity-[0.02] dark:opacity-[0.05] group-hover:scale-110 transition-transform duration-300">
                <DollarSign className="size-24" />
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Total Spent (YTD)</p>
                <div className="size-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <DollarSign className="size-4" />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">$1,401.00</h3>
                <div className="mt-1 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                  <TrendingUp className="size-3.5" />
                  <span>Fully paid; no outstanding balance</span>
                </div>
              </div>
            </div>

            {/* Stat Card 2 */}
            <div className="relative overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#121215] p-6 shadow-sm hover:shadow-md transition-all duration-300 group">
              <div className="absolute top-0 right-0 p-3 opacity-[0.02] dark:opacity-[0.05] group-hover:scale-110 transition-transform duration-300">
                <Activity className="size-24" />
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Active Subscriptions</p>
                <div className="size-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <Activity className="size-4" />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">2 Services</h3>
                <div className="mt-1 flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 font-semibold">
                  <Clock className="size-3.5" />
                  <span>Next renewal: July 15, 2026</span>
                </div>
              </div>
            </div>

            {/* Stat Card 3 */}
            <div className="relative overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#121215] p-6 shadow-sm hover:shadow-md transition-all duration-300 group sm:col-span-2 lg:col-span-1">
              <div className="absolute top-0 right-0 p-3 opacity-[0.02] dark:opacity-[0.05] group-hover:scale-110 transition-transform duration-300">
                <Wallet className="size-24" />
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Primary Payment</p>
                <div className="size-8 rounded-lg bg-violet-50 dark:bg-violet-950/40 flex items-center justify-center text-violet-600 dark:text-violet-400">
                  <Wallet className="size-4" />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">Visa •••• 4242</h3>
                <div className="mt-1 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                  <CheckCircle2 className="size-3.5" />
                  <span>Auto-pay enabled and active</span>
                </div>
              </div>
            </div>
          </div>

          {/* Detailed Stats & Tables */}
          <div className="grid gap-6 lg:grid-cols-7">
            {/* Subscriptions overview */}
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#121215] p-6 lg:col-span-4 flex flex-col justify-between">
              <div>
                <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Your Active Services</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Manage auto-renew and billing tiers.</p>
              </div>
              
              <div className="mt-6 space-y-4 flex-1 flex flex-col justify-center">
                {subscriptions.map((sub, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 rounded-lg border border-zinc-100 dark:border-zinc-800/60 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20 transition-all">
                    <div>
                      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{sub.name}</p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">{sub.price}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {sub.status === "active" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                          <CheckCircle2 className="size-3" /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-600 dark:bg-zinc-800/80 dark:text-zinc-400">
                          <Clock className="size-3" /> Paused
                        </span>
                      )}
                      <Button variant="outline" size="sm" className="h-8 text-xs">
                        Configure
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Invoices list */}
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#121215] p-6 lg:col-span-3">
              <div>
                <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Invoice History</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">View and download your billing statements.</p>
              </div>

              <div className="mt-6 space-y-4">
                {invoices.map((inv, idx) => (
                  <div key={idx} className="flex items-center justify-between group/row">
                    <div className="flex items-center gap-3">
                      <div className="size-9 rounded-full bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-center text-zinc-600 dark:text-zinc-300 border border-zinc-200/50 dark:border-zinc-800/50">
                        <Receipt className="size-4" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate max-w-[140px]">{inv.service}</p>
                        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate max-w-[140px]">{inv.id}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2.5">
                      <div className="text-right">
                        <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100">{inv.amount}</p>
                        <p className="text-[9px] text-zinc-400 dark:text-zinc-500">{inv.date}</p>
                      </div>
                      
                      {inv.status === "paid" ? (
                        <span className="size-1.5 rounded-full bg-emerald-500" title="Paid"></span>
                      ) : (
                        <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" title="Pending"></span>
                      )}
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
