"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AlertOctagon, Pencil, ShieldAlert, Trash2, Users, UsersRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { StatCard, StatCardGrid } from "@/components/shared/stat-card";
import { usePortfolio, useScopedClients } from "@/components/portfolio/portfolio-provider";
import { ScopeNote } from "@/components/portfolio/scope-note";
import { DirectorFormDialog } from "@/components/portfolio/director-form-dialog";
import { KycBadge } from "@/components/portfolio/kyc-badge";
import { initials } from "@/lib/portfolio/clients";
import {
  allDins,
  clientsForDirector,
  dinAt,
  countDirectorships,
  formatMobile,
  kycStatus,
  onMultipleBoards,
} from "@/lib/portfolio/directors";
import { formatDate, parseIsoDate, today } from "@/lib/dates";
import type { Director } from "@/lib/portfolio/types";

export function DirectorMasterView() {
  const { ready, directors: allDirectors, clients: allClients, removeDirector } = usePortfolio();
  // Only the active company's directors (and only that company on each row) when one is selected.
  const { clients, activeClient } = useScopedClients();
  const directors = React.useMemo(
    () =>
      activeClient
        ? allDirectors.filter((d) => d.directorships.some((ds) => ds.clientId === activeClient.id))
        : allDirectors,
    [allDirectors, activeClient],
  );
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Director | null>(null);

  const reference = React.useMemo(() => today(), []);

  const rows = React.useMemo(
    () =>
      directors.map((d) => ({
        director: d,
        kyc: kycStatus(d, reference),
        count: countDirectorships(d, allClients, reference),
        boards: clientsForDirector(d, clients, reference),
      })),
    [directors, clients, allClients, reference],
  );

  const kycPendingCount = rows.filter(
    (r) => r.kyc && (r.kyc.state === "due" || r.kyc.state === "overdue"),
  ).length;
  const multiBoardCount = onMultipleBoards(directors, reference).length;
  const overLimitCount = rows.filter((r) => r.count.overAnyLimit).length;

  function openEdit(d: Director) {
    setEditing(d);
    setFormOpen(true);
  }
  async function onDelete(d: Director) {
    if (!window.confirm(`Remove ${d.name} from the director master?`)) return;
    await removeDirector(d.id);
    toast.success(`${d.name} removed`);
  }

  if (!ready) {
    return <div className="h-64 animate-pulse rounded-lg border bg-muted/30" aria-hidden />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Users}
        eyebrow="Director Master"
        badge="NEW"
        title="Directors, DINs & KYC — Across Every Client"
        lede="Every director on every board you manage, with their DIR-3 KYC cycle and Section 165 directorship count, all in one place."
      />

      <ScopeNote />

      <StatCardGrid>
        <StatCard icon={Users} value={directors.length} label="Directors" />
        <StatCard
          icon={ShieldAlert}
          value={kycPendingCount}
          label="DIR-3 KYC pending"
          tone={kycPendingCount > 0 ? "warn" : "neutral"}
        />
        <StatCard icon={UsersRound} value={multiBoardCount} label="On multiple boards" />
        <StatCard
          icon={AlertOctagon}
          value={overLimitCount}
          label="Over Sec 165 limit"
          tone={overLimitCount > 0 ? "bad" : "neutral"}
        />
      </StatCardGrid>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed py-16 text-center">
          <p className="font-heading text-lg">No directors yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add directors from each company&apos;s Directors tab in{" "}
            <Link href="/portfolio" className="underline underline-offset-4">
              Company Master Data
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Director</TableHead>
                <TableHead>Point of contact</TableHead>
                <TableHead>DIN</TableHead>
                <TableHead>DIR-3 KYC</TableHead>
                <TableHead>Directorships</TableHead>
                <TableHead>Companies</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ director, kyc, count, boards }) => (
                <TableRow key={director.id}>
                  <TableCell className="align-top">
                    <div className="flex items-center gap-2.5">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-[11px] font-bold text-muted-foreground">
                        {initials(director.name)}
                      </span>
                      <span className="font-medium">{director.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="align-top">
                    <AuthorisedPerson director={director} />
                  </TableCell>
                  <TableCell className="align-top font-mono text-sm">
                    {allDins(director).map((din) => (
                      <span key={din} className="block">
                        {din}
                      </span>
                    ))}
                  </TableCell>
                  <TableCell className="align-top">
                    {kyc ? <KycBadge state={kyc.state} /> : "—"}
                  </TableCell>
                  <TableCell className="align-top">
                    <span
                      className={
                        count.overAnyLimit
                          ? "font-mono text-sm font-semibold text-destructive"
                          : "font-mono text-sm"
                      }
                    >
                      {count.total}
                    </span>
                    {count.public > 0 ? (
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({count.public} public)
                      </span>
                    ) : null}
                    {count.overAnyLimit ? (
                      <Badge variant="destructive" className="ml-1.5 text-[9px]">
                        over limit
                      </Badge>
                    ) : null}
                  </TableCell>
                  <TableCell className="align-top">
                    <div className="flex max-w-64 flex-wrap gap-1">
                      {boards.length === 0 && ceasedSeats(director, boards).length === 0 ? (
                        <span className="text-sm text-muted-foreground">—</span>
                      ) : (
                        boards.map((c) => (
                          <Badge key={c.id} variant="outline" className="h-auto flex-col items-start gap-0 py-0.5 text-[10px]">
                            <span>{c.name}</span>
                            {allDins(director).length > 1 ? (
                              <span className="font-mono font-normal text-muted-foreground">DIN {dinAt(director, c.id)}</span>
                            ) : null}
                          </Badge>
                        ))
                      )}
                      {/* Boards left: kept on record, struck through, with the date. */}
                      {ceasedSeats(director, boards).map(({ clientId, cessationOn }) => {
                        const name = clients.find((c) => c.id === clientId)?.name;
                        if (!name) return null;
                        const ceased = parseIsoDate(cessationOn);
                        return (
                          <Badge
                            key={`ceased-${clientId}`}
                            variant="outline"
                            className="h-auto flex-col items-start gap-0 border-dashed py-0.5 text-[10px] text-muted-foreground"
                          >
                            <span className="line-through">{name}</span>
                            <span className="font-normal text-destructive">Ceased {ceased ? formatDate(ceased) : cessationOn}</span>
                          </Badge>
                        );
                      })}
                    </div>
                  </TableCell>
                  <TableCell className="align-top">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7"
                        onClick={() => openEdit(director)}
                      >
                        <Pencil className="size-3.5" aria-hidden />
                        <span className="sr-only">Edit {director.name}</span>
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7 text-destructive hover:text-destructive"
                        onClick={() => onDelete(director)}
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                        <span className="sr-only">Remove {director.name}</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <DirectorFormDialog open={formOpen} onOpenChange={setFormOpen} director={editing} />
    </div>
  );
}


