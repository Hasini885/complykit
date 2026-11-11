import Link from "next/link";
import { Sparkles } from "lucide-react";

import { formatInr } from "@/lib/fees";
import type { Access } from "@/lib/billing";

/** "Free trial: 12 days left", and a renewal nudge in a paid year's last month. */
export function SubscriptionBanner({ access, price }: { access: Access; price: number }) {
  const trial = access.state === "trial";
  const renewSoon = access.state === "paid" && access.daysLeft !== null && access.daysLeft <= 30;
  if ((!trial && !renewSoon) || price <= 0) return null;
  const days = access.daysLeft ?? 0;
  return (
    <div className="border-b border-primary/20 bg-primary/5 print:hidden">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-xs sm:px-6 lg:px-8">
        <Sparkles className="size-3.5 shrink-0 text-primary" aria-hidden />
        <p>
          <span className="font-semibold">
            {trial ? "Free trial" : "Your yearly plan"}: {days} day{days === 1 ? "" : "s"} left.
          </span>{" "}
          {trial
            ? `After that it is ${formatInr(price)} a year.`
            : `Renew for ${formatInr(price)} to keep using it without a break.`}
        </p>
        <Link href="/billing" className="font-semibold text-primary hover:underline">
          {trial ? "Subscribe now" : "Renew now"}
        </Link>
      </div>
    </div>
  );
}
