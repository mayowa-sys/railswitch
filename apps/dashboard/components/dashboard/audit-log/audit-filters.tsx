"use client";

import { SearchFilterBar } from "@/components/shared/search-filter-bar";
import { SUBSCRIPTIONS, CUSTOMERS } from "@/lib/mock-data";

const ACTOR_TYPE_OPTIONS = [
  { value: "system", label: "System" },
  { value: "merchant", label: "Merchant" },
  { value: "customer", label: "Customer" },
];

const SUBSCRIPTION_OPTIONS = SUBSCRIPTIONS.map((s) => {
  const customer = CUSTOMERS.find((c) => c.id === s.customerId);
  return {
    value: s.id,
    label: customer ? `${customer.name} (${s.id})` : s.id,
  };
});

const TIME_RANGE_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
];

interface AuditFiltersProps {
  search: string;
  onSearchChange: (v: string) => void;
  actorFilter: string;
  onActorChange: (v: string) => void;
  subscriptionFilter: string;
  onSubscriptionChange: (v: string) => void;
  timeFilter: string;
  onTimeChange: (v: string) => void;
  onClearAll: () => void;
  hasActiveFilters: boolean;
}

export function AuditFilters({
  search,
  onSearchChange,
  actorFilter,
  onActorChange,
  subscriptionFilter,
  onSubscriptionChange,
  timeFilter,
  onTimeChange,
  onClearAll,
  hasActiveFilters,
}: AuditFiltersProps) {
  return (
    <SearchFilterBar
      searchValue={search}
      onSearchChange={onSearchChange}
      searchPlaceholder="Search by reason or actor…"
      filters={[
        {
          key: "actor",
          placeholder: "All actors",
          options: ACTOR_TYPE_OPTIONS,
          value: actorFilter,
          onChange: onActorChange,
        },
        {
          key: "subscription",
          placeholder: "All subscriptions",
          options: SUBSCRIPTION_OPTIONS,
          value: subscriptionFilter,
          onChange: onSubscriptionChange,
        },
        {
          key: "time",
          placeholder: "Any time",
          options: TIME_RANGE_OPTIONS,
          value: timeFilter,
          onChange: onTimeChange,
        },
      ]}
      hasActiveFilters={hasActiveFilters}
      onClearAll={onClearAll}
    />
  );
}
