"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Tip } from "@/components/shared/tip";
import { ExcelIcon } from "@/components/shared/file-type-icon";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, isoDate } from "@/lib/dates";
import { formatMobile } from "@/lib/portfolio/mobile";
import type { UserRow } from "@/lib/admin-users";

const when = (ms: number | null) => (ms ? formatDate(new Date(ms)) : "—");

/** Everyone with an account, and an Excel download of the same list. */
export function UsersTable({ rows }: { rows: UserRow[] }) {
  const [busy, setBusy] = React.useState(false);

  async function download() {
    setBusy(true);
    try {
      const { default: writeXlsxFile } = await import("write-excel-file/browser");
      const head = ["Name", "Mobile", "Email", "Joined", "Last sign-in"].map((value) => ({
        value,
        fontWeight: "bold" as const,
        backgroundColor: "#344054",
        textColor: "#FFFFFF",
      }));
      const body = rows.map((r) => [
        { value: r.name },
        { value: r.mobile ? formatMobile(r.mobile) : "" },
        { value: r.email },
        { value: when(r.joinedAt) },
        { value: when(r.lastSignInAt) },
      ]);
      const blob = await writeXlsxFile([head, ...body], {
        columns: [{ width: 28 }, { width: 16 }, { width: 34 }, { width: 14 }, { width: 14 }],
        sheet: "Users",
      }).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cacompliancetool-users-${isoDate(new Date())}.xlsx`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      toast.success(`Downloaded ${rows.length} ${rows.length === 1 ? "user" : "users"}`);
    } catch (error) {
      console.error("Users export failed", error);
      toast.error("The Excel file could not be created. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">
          {rows.length} {rows.length === 1 ? "user" : "users"}
        </p>
        <Tip label="Download all users (Excel)">
          <Button
            size="icon"
            variant="outline"
            onClick={download}
            disabled={busy || rows.length === 0}
            aria-label="Download all users as Excel"
          >
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ExcelIcon />}
          </Button>
        </Tip>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Mobile</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead>Last sign-in</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                  No accounts yet.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name || "—"}</TableCell>
                  <TableCell className="tabular whitespace-nowrap">
                    {r.mobile ? (
                      <a href={`tel:+91${r.mobile}`} className="hover:text-primary hover:underline">
                        {formatMobile(r.mobile)}
                      </a>
                    ) : (
                      <span className="text-muted-foreground">not given</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <a href={`mailto:${r.email}`} className="hover:text-primary hover:underline">
                      {r.email}
                    </a>
                  </TableCell>
                  <TableCell className="tabular whitespace-nowrap">{when(r.joinedAt)}</TableCell>
                  <TableCell className="tabular whitespace-nowrap">{when(r.lastSignInAt)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
