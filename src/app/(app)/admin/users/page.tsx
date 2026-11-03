import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { clerkClient, currentUser } from "@clerk/nextjs/server";
import { UsersRound } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { UsersTable } from "@/components/admin/users-table";
import { isAdminEmail, toUserRow, type UserRow } from "@/lib/admin-users";

export const metadata: Metadata = { title: "Users" };
// Always the current list, never a cached page.
export const dynamic = "force-dynamic";

/**
 * The site owner's list of everyone who has created an account. Only emails
 * in ADMIN_EMAILS can open it; for anyone else the page does not exist.
 */
export default async function AdminUsersPage() {
  const me = await currentUser();
  if (!isAdminEmail(me?.primaryEmailAddress?.emailAddress, process.env.ADMIN_EMAILS)) notFound();

  const client = await clerkClient();
  const rows: UserRow[] = [];
  for (let offset = 0; ; offset += 500) {
    const page = await client.users.getUserList({ limit: 500, offset, orderBy: "-created_at" });
    rows.push(...page.data.map(toUserRow));
    if (page.data.length < 500) break;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={UsersRound}
        eyebrow="Admin"
        title="Users"
        lede="Everyone who has created a ComplyKit account, with the name, mobile and email they gave at sign-up."
      />
      <UsersTable rows={rows} />
    </div>
  );
}
