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
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Home() {
  const [activeTab, setActiveTab] = useState("overview");

  // Mock data for recent transactions
  const transactions = [
    { id: "tx_01J0A1", customer: "Olivia Martin", email: "olivia.martin@email.com", amount: "+$1,999.00", status: "success", date: "Just now" },
    { id: "tx_01J0A2", customer: "Jackson Lee", email: "jackson.lee@email.com", amount: "+$39.00", status: "success", date: "1 hour ago" },
    { id: "tx_01J0A3", customer: "Isabella Nguyen", email: "isabella.nguyen@email.com", amount: "+$299.00", status: "pending", date: "3 hours ago" },
    { id: "tx_01J0A4", customer: "William Kim", email: "will@email.com", amount: "-$99.00", status: "failed", date: "Yesterday" },
    { id: "tx_01J0A5", customer: "Sofia Davis", email: "sofia.davis@email.com", amount: "+$39.00", status: "success", date: "2 days ago" },
  ];

  return (
    <div className="flex h-screen w-full bg-zinc-50 dark:bg-[#0c0c0e] font-sans text-zinc-900 dark:text-zinc-100 overflow-hidden">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#0c0c0e]/50 backdrop-blur-md">
        <div className="h-16 flex items-center px-6 border-b border-zinc-200 dark:border-zinc-800/80">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Activity className="size-4 animate-pulse" />
            </div>
            <span className="font-bold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-600 dark:from-white dark:to-zinc-400">
              Railswitch
            </span>
          </div>
        </div>
        
        <nav className="flex-1 px-4 py-6 space-y-1.5">
          <button 
            onClick={() => setActiveTab("overview")}
            className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
              activeTab === "overview" 
                ? "bg-zinc-100 dark:bg-zinc-800/80 text-zinc-950 dark:text-white" 
                : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800/30"
            }`}
          >
            <LayoutDashboard className="size-4" />
            Overview
          </button>
          <button 
            onClick={() => setActiveTab("transactions")}
            className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
              activeTab === "transactions" 
                ? "bg-zinc-100 dark:bg-zinc-800/80 text-zinc-950 dark:text-white" 
                : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800/30"
            }`}
          >
            <CreditCard className="size-4" />
            Transactions
          </button>
          <button 
            onClick={() => setActiveTab("customers")}
            className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
              activeTab === "customers" 
                ? "bg-zinc-100 dark:bg-zinc-800/80 text-zinc-950 dark:text-white" 
                : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800/30"
            }`}
          >
            <Users className="size-4" />
            Customers
          </button>
        </nav>

        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800/80">
          <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/30 cursor-pointer transition-colors duration-200">
            <div className="size-8 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center font-semibold text-xs text-zinc-700 dark:text-zinc-300">
              JD
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">John Doe</p>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">john@railswitch.dev</p>
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
                placeholder="Search transactions, customers..."
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
              Create Payment
              <ArrowUpRight className="size-3.5" />
            </Button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto space-y-8 animate-in fade-in-50 duration-500">
          {/* Welcome Message */}
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-zinc-950 via-zinc-800 to-zinc-700 dark:from-white dark:to-zinc-400">
                Dashboard Overview
              </h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Here's what is happening with your payments store today.
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Stat Card 1 */}
            <div className="relative overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#121215] p-6 shadow-sm hover:shadow-md transition-all duration-300 group">
              <div className="absolute top-0 right-0 p-3 opacity-[0.02] dark:opacity-[0.05] group-hover:scale-110 transition-transform duration-300">
                <DollarSign className="size-24" />
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Total Revenue</p>
                <div className="size-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <DollarSign className="size-4" />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">$45,231.89</h3>
                <div className="mt-1 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                  <TrendingUp className="size-3.5" />
                  <span>+12.2% from last month</span>
                </div>
              </div>
            </div>

            {/* Stat Card 2 */}
            <div className="relative overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#121215] p-6 shadow-sm hover:shadow-md transition-all duration-300 group">
              <div className="absolute top-0 right-0 p-3 opacity-[0.02] dark:opacity-[0.05] group-hover:scale-110 transition-transform duration-300">
                <CreditCard className="size-24" />
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Payments</p>
                <div className="size-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <CreditCard className="size-4" />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">+2,350</h3>
                <div className="mt-1 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                  <TrendingUp className="size-3.5" />
                  <span>+18.1% from last month</span>
                </div>
              </div>
            </div>

            {/* Stat Card 3 */}
            <div className="relative overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#121215] p-6 shadow-sm hover:shadow-md transition-all duration-300 group sm:col-span-2 lg:col-span-1">
              <div className="absolute top-0 right-0 p-3 opacity-[0.02] dark:opacity-[0.05] group-hover:scale-110 transition-transform duration-300">
                <Users className="size-24" />
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Active Customers</p>
                <div className="size-8 rounded-lg bg-violet-50 dark:bg-violet-950/40 flex items-center justify-center text-violet-600 dark:text-violet-400">
                  <Users className="size-4" />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">+573</h3>
                <div className="mt-1 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                  <TrendingUp className="size-3.5" />
                  <span>+201 new this week</span>
                </div>
              </div>
            </div>
          </div>

          {/* Detailed Stats & Tables */}
          <div className="grid gap-6 lg:grid-cols-7">
            {/* Sales Chart representation */}
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#121215] p-6 lg:col-span-4 flex flex-col justify-between">
              <div>
                <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Overview</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Weekly sales distribution model.</p>
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
                        ></div>
                      </div>
                      <span className="text-[10px] font-medium text-zinc-400 group-hover/bar:text-zinc-900 dark:group-hover/bar:text-zinc-200 transition-colors">
                        {days[idx]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Recent Payments list */}
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#121215] p-6 lg:col-span-3">
              <div>
                <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Recent Sales</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">You made 265 sales this month.</p>
              </div>

              <div className="mt-6 space-y-4">
                {transactions.map((tx, idx) => (
                  <div key={idx} className="flex items-center justify-between group/row">
                    <div className="flex items-center gap-3">
                      <div className="size-9 rounded-full bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-center text-zinc-600 dark:text-zinc-300 font-semibold text-xs border border-zinc-200/50 dark:border-zinc-800/50">
                        {tx.customer.split(" ").map(n => n[0]).join("")}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate max-w-[140px]">{tx.customer}</p>
                        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate max-w-[140px]">{tx.email}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2.5">
                      <div className="text-right">
                        <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100">{tx.amount}</p>
                        <p className="text-[9px] text-zinc-400 dark:text-zinc-500">{tx.date}</p>
                      </div>
                      
                      {tx.status === "success" && (
                        <span className="size-1.5 rounded-full bg-emerald-500" title="Success"></span>
                      )}
                      {tx.status === "pending" && (
                        <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" title="Pending"></span>
                      )}
                      {tx.status === "failed" && (
                        <span className="size-1.5 rounded-full bg-rose-500" title="Failed"></span>
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