/** "Yes" when the director is the point of contact, else the consultant who is. */
function AuthorisedPerson({ director }: { director: Director }) {
  if (director.isAuthorisedPerson === undefined) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }
  if (director.isAuthorisedPerson) {
    return (
      <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-[10px] text-emerald-700 dark:text-emerald-300">
        Yes — director
      </Badge>
    );
  }
  return (
    <div className="space-y-0.5">
      <Badge variant="outline" className="text-[10px]">
        No — consultant
      </Badge>
      <p className="text-sm font-medium">{director.consultantName ?? "—"}</p>
      {director.consultantMobile ? (
        <a
          href={`tel:+91${director.consultantMobile}`}
          className="tabular block font-mono text-xs text-muted-foreground hover:text-primary"
        >
          {formatMobile(director.consultantMobile)}
        </a>
      ) : null}
    </div>
  );
}

/** Companies this director has left (a cessation date, and not on that board now). */
function ceasedSeats(director: Director, boards: { id: string }[]): { clientId: string; cessationOn: string }[] {
  const current = new Set(boards.map((b) => b.id));
  return director.directorships
    .filter((ds) => ds.cessationOn && !current.has(ds.clientId))
    .map((ds) => ({ clientId: ds.clientId, cessationOn: ds.cessationOn! }));
}
