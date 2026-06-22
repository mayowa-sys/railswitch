import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Overview — RailSwitch Dashboard",
  description: "Monitor your recurring revenue, payments, and recovery stats.",
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
