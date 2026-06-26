import type { Metadata } from "next";
import DashboardShell from "@/components/dashboard/dashboard-shell";
import { AuthGuard } from "./auth-guard";

export const metadata: Metadata = {
  title: "RailSwitch Dashboard",
  description: "Monitor recurring revenue, recovery rates, and subscription health.",
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <DashboardShell>{children}</DashboardShell>
    </AuthGuard>
  );
}
