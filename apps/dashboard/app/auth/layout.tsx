import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Authentication — RailSwitch",
  description: "Sign in or create your RailSwitch merchant account.",
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-[#09090b]">
      {/* Decorative gradient blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-[600px] w-[600px] rounded-full bg-gradient-to-br from-indigo-400/20 to-violet-400/20 blur-3xl dark:from-indigo-900/30 dark:to-violet-900/30" />
        <div className="absolute -bottom-40 -left-40 h-[500px] w-[500px] rounded-full bg-gradient-to-tr from-violet-400/20 to-indigo-400/20 blur-3xl dark:from-violet-900/30 dark:to-indigo-900/30" />
      </div>

      <main className="relative flex-1 flex items-center justify-center py-12 px-4">
        {children}
      </main>

      <footer className="relative py-4 text-center text-xs text-zinc-400 dark:text-zinc-500">
        © {new Date().getFullYear()} RailSwitch. All rights reserved.
      </footer>
    </div>
  );
}
