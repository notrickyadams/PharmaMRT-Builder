import Link from "next/link";
import { Inter, Rubik } from "next/font/google";
import styles from "./workflow.module.css";

const rubik = Rubik({ subsets: ["latin", "arabic"], variable: "--font-head", display: "swap" });
const inter = Inter({ subsets: ["latin"], variable: "--font-body", display: "swap" });

export default function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${styles.shell} ${rubik.variable} ${inter.variable}`}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand}>PharmaMRP</Link>
        <nav aria-label="Primary">
          <Link href="/">Home</Link>
          <Link href="/scan">Scan</Link>
          <Link href="/records">Records</Link>
        </nav>
      </header>
      <main>{children}</main>
      <footer className={styles.footer}>
        Fictional training scenario only. Not for real patient care. AI suggests; the pharmacist decides.
      </footer>
    </div>
  );
}
