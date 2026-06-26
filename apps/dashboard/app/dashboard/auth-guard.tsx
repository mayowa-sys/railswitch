"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";

/** Wraps dashboard pages. Redirects to /auth/signin if not authenticated. */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      router.replace("/auth/signin");
    }
  }, [user, router]);

  if (!user) {
    return null;
  }

  return <>{children}</>;
}
