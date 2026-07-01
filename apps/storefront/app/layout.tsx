import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Naija Music Pro",
  description: "Premium Nigerian music streaming service",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#0a0a0b", color: "#e4e4e7" }}>
        {children}
      </body>
    </html>
  );
}
