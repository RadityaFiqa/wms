import { Plus_Jakarta_Sans } from "next/font/google";

// Scoped to the analytics page only; the rest of the app keeps its current font
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], display: "swap" });

export default function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  return <div className={jakarta.className}>{children}</div>;
}
