import { AppShell } from "@/components/app-shell";

/**
 * Every tool page gets the app chrome: top nav, footer, and the subscription
 * check. The check runs once in the browser (AppShell), not here: a server
 * check would make every page dynamic, so each click would wait for the server
 * instead of opening a prefetched page at once.
 */
export default function AppLayout({ children }) {
  return <AppShell>{children}</AppShell>;
}
