import { isoDate } from "@/lib/dates";
import type { DuesRow } from "@/lib/portfolio/dues-table";
import type { FilingMatrix, MatrixCell } from "@/lib/portfolio/filing-matrix";
import type { ResolvedDueDate } from "@/lib/resolve-due-dates";

/**
 * Setting one due date across many forms and companies at once — the logic
 * behind the dashboard's "Set due dates" dialog, kept free of React so it is
 * tested directly.
 */

/** One form still to file for a company. */
export type BulkEntry = { columnKey: string; cell: MatrixCell; rows: DuesRow[] };

/** A company with at least one of the chosen forms still to file. */
export type BulkTarget = { clientId: string; company: string; entries: BulkEntry[] };

/**
 * Companies with something still to file in any of the chosen columns, and
 * the names of those to whom the forms apply but who have filed them all.
 */
export function bulkDueTargets(
  matrix: FilingMatrix,
  columnKeys: Iterable<string>,
): { open: BulkTarget[]; filed: string[] } {
  const keys = [...columnKeys];
  const open: BulkTarget[] = [];
  const filed: string[] = [];
  for (const row of matrix.rows) {
    let applies = false;
    const entries: BulkEntry[] = [];
    for (const key of keys) {
      const cell = row.cells[key];
      if (!cell || cell.notRequired) continue;
      applies = true;
      const rows = cell.rows.filter((r) => r.item && r.status !== "completed");
      if (rows.length > 0) entries.push({ columnKey: key, cell, rows });
    }
    if (entries.length > 0) open.push({ clientId: row.clientId, company: row.company, entries });
    else if (applies) filed.push(row.company);
  }
  return { open, filed };
}

/** The date a row would fall on without any date the user set. */
export function usualDue(r: DuesRow): Date {
  return r.item?.originalDue ?? r.due;
}

export type DueChange = {
  clientId: string;
  item: ResolvedDueDate;
  input: { date: string; note?: string } | null;
};

/**
 * The changes to save: the chosen date on every open due of every chosen
 * company. Where the chosen date IS a row's usual date the row is put back
 * on it (null) rather than given an override that changes nothing. With
 * `date` null, every chosen row goes back to its usual date.
 */
export function bulkDueChanges(
  targets: BulkTarget[],
  selected: ReadonlySet<string>,
  date: string | null,
  note?: string,
): DueChange[] {
  return targets
    .filter((t) => selected.has(t.clientId))
    .flatMap((t) =>
      t.entries.flatMap((e) =>
        e.rows.map((r) => ({
          clientId: t.clientId,
          item: r.item!,
          input: date === null || isoDate(usualDue(r)) === date ? null : { date, note },
        })),
      ),
    );
}
