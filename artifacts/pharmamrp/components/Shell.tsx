"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DM_Sans, Rubik } from "next/font/google";
import { DEMO_MODE } from "@/lib/config";
import styles from "./workflow.module.css";

const rubik = Rubik({ subsets: ["latin", "arabic"], variable: "--font-head", display: "swap" });
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-body", display: "swap" });

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const active = (href: string) => href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <div className={`${styles.shell} ${rubik.variable} ${dmSans.variable}`}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand}>PharmaMRP</Link>
        <nav aria-label="Primary">
          <Link href="/" aria-current={active("/") ? "page" : undefined}>Home</Link>
          <Link href="/scan" aria-current={active("/scan") ? "page" : undefined}>Scan</Link>
          <Link href="/records" aria-current={active("/records") ? "page" : undefined}>Records</Link>
          <Link href="/administration" aria-current={active("/administration") ? "page" : undefined}>Administration</Link>
          <Link href="/report" aria-current={active("/report") ? "page" : undefined}>Report</Link>
        </nav>
      </header>
      {DEMO_MODE && <div className={styles.demoNotice} role="status">Demo mode · fictional training examples</div>}
      <main>{children}</main>
      <footer className={styles.footer}>
        Fictional training scenario only. Not for real patient care. AI suggests; the pharmacist decides.
      </footer>
    </div>
  );
}
