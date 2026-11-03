"use client";

import * as React from "react";
import { Check, Save, UserPlus, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { dinInput, mobileInput, personNameInput, srnInput } from "@/lib/input-filters";
import { usePortfolio } from "@/components/portfolio/portfolio-provider";
import {
  allDins,
  formatMobile,
  normaliseMobile,
  validateDirector,
  type DirectorDraft,
} from "@/lib/portfolio/directors";
import { cn } from "@/lib/utils";
import { addDays, formatDate, isoDate, parseIsoDate, today } from "@/lib/dates";
import type { Seat } from "@/lib/portfolio/board";
import { initials, typeLabel } from "@/lib/portfolio/clients";
import { CESSATION_REASONS, type CessationReason, type Client, type Director } from "@/lib/portfolio/types";

/** What the law says about each way of ceasing, shown under the date. */
const CESSATION_NOTE: Record<CessationReason, string> = {
  resignation:
    "Section 168: the resignation takes effect from the date the company receives the notice, or a later date the director names in it.",
  removal:
    "Section 169: removal by ordinary resolution at a general meeting, on special notice, after the director has had a chance to be heard.",
  vacation:
    "Section 167: the office falls vacant by law, e.g. on disqualification under Section 164, or absence from all Board meetings for twelve months.",
  retirement:
    "Section 152(6): a director retiring by rotation who is not re-appointed at the AGM ceases at the end of that meeting.",
  death: "The office ceases on the date of death.",
  other: "Record the date on which the office actually ended.",
};

/**
 * Add / edit a director and which clients they sit on the board of.
 *
 * Company assignment is deliberately a plain checklist rather than a per-row
 * role/date editor — a director's role and appointment date at each company
 * matter for governance records, but this master list exists to answer "which
 * boards is this person on", not to replace the Board resolution paperwork.
 *
 * Inside the company (master data) form it runs in draft mode: `onDraft` is
 * given, the Board-of checklist is hidden (the company is the board) and
 * nothing is saved — the details go back to that form, which saves them with
 * the company. `onDraft` returns field errors, or null when it accepts them.
 */
export function DirectorFormDialog({
  open,
  onOpenChange,
  director,
  initialDraft,
  initialSeat,
  defaultAppointedOn,
  onDraft,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  director?: Director | null;
  /** Draft mode: the details to start from (an entry being edited in the company form). */
  initialDraft?: DirectorDraft | null;
  /** Draft mode: the appointment and cessation at that company. */
  initialSeat?: Seat | null;
  /** Draft mode: the appointment date a new director starts with (the company's incorporation). */
  defaultAppointedOn?: string;
  /** Draft mode: receives the details instead of saving them. */
  onDraft?: (draft: DirectorDraft, seat: Seat) => Record<string, string> | null;
}) {
  const { clients } = usePortfolio();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {open ? (
          <DirectorFormFields
            director={director ?? null}
            initialDraft={initialDraft ?? null}
            initialSeat={initialSeat ?? null}
            defaultAppointedOn={defaultAppointedOn}
            onDraft={onDraft}
            clients={clients}
            onDone={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function DirectorFormFields({
  director,
  initialDraft,
  initialSeat,
  defaultAppointedOn,
  onDraft,
  clients,
  onDone,
}: {
  director: Director | null;
  initialDraft: DirectorDraft | null;
  initialSeat: Seat | null;
  defaultAppointedOn?: string;
  onDraft?: (draft: DirectorDraft, seat: Seat) => Record<string, string> | null;
  clients: Client[];
  onDone: () => void;
}) {
  const { directors, consultants, addDirector, updateDirector } = usePortfolio();
  const draftMode = onDraft !== undefined;
  // Where the fields start: the saved director, or the company form's entry.
  const source: DirectorDraft | null = director ?? initialDraft;
  // Draft mode: appointment and cessation at the company being edited.
  // A new director starts on the company's incorporation date: the first
  // directors are appointed when the company is registered.
  const [appointedOn, setAppointedOn] = React.useState(
    initialSeat?.appointedOn ?? (defaultAppointedOn || isoDate(today())),
  );
  const [cessationOn, setCessationOn] = React.useState(initialSeat?.cessationOn ?? "");
  const [cessationReason, setCessationReason] = React.useState<CessationReason>(
    initialSeat?.cessationReason ?? "resignation",
  );
  const [name, setName] = React.useState(source?.name ?? "");
  const [din, setDin] = React.useState(source?.din ?? "");
  // No longer asked for (removed at the owner's request); a date saved earlier is kept.
  const [dinAllottedOn] = React.useState(source?.dinAllottedOn ?? "");
  const [lastKycFiledOn, setLastKycFiledOn] = React.useState(source?.lastKycFiledOn ?? "");
  const [lastKycSrn, setLastKycSrn] = React.useState(source?.lastKycSrn ?? "");
  // New directors default to being the point of contact; older records that
  // never answered also open on "Yes", and saving records the answer.
  const [isAuthorised, setIsAuthorised] = React.useState(source?.isAuthorisedPerson ?? true);
  const [consultantName, setConsultantName] = React.useState(source?.consultantName ?? "");
  const [consultantMobile, setConsultantMobile] = React.useState(
    source?.consultantMobile ? formatMobile(source.consultantMobile) : "",
  );
  const [selected, setSelected] = React.useState<Set<string>>(
    () => new Set(source?.directorships.map((d) => d.clientId) ?? []),
  );
  // The DIN at each company, where it differs from the main one (blank = main DIN).
  const [seatDins, setSeatDins] = React.useState<Record<string, string>>(() =>
    Object.fromEntries((source?.directorships ?? []).filter((d) => d.din).map((d) => [d.clientId, d.din!])),
  );
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);
  // A DIN belongs to one person: say so as soon as a saved one is typed.
  const sameDin =
    din.length === 8 && !(source && source.din === din)
      ? directors.find((d) => allDins(d).includes(din) && d.id !== director?.id) ?? null
      : null;

  function toggle(clientId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(clientId)) next.delete(clientId);
      else next.add(clientId);
      return next;
    });
  }

  async function onSubmit(e: React.FormEvent) {
    // The company form may sit behind this dialog: its own submit must not fire.
    e.preventDefault();
    e.stopPropagation();

    const existingDirectorships = new Map(
      director?.directorships.map((d) => [d.clientId, d]) ?? [],
    );
    const draft: DirectorDraft = {
      name,
      din,
      dinAllottedOn,
      lastKycFiledOn: lastKycFiledOn || null,
      lastKycSrn: lastKycSrn || null,
      isAuthorisedPerson: isAuthorised,
      consultantName: isAuthorised ? undefined : consultantName,
      consultantMobile: isAuthorised ? undefined : consultantMobile,
      directorships: [...selected].map((clientId) => ({
        ...(existingDirectorships.get(clientId) ?? {
          clientId,
          role: "Director",
          appointedOn: isoDate(today()),
        }),
        din: seatDins[clientId]?.trim() || undefined,
      })),
    };

    if (onDraft) {
      const appointed = parseIsoDate(appointedOn);
      const ceased = cessationOn ? parseIsoDate(cessationOn) : null;
      const seatProblem = !appointed
        ? "Enter the date of appointment."
        : cessationOn && !ceased
          ? "That date of cessation is not valid."
          : ceased && ceased.getTime() < appointed.getTime()
            ? "The date of cessation is before the date of appointment."
            : null;
      if (seatProblem) {
        setErrors({ seat: seatProblem });
        return;
      }
      // Draft mode: the company form keeps the board, so the directorships stay as they were.
      const problems = onDraft(
        { ...draft, directorships: source?.directorships ?? [] },
        { appointedOn, cessationOn: cessationOn || null, cessationReason: cessationOn ? cessationReason : undefined },
      );
      if (problems) setErrors(problems);
      else onDone();
      return;
    }

    const found = validateDirector(draft, directors, director?.id);
    if (found.length > 0) {
      setErrors(Object.fromEntries(found.map((f) => [f.field, f.message])));
      return;
    }
    setSaving(true);
    try {
      if (director) {
        await updateDirector(director.id, draft);
        toast.success(`${name} updated`);
      } else {
        await addDirector(draft);
        toast.success(`${name} added`);
      }
      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{source ? "Edit director" : "Add a director"}</DialogTitle>
        <DialogDescription>
          {draftMode
            ? "Saved with the company when you save it."
            : director
              ? "Update this director's particulars and board memberships."
              : "Add a director and the client companies they sit on the board of."}
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <Field label="Full name" error={errors.name}>
            <Input value={name} onChange={(e) => setName(personNameInput(e.target.value).toUpperCase())} maxLength={100} autoFocus />
          </Field>
          {/* In a company's Directors tab the consultant is set on the Consultant tab instead. */}
          {draftMode ? null : (
          <div className="space-y-1.5">
            <p
              id="authorised-person-label"
              className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground"
            >
              Point of contact?
            </p>
            <div
              role="radiogroup"
              aria-labelledby="authorised-person-label"
              className="inline-flex h-9 rounded-full border bg-muted/40 p-0.5"
            >
              {([true, false] as const).map((value) => (
                <button
                  key={String(value)}
                  type="button"
                  role="radio"
                  aria-checked={isAuthorised === value}
                  onClick={() => setIsAuthorised(value)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-4 text-sm font-medium transition-colors",
                    isAuthorised === value
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {value ? <Check className="size-3.5" aria-hidden /> : <X className="size-3.5" aria-hidden />}
                  {value ? "Yes" : "No"}
                </button>
              ))}
            </div>
          </div>
          )}
        </div>

        {isAuthorised || draftMode ? null : (
          <div className="space-y-3 rounded-2xl border border-dashed bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">
              Someone other than this director is the point of contact. They are recorded as
              the <span className="font-semibold text-foreground">consultant</span>.
            </p>
            {consultants.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-muted-foreground">From the Consultant Master:</span>
                {consultants.map((c) => {
                  const picked = consultantName.trim() === c.name && normaliseMobile(consultantMobile) === c.mobile;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setConsultantName(c.name);
                        setConsultantMobile(formatMobile(c.mobile));
                      }}
                      aria-pressed={picked}
                      className={cn(
                        "rounded-full border px-2.5 py-0.5 text-xs transition-colors hover:bg-primary/10",
                        picked && "border-primary bg-primary/10 text-primary",
                      )}
                    >
                      {c.name}
                    </button>
                  );
                })}
              </div>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Consultant name" error={errors.consultantName}>
                <Input
                  value={consultantName}
                  onChange={(e) => setConsultantName(personNameInput(e.target.value))}
                  maxLength={100}
                  placeholder="Point of contact's name"
                />
              </Field>
              <Field label="Mobile number" error={errors.consultantMobile}>
                <Input
                  value={consultantMobile}
                  onChange={(e) => setConsultantMobile(mobileInput(e.target.value))}
                  placeholder="98765 43210"
                  inputMode="tel"
                  autoComplete="tel"
                  className="tabular"
                />
              </Field>
            </div>
          </div>
        )}

        {sameDin ? (
          <p className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs">
            DIN {sameDin.din} is <span className="font-semibold">{sameDin.name}</span>, already a director
            {sameDin.directorships.length > 0 ? ` of ${sameDin.directorships.length} compan${sameDin.directorships.length === 1 ? "y" : "ies"}` : ""}.
            {draftMode
              ? " They will be linked to this company with their saved details — one record for every company they sit on."
              : " Edit that director instead and tick this company under Board of."}
          </p>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={draftMode ? "DIN for this company" : "Main DIN"} error={errors.din}>
            <Input
              value={din}
              onChange={(e) => setDin(dinInput(e.target.value))}
              placeholder="8 digits"
              className="font-mono"
              inputMode="numeric"
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Last DIR-3 KYC filed (optional)" error={errors.lastKycFiledOn}>
            <Input
              type="date"
              value={lastKycFiledOn}
              onChange={(e) => setLastKycFiledOn(e.target.value)}
              min={dinAllottedOn || "2006-01-01"}
              max={isoDate(today())}
              className="tabular"
            />
          </Field>
          <Field label="SRN of that KYC (optional)" error={errors.lastKycSrn}>
            <Input
              value={lastKycSrn}
              onChange={(e) => setLastKycSrn(srnInput(e.target.value))}
              placeholder="e.g. AB1234567"
              disabled={!lastKycFiledOn}
              spellCheck={false}
              className="font-mono uppercase"
            />
          </Field>
        </div>

        {draftMode ? (
          <div className="space-y-3 rounded-2xl border bg-muted/20 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              At this company
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Date of appointment" error={undefined}>
                <Input
                  type="date"
                  value={appointedOn}
                  onChange={(e) => setAppointedOn(e.target.value)}
                  min={dinAllottedOn || undefined}
                  max={isoDate(today())}
                  className="tabular"
                />
              </Field>
              <Field label="Date of cessation (if ceased)" error={undefined}>
                <Input
                  type="date"
                  value={cessationOn}
                  onChange={(e) => setCessationOn(e.target.value)}
                  min={appointedOn || undefined}
                  className="tabular"
                />
              </Field>
            </div>
            {cessationOn ? (
              <Field label="Reason for cessation" error={undefined}>
                <select
                  value={cessationReason}
                  onChange={(e) => setCessationReason(e.target.value as CessationReason)}
                  className="h-9 w-full rounded-xl border border-input bg-card px-3 text-sm"
                >
                  {CESSATION_REASONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                      {r.section !== "—" ? ` (${r.section})` : ""}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}
            {errors.seat ? <p className="text-xs text-destructive">{errors.seat}</p> : null}
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {cessationOn && parseIsoDate(cessationOn)
                ? `The company files DIR-12 within 30 days of the cessation: by ${formatDate(addDays(parseIsoDate(cessationOn)!, 30))}. ${CESSATION_NOTE[cessationReason]}`
                : "A new director's appointment is also reported on DIR-12 within 30 days. Leave the cessation date blank while the director is in office."}
            </p>
          </div>
        ) : null}

        {draftMode ? null : (
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              Board of
            </p>
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border p-2">
              {clients.length === 0 ? (
                <p className="p-2 text-xs text-muted-foreground">
                  No clients yet — add a company first.
                </p>
              ) : (
                clients.map((c) => (
                  <label
                    key={c.id}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(c.id)}
                      onChange={() => toggle(c.id)}
                      className="size-3.5 accent-primary"
                    />
                    <span className="flex size-5 shrink-0 items-center justify-center rounded bg-muted font-mono text-[9px] font-bold text-muted-foreground">
                      {initials(c.name)}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{c.name}</span>
                    {selected.has(c.id) ? (
                      <input
                        value={seatDins[c.id] ?? ""}
                        onChange={(e) =>
                          setSeatDins((prev) => ({ ...prev, [c.id]: dinInput(e.target.value) }))
                        }
                        placeholder={din || "DIN"}
                        inputMode="numeric"
                        aria-label={`DIN at ${c.name} (blank = main DIN)`}
                        title="DIN at this company. Leave blank to use the main DIN."
                        className="h-6 w-24 shrink-0 rounded border bg-background px-1.5 font-mono text-[11px]"
                      />
                    ) : (
                      <span className="shrink-0 text-[10px] text-muted-foreground">{typeLabel(c.type)}</span>
                    )}
                  </label>
                ))
              )}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Each ticked company has its own DIN box; leave it blank to use the main DIN.
            </p>
            {errors.directorships ? <p className="mt-1 text-xs text-destructive">{errors.directorships}</p> : null}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onDone}>
            <X className="size-4" aria-hidden /> Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {source ? <Save className="size-4" aria-hidden /> : <UserPlus className="size-4" aria-hidden />}
            {source ? (draftMode ? "Done" : "Save changes") : "Add director"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
