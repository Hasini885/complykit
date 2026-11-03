import { AppShell } from "@/components/app-shell";

/** Every tool page gets the app chrome: top nav, company switcher, footer. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
