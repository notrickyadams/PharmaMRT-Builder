import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "PharmaMRP",
  description: "Prescription scan foundation for clinical pharmacists.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      {/* Extensions can add body attributes before React loads.
          This only suppresses this element's warning, not child mismatches. */}
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
