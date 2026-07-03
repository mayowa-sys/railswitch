import { Suspense } from "react";
import PortalShell from "@/components/portal/portal-shell";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <PortalShell>{children}</PortalShell>
    </Suspense>
  );
}
