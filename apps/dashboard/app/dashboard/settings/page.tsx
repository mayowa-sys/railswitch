"use client";

import { PageHeader } from "@/components/shared/page-header";
import { DunningTab } from "@/components/dashboard/settings/dunning-tab";
import { WebhooksTab } from "@/components/dashboard/settings/webhooks-tab";
import { DevelopersTab } from "@/components/dashboard/settings/developers-tab";
import { Shield, Webhook, Code2 } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "dunning",    label: "Dunning",    icon: Shield,   description: "Recovery policy" },
  { id: "webhooks",   label: "Webhooks",   icon: Webhook,  description: "Endpoints & logs" },
  { id: "developers", label: "Developers", icon: Code2,    description: "API keys" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("dunning");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Configure dunning policies, webhook endpoints, and API credentials for NaijaMusicPro."
      />

      {/* ── Custom tab bar ── */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-800/60 w-fit">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium transition-all duration-200",
                active
                  ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
              )}
            >
              <Icon className={cn("size-3.5", active ? "text-indigo-600 dark:text-indigo-400" : "text-zinc-400 dark:text-zinc-500")} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Tab content ── */}
      <div className="animate-in fade-in-50 duration-300" key={activeTab}>
        {activeTab === "dunning" && <DunningTab />}
        {activeTab === "webhooks" && <WebhooksTab />}
        {activeTab === "developers" && <DevelopersTab />}
      </div>
    </div>
  );
}
