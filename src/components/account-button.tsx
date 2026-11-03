"use client";

import { UserButton } from "@clerk/nextjs";

/** The signed-in user's account menu (manage account, sign out). */
export function AccountButton() {
  return (
    // Shows nothing when signed out (e.g. on the public home page), so no fixed size here.
    <div className="flex items-center px-1">
      <UserButton />
    </div>
  );
}
