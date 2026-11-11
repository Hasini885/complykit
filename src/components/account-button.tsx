"use client";

import { UserButton } from "@clerk/nextjs";
import { DatabaseBackup } from "lucide-react";

import { DataTransferPage } from "@/components/sync/data-transfer";

/**
 * The signed-in user's account menu (manage account, sign out). Inside the app
 * it also has a Data page to export and import the account's data as JSON; not
 * on the public home page, where the browser's storage is not yet switched to
 * this account.
 */
export function AccountButton({ withDataPage = false }: { withDataPage?: boolean }) {
  return (
    // Shows nothing when signed out (e.g. on the public home page), so no fixed size here.
    <div className="flex items-center px-1">
      {withDataPage ? (
        <UserButton>
          <UserButton.UserProfilePage label="Data" url="data" labelIcon={<DatabaseBackup className="size-4" />}>
            <DataTransferPage />
          </UserButton.UserProfilePage>
        </UserButton>
      ) : (
        <UserButton />
      )}
    </div>
  );
}
