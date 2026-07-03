import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FitCore Nigeria — Premium Fitness Memberships",
  description: "Join Nigeria's fastest-growing fitness chain. Flexible memberships with smart recurring billing powered by RailSwitch.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-zinc-900 font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
