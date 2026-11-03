"use client";

import * as React from "react";
import { toast } from "sonner";
import { Building2, ChevronLeft, ChevronRight, ClipboardList, Contact, ListChecks, Pencil, Save, Trash2, UserPlus, Users, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tip } from "@/components/shared/tip";
import {
  amountInput,
  cinInput,
  companyNameInput,
  emailInput,
  mobileInput,
  personNameInput,
  srnInput,
  textInput,
} from "@/lib/input-filters";
import {
  COMPANY_TYPES,
  addDays,
  addMonths,
  firstFinancialYearEnd,
  formatDate,
  isoDate,
  parseIsoDate,
  today,
} from "@/lib/dates";
import { AUDITOR_TERM_YEARS } from "@/lib/resolve-due-dates";
import { usePortfolio } from "@/components/portfolio/portfolio-provider";
import { DirectorFormDialog } from "@/components/portfolio/director-form-dialog";
import { formatMobile } from "@/lib/portfolio/mobile";
import {
  agmFyOf,
  draftFrom,
  initials,
  newId,
  type ClientDraft,
} from "@/lib/portfolio/clients";
import {
  boardChanges,
  boardFor,
  directorDraftFrom,
  followIncorporation,
  inOffice,
  MIN_DIRECTORS,
  placeOnBoard,
  type BoardEntry,
  type Seat,
} from "@/lib/portfolio/board";
import type { DirectorDraft } from "@/lib/portfolio/directors";
import { resolveReference, type ReferenceInput } from "@/lib/portfolio/consultants";
import {
  COMPANY_STEPS,
  effectiveReference,
  firstIncomplete,
  stepErrors,
  type PointOfContactChoice,
  type CompanyStep,
} from "@/lib/portfolio/company-steps";
import { CESSATION_REASONS, type AuditorType, type Client } from "@/lib/portfolio/types";
import { auditorTermSummary } from "@/lib/portfolio/auditor";

/** "10 Oct 2026" from an ISO date; the raw text if it is not one. */
function formatIso(iso: string): string {
  const d = parseIsoDate(iso);
  return d ? formatDate(d) : iso;
}
import { cn } from "@/lib/utils";

const EMPTY: ClientDraft = {
  name: "",
  cin: "",
  type: "private",
  incorporatedOn: "",
  registeredOffice: "",
  status: "active",
  mobile: "",
  consultantId: null,
  lastAgmOn: null,
  notes: "",
  listed: false,
  workingFyEndingYear: null,
  paidUpCapital: 0,
  turnover: 0,
  netWorth: 0,
  netProfit: 0,
  borrowings: 0,
  deposits: 0,
  llpContribution: 0,
  directorsCount: 0,
  msmeDuesOver45Days: false,
  securitiesInDemat: false,
  auditorAppointedAtAgmFy: null,
  auditorTermYears: null,
  filesDpt3: false,
  filesAdt1: true,
  filesInc20a: true,
  transferPricing: false,
};

/**
 * Add / edit a client company.
 *
 * Three tabs: Master data (what goes on the letterhead, plus authorised and
 * paid-up capital), Directors, and Applicability of special forms (ADT-1
 * with the first or subsequent auditor, INC-20A, DPT-3). Fields no longer
 * asked here (AGM date, financials)
 * keep whatever an older save holds, and the calendar falls back on the
 * statutory dates for them. The consultant is set from Consultant Files.
 *
 * The form fields live in a child that only mounts while the dialog is open,
 * so its state starts fresh on every open with no reset-on-open effect.
 */
export function ClientFormDialog({
  open,
  onOpenChange,
  client,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present to edit; absent to create a new client. */
  client?: Client | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[90vh] gap-0 p-0 sm:max-w-3xl"
      >
        {open ? (
          <ClientFormFields client={client ?? null} onDone={() => onOpenChange(false)} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/** The three tabs of the company form. */
type FormTab = CompanyStep;

function ClientFormFields({
  client,
  onDone,
}: {
  client: Client | null;
  onDone: () => void;
}) {
  const {
    clients,
    directors,
    consultants,
    addClient,
    updateClient,
    removeClient,
    addDirector,
    updateDirector,
    addConsultant,
    setAuthorisedDirector,
  } = usePortfolio();
  const [draft, setDraft] = React.useState<ClientDraft>(() => {
    const d = client ? draftFrom(client) : EMPTY;
    return {
      ...d,
      mobile: d.mobile ? formatMobile(d.mobile) : "",
      auditorType: d.auditorType ?? defaultAuditorType(d),
      filesAdt1: true,
    };
  });
  // Directors on this company's board, kept here and saved with the company.
  const [board, setBoard] = React.useState<BoardEntry[]>(() => boardFor(client?.id ?? null, directors));
  const [removedIds, setRemovedIds] = React.useState<string[]>([]);
  const [editingEntry, setEditingEntry] = React.useState<BoardEntry | "new" | null>(null);
  const [tab, setTab] = React.useState<FormTab>("master");
  // The authorised person: always one of the directors (by entry key).
  const [authorisedKey, setAuthorisedKey] = React.useState<string | null>(() => draft.authorisedDirectorId ?? null);
  // The point of contact: the authorised person themself, or a consultant (a third person).
  const [pointOfContact, setPointOfContact] = React.useState<PointOfContactChoice>(
    () => draft.pointOfContact ?? "authorised",
  );
  const authorisedEntry = board.find((e) => e.key === authorisedKey) ?? null;
  const stepIndex = COMPANY_STEPS.indexOf(tab);
  const lastStep = stepIndex === COMPANY_STEPS.length - 1;
  // The company's consultant: one from the master, a new one typed in, or none.
  const [refInput, setRefInput] = React.useState<ReferenceInput>(() =>
    client?.consultantId && consultants.some((c) => c.id === client.consultantId)
      ? { mode: "existing", consultantId: client.consultantId }
      : { mode: "none" },
  );
  const chosenConsultant =
    refInput.mode === "existing" ? (consultants.find((c) => c.id === refInput.consultantId) ?? null) : null;
  const otherDirectors = directors.filter((d) => !board.some((e) => e.directorId === d.id));
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);

  function set<K extends keyof ClientDraft>(key: K, value: ClientDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  /** Rupee amounts: digits only, capped at a sensible length. */
  function num(value: string): number {
    return amountInput(value);
  }

  /** The director dialog hands its details here; returns errors, or null when taken. */
  function acceptDirector(d: DirectorDraft, seat: Seat): Record<string, string> | null {
    const target = editingEntry;
    if (target === null) return null;
    // A DIN already saved is the same person: they are linked, not entered twice.
    const placed = placeOnBoard(board, target, d, directors, newId, seat);
    if (placed.errors.length > 0) return Object.fromEntries(placed.errors.map((f) => [f.field, f.message]));
    setBoard(placed.entries);
    setErrors((e) => ({ ...e, board: "" }));
    if (placed.linked) {
      toast.info(`${placed.linked.name} (DIN ${placed.linked.din}) is already a director`, {
        description: "Linked to this company too, with their saved details and other companies.",
      });
    }
    return null;
  }

  function addExistingDirector(id: string) {
    const d = directors.find((x) => x.id === id);
    if (!d) return;
    // Joins this board from the company's incorporation date, unless changed.
    const appointedOn = draft.incorporatedOn || isoDate(today());
    setBoard((prev) => [
      ...prev,
      { key: d.id, directorId: d.id, draft: directorDraftFrom(d), dirty: true, seat: { appointedOn, cessationOn: null } },
    ]);
    setRemovedIds((prev) => prev.filter((x) => x !== id));
  }

  function removeFromBoard(entry: BoardEntry) {
    setBoard((prev) => prev.filter((e) => e.key !== entry.key));
    if (authorisedKey === entry.key) setAuthorisedKey(null);
    if (entry.directorId) setRemovedIds((prev) => [...prev, entry.directorId!]);
  }

  function stepInput() {
    return { draft, clients, clientId: client?.id, board, authorisedKey, pointOfContact, reference: refInput, consultants };
  }

  /** Checks one step; shows its errors and returns false when something is missing. */
  function check(step: FormTab): boolean {
    const found = stepErrors(step, stepInput());
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setTab(step);
      return false;
    }
    return true;
  }

  /** Moving forward checks every step on the way; moving back never does. */
  function goTo(next: FormTab) {
    const to = COMPANY_STEPS.indexOf(next);
    for (let i = stepIndex; i < to; i++) if (!check(COMPANY_STEPS[i])) return;
    setErrors({});
    setTab(next);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Enter or Next on a step moves on; Finish on the last step saves.
    if (!lastStep) {
      goTo(COMPANY_STEPS[stepIndex + 1]);
      return;
    }
    const incomplete = firstIncomplete(stepInput());
    if (incomplete) {
      setErrors(incomplete.errors);
      setTab(incomplete.step);
      return;
    }
    const reference = resolveReference(effectiveReference(refInput), consultants);
    setSaving(true);
    try {
      // A new consultant goes into the Consultant Master first, so the company can name it.
      const consultantId = reference.create ? (await addConsultant(reference.create)).id : reference.consultantId;
      const final: ClientDraft = {
        ...draft,
        consultantId,
        // A saved director's id now; a new one's once it is saved, below.
        authorisedDirectorId: authorisedEntry?.directorId ?? null,
        pointOfContact,
      };
      let clientId: string;
      if (client) {
        await updateClient(client.id, final);
        clientId = client.id;
      } else {
        clientId = (await addClient(final)).id;
      }
      // New directors get their ids only once saved: note the authorised one's.
      let authorisedNewId: string | null = null;
      for (const change of boardChanges(clientId, board, removedIds, directors)) {
        if (change.kind === "add") {
          const created = await addDirector(change.draft);
          if (authorisedKey === change.key) authorisedNewId = created.id;
        } else {
          await updateDirector(change.id, change.draft);
        }
      }
      if (authorisedNewId) {
        await setAuthorisedDirector(clientId, authorisedNewId);
      }
      toast.success(client ? `${draft.name} updated` : `${draft.name} added to company master data`);
      onDone();
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!client) return;
    if (!window.confirm(`Remove ${client.name} from company master data? This cannot be undone.`)) return;
    await removeClient(client.id);
    toast.success(`${client.name} removed`);
    onDone();
  }

  return (
    <form onSubmit={onSubmit} className="flex max-h-[90vh] flex-col">
      {/* Header */}
      <div className="flex items-start gap-3 border-b p-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <ClipboardList className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-heading text-lg font-semibold">
            {client ? "Edit company profile" : "Add a company"}
          </h2>
          <p className="text-xs text-muted-foreground">
            Personalises due dates, calculators, checklists and the applicability analyzer.
          </p>
        </div>
        <Button type="button" variant="ghost" size="icon" className="size-7 shrink-0" onClick={onDone}>
          <X className="size-4" aria-hidden />
          <span className="sr-only">Close</span>
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => goTo(v as FormTab)} className="min-h-0 flex-1 gap-0">
        <div className="overflow-x-auto border-b px-4 pt-3 pb-3">
          {/* One row: each tab as wide as its label, all on one line, inside a taller bar. */}
          <TabsList className="flex w-full min-w-max gap-1 p-1 group-data-horizontal/tabs:h-10">
            <TabsTrigger value="master" className="h-full flex-auto px-3 text-[13px] whitespace-nowrap">
              <Building2 className="size-3.5" aria-hidden /> Master data
            </TabsTrigger>
            <TabsTrigger value="directors" className="h-full flex-auto px-3 text-[13px] whitespace-nowrap">
              <Users className="size-3.5" aria-hidden /> Directors{board.length > 0 ? ` (${board.length})` : ""}
            </TabsTrigger>
            <TabsTrigger value="consultant" className="h-full flex-auto px-3 text-[13px] whitespace-nowrap">
              <Contact className="size-3.5" aria-hidden /> Consultant
            </TabsTrigger>
            <TabsTrigger value="forms" className="h-full flex-auto px-3 text-[13px] whitespace-nowrap">
              <ListChecks className="size-3.5" aria-hidden /> Applicability of special forms
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {/* 1. Master data: what goes on the letterhead, and the capital. */}
          <TabsContent value="master" className="mt-0">
            {/* Six columns, so every row is full: 6 | 2·2·2 | 6 | 3·3 | 3·3. */}
            <div className="grid gap-4 sm:grid-cols-6">
              <Field label="Company / LLP name" error={errors.name} className="sm:col-span-6">
                <Input
                  value={draft.name}
                  onChange={(e) => set("name", companyNameInput(e.target.value))}
                  maxLength={200}
                  placeholder="Example Private Limited"
                  autoFocus
                />
              </Field>

              <Field label={draft.type === "llp" ? "LLPIN" : "CIN"} error={errors.cin} className="sm:col-span-2">
                <Input
                  value={draft.cin}
                  onChange={(e) => set("cin", cinInput(e.target.value, draft.type === "llp"))}
                  spellCheck={false}
                  autoComplete="off"
                  placeholder={draft.type === "llp" ? "AAB-1234" : "U62099KA2019PTC128740"}
                  className="font-mono uppercase"
                />
              </Field>

              <Field label="Entity type" className="sm:col-span-2">
                <Select
                  value={draft.type}
                  onValueChange={(v) => {
                    const type = v as ClientDraft["type"];
                    setDraft((d) => ({ ...d, type, cin: cinInput(d.cin, type === "llp") }));
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COMPANY_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Date of incorporation" error={errors.incorporatedOn} className="sm:col-span-2">
                <Input
                  type="date"
                  value={draft.incorporatedOn}
                  onChange={(e) => {
                    const next = e.target.value;
                    // Directors appointed on the old incorporation date move with it.
                    setBoard((prev) => followIncorporation(prev, draft.incorporatedOn, next));
                    set("incorporatedOn", next);
                  }}
                  min="1850-01-01"
                  max={isoDate(today())}
                  className="tabular"
                />
              </Field>

              <Field label="Registered office address" error={errors.registeredOffice} className="sm:col-span-6">
                <Input
                  value={draft.registeredOffice}
                  onChange={(e) => set("registeredOffice", textInput(e.target.value, 300))}
                  maxLength={300}
                  placeholder="Address"
                />
              </Field>

              <Field label="Mobile number" error={errors.mobile} className="sm:col-span-3">
                <Input
                  type="tel"
                  inputMode="tel"
                  value={draft.mobile ?? ""}
                  onChange={(e) => set("mobile", mobileInput(e.target.value))}
                  autoComplete="tel"
                  placeholder="98765 43210"
                  className="tabular"
                  aria-invalid={!!errors.mobile}
                />
              </Field>

              <Field label="Email" error={errors.email} className="sm:col-span-3">
                <Input
                  type="email"
                  value={draft.email ?? ""}
                  onChange={(e) => set("email", emailInput(e.target.value))}
                  maxLength={254}
                  autoComplete="email"
                  placeholder="office@company.in"
                  aria-invalid={!!errors.email}
                />
              </Field>


              {draft.type === "llp" ? (
                <Field label="LLP contribution (₹)" error={errors.llpContribution} className="sm:col-span-6">
                  <Input
                    inputMode="numeric"
                    value={draft.llpContribution || ""}
                    onChange={(e) => set("llpContribution", num(e.target.value))}
                    placeholder="0"
                    className="tabular"
                  />
                </Field>
              ) : (
                <>
                  <Field label="Authorised capital (₹)" error={errors.authorisedCapital} className="sm:col-span-3">
                    <Input
                      inputMode="numeric"
                      value={draft.authorisedCapital || ""}
                      onChange={(e) => set("authorisedCapital", num(e.target.value))}
                      placeholder="0"
                      className="tabular"
                    />
                  </Field>
                  <Field label="Paid-up capital (₹)" error={errors.paidUpCapital} className="sm:col-span-3">
                    <Input
                      inputMode="numeric"
                      value={draft.paidUpCapital || ""}
                      onChange={(e) => set("paidUpCapital", num(e.target.value))}
                      placeholder="0"
                      className="tabular"
                    />
                  </Field>
                </>
              )}
            </div>
          </TabsContent>

          {/* 2. Directors of this company. */}
          <TabsContent value="directors" className="mt-0">
            <p className="mb-3 text-[11px] text-muted-foreground">
              At least {MIN_DIRECTORS[draft.type]} {draft.type === "llp" ? "designated partner" : "director"}
              {MIN_DIRECTORS[draft.type] === 1 ? "" : "s"} in office is required
              {draft.type === "llp" ? " (Section 7 of the LLP Act)" : " (Section 149(1))"}.
            </p>
            {errors.board ? (
              <p className="mb-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                {errors.board}
              </p>
            ) : null}
            {board.length === 0 ? (
              <p className="rounded-md border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
                No directors yet. Add each director with their DIN and DIR-3 KYC details.
              </p>
            ) : (
              <ul className="divide-y rounded-md border">
                {board.map((entry) => (
                  <li key={entry.key} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-[10px] font-bold text-muted-foreground">
                      {initials(entry.draft.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{entry.draft.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        DIN <span className="font-mono">{entry.draft.din}</span>
                        {entry.key === authorisedKey
                          ? pointOfContact === "authorised"
                            ? " · Authorised person & point of contact"
                            : " · Authorised person"
                          : ""}
                        {entry.directorId === null ? " · new" : ""}
                      </span>
                      {entry.seat ? (
                        <span className="block text-[11px] text-muted-foreground">
                          Appointed {formatIso(entry.seat.appointedOn)}
                          {entry.seat.cessationOn ? (
                            <span className="ml-1.5 rounded-full bg-destructive/10 px-1.5 py-px font-medium text-destructive">
                              Ceased {formatIso(entry.seat.cessationOn)}
                              {entry.seat.cessationReason
                                ? ` · ${CESSATION_REASONS.find((r) => r.value === entry.seat!.cessationReason)?.label.split(" (")[0]}`
                                : ""}
                            </span>
                          ) : null}
                        </span>
                      ) : null}
                    </span>
                    <Tip label="Edit director">
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => setEditingEntry(entry)}
                        aria-label={`Edit ${entry.draft.name}`}
                      >
                        <Pencil className="size-3.5" aria-hidden />
                      </Button>
                    </Tip>
                    <Tip label="Remove from this company">
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => removeFromBoard(entry)}
                        aria-label={`Remove ${entry.draft.name} from this company`}
                      >
                        <X className="size-3.5" aria-hidden />
                      </Button>
                    </Tip>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => setEditingEntry("new")}>
                <UserPlus className="size-3.5" aria-hidden /> Add director
              </Button>
              {otherDirectors.length > 0 ? (
                <Select value="" onValueChange={addExistingDirector}>
                  <SelectTrigger size="sm" className="h-8 w-60" aria-label="Add a director already on another company">
                    <SelectValue placeholder="Or pick one on another company…" />
                  </SelectTrigger>
                  <SelectContent>
                    {otherDirectors.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name} · DIN {d.din}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}
            </div>

            {/* The authorised person: always a director. */}
            <fieldset className="mt-5 rounded-md border p-3">
              <legend className="px-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                Authorised person (required)
              </legend>
              {inOffice(board).length === 0 ? (
                <p className="px-2 py-1.5 text-xs text-muted-foreground">Add the directors first, then choose one.</p>
              ) : (
                <div role="radiogroup" aria-label="Authorised person" className="space-y-1">
                  {inOffice(board).map((entry) => (
                    <label key={entry.key} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted">
                      <input
                        type="radio"
                        name="authorised-person"
                        checked={authorisedKey === entry.key}
                        onChange={() => {
                          setAuthorisedKey(entry.key);
                          setErrors((e) => ({ ...e, authorised: "" }));
                        }}
                        className="size-3.5 accent-primary"
                      />
                      <span className="font-medium">{entry.draft.name}</span>
                      <span className="tabular text-xs text-muted-foreground">DIN {entry.draft.din}</span>
                    </label>
                  ))}
                </div>
              )}
              {errors.authorised ? <p className="mt-2 text-xs text-destructive">{errors.authorised}</p> : null}
            </fieldset>

            {/* The point of contact: the authorised person, unless a consultant is involved. */}
            <fieldset className="mt-3 rounded-md border p-3">
              <legend className="px-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                Point of contact
              </legend>
              <div role="radiogroup" aria-label="Point of contact" className="space-y-1">
                <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted">
                  <input
                    type="radio"
                    name="point-of-contact"
                    checked={pointOfContact === "authorised"}
                    onChange={() => setPointOfContact("authorised")}
                    className="size-3.5 accent-primary"
                  />
                  <span className="font-medium">Same as the authorised person</span>
                  <span className="text-xs text-muted-foreground">
                    {authorisedEntry ? `(${authorisedEntry.draft.name})` : "(no third person involved)"}
                  </span>
                </label>
                <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted">
                  <input
                    type="radio"
                    name="point-of-contact"
                    checked={pointOfContact === "consultant"}
                    onChange={() => {
                      setPointOfContact("consultant");
                      // A consultant is now required: start the Consultant step ready for one.
                      if (refInput.mode === "none") setRefInput({ mode: "new", name: "", mobile: "" });
                    }}
                    className="size-3.5 accent-primary"
                  />
                  <span className="font-medium">A consultant</span>
                  <span className="text-xs text-muted-foreground">(enter them on the Consultant step)</span>
                </label>
              </div>
            </fieldset>
          </TabsContent>

          {/* 3. Which of these forms the company files. */}
          <TabsContent value="forms" className="mt-0">
            {draft.type === "llp" ? (
              <p className="rounded-md border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
                ADT-1, INC-20A and DPT-3 are company forms; an LLP does not file them.
              </p>
            ) : (
              <>
                <div className="grid gap-2 sm:grid-cols-3">
                  <CheckboxField
                    label="ADT-1 applies"
                    checked
                    disabled
                    title="Every company appoints an auditor (Section 139), so ADT-1 always applies."
                    onChange={() => undefined}
                  />
                  <CheckboxField
                    label="INC-20A applies"
                    checked={draft.filesInc20a !== false}
                    onChange={(v) => set("filesInc20a", v)}
                  />
                  <CheckboxField
                    label="DPT-3 applies"
                    checked={!!draft.filesDpt3}
                    onChange={(v) => set("filesDpt3", v)}
                  />
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  ADT-1 applies to every company. Untick INC-20A or DPT-3 and its due date disappears
                  from the calendar, dashboard and reports for this company.
                </p>

                {/* The auditor in office, under Section 139 */}
                <div className="mt-4 rounded-md border p-3">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                    Statutory auditor (ADT-1)
                  </p>
                  <div
                    role="radiogroup"
                    aria-label="Auditor in office"
                    className="inline-flex rounded-full border bg-muted/40 p-0.5"
                  >
                    {(
                      [
                        ["first", "First auditor"],
                        ["subsequent", "Subsequent auditor"],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={draft.auditorType === value}
                        onClick={() => set("auditorType", value)}
                        className={cn(
                          "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                          draft.auditorType === value
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {draft.auditorType === "first" ? (
                    <div className="mt-3 space-y-3">
                      <p className="text-[11px] leading-relaxed text-muted-foreground">
                        <span className="font-semibold text-foreground">Section 139(6).</span> The Board
                        appoints the first auditor within 30 days of incorporation; failing that, the
                        members appoint one within 90 days at an extraordinary general meeting. The
                        first auditor holds office until the conclusion of the first AGM. ADT-1 is
                        filed within 15 days of the appointment.
                      </p>
                      <Field
                        label="Board meeting appointing the first auditor"
                        error={errors.firstAuditorAppointedOn}
                        hint={firstAuditorHint(draft)}
                      >
                        <Input
                          type="date"
                          value={draft.firstAuditorAppointedOn ?? ""}
                          onChange={(e) => set("firstAuditorAppointedOn", e.target.value || null)}
                          min={draft.incorporatedOn || undefined}
                          max={isoDate(today())}
                          className="tabular"
                        />
                      </Field>
                    </div>
                  ) : (
                    <div className="mt-3 space-y-3">
                      <p className="text-[11px] leading-relaxed text-muted-foreground">
                        <span className="font-semibold text-foreground">Section 139(1).</span> The
                        members appoint the auditor at the AGM, from the conclusion of that meeting to
                        the conclusion of the sixth AGM — a term of up to five years. In listed and
                        prescribed companies an individual may serve one such term and an audit firm
                        two consecutive terms (Section 139(2)). ADT-1 is filed within 15 days of the
                        AGM.
                      </p>
                      {/* One ADT-1 per appointment: its SRN, its date, and the years appointed for. */}
                      <div className="grid gap-3 sm:grid-cols-3">
                        <Field label="ADT-1 SRN" error={errors.adt1Srn}>
                          <Input
                            value={draft.adt1Srn ?? ""}
                            onChange={(e) => set("adt1Srn", srnInput(e.target.value))}
                            placeholder="e.g. AB1234567"
                            spellCheck={false}
                            autoComplete="off"
                            className="uppercase"
                          />
                        </Field>
                        <Field label="ADT-1 filed on" error={errors.adt1FiledOn}>
                          <Input
                            type="date"
                            value={draft.adt1FiledOn ?? ""}
                            onChange={(e) => set("adt1FiledOn", e.target.value || null)}
                            min={draft.incorporatedOn || undefined}
                            max={isoDate(today())}
                            className="tabular"
                          />
                        </Field>
                        <Field label="Appointed for">
                          <Select
                            value={String(draft.auditorTermYears ?? AUDITOR_TERM_YEARS)}
                            onValueChange={(v) =>
                              set("auditorTermYears", Number(v) === AUDITOR_TERM_YEARS ? null : Number(v))
                            }
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {[5, 4, 3, 2, 1].map((n) => (
                                <SelectItem key={n} value={String(n)}>
                                  {n} year{n === 1 ? "" : "s"}
                                  {n === AUDITOR_TERM_YEARS ? " (maximum)" : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </Field>
                      </div>
                      <p className="rounded-md bg-muted/40 px-3 py-2 text-[11px] leading-relaxed">
                        {adtPreview(draft) ??
                          "Enter the ADT-1 filing date to see the AGM up to which the auditor is appointed and when the next ADT-1 falls due."}
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
          </TabsContent>

          {/* 4. The company's consultant (reference). */}
          <TabsContent value="consultant" className="mt-0 space-y-3">
            {pointOfContact === "consultant" ? (
              <p className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs">
                <span className="font-semibold">Required.</span> The point of contact is a consultant, so enter
                their details here.
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                Optional: the authorised person is the point of contact. Add the company&apos;s consultant if it
                has one.
              </p>
            )}
            <Field label="Consultant">
              <Select
                value={refInput.mode === "existing" ? refInput.consultantId : refInput.mode}
                onValueChange={(v) => {
                  setRefInput(
                    v === "none"
                      ? { mode: "none" }
                      : v === "new"
                        ? { mode: "new", name: "", mobile: "" }
                        : { mode: "existing", consultantId: v },
                  );
                  setErrors((e) => ({ ...e, ref_name: "", ref_mobile: "" }));
                }}
              >
                <SelectTrigger className="w-full" aria-label="Consultant">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {pointOfContact === "consultant" ? null : <SelectItem value="none">No consultant</SelectItem>}
                  {consultants.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} · {formatMobile(c.mobile)}
                    </SelectItem>
                  ))}
                  <SelectItem value="new">New consultant (enter name and mobile)</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            {refInput.mode === "new" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Consultant name" error={errors.ref_name}>
                  <Input
                    value={refInput.name}
                    onChange={(e) => setRefInput({ ...refInput, name: personNameInput(e.target.value) })}
                    maxLength={100}
                    placeholder="CA Priya Sharma"
                  />
                </Field>
                <Field label="Consultant mobile number" error={errors.ref_mobile}>
                  <Input
                    type="tel"
                    inputMode="tel"
                    value={refInput.mobile}
                    onChange={(e) => setRefInput({ ...refInput, mobile: mobileInput(e.target.value) })}
                    placeholder="98765 43210"
                    className="tabular"
                  />
                </Field>
              </div>
            ) : chosenConsultant ? (
              <div className="rounded-md border px-3 py-2.5 text-sm">
                <span className="block font-medium">{chosenConsultant.name}</span>
                <span className="tabular block text-xs text-muted-foreground">
                  {formatMobile(chosenConsultant.mobile)}
                  {chosenConsultant.firm ? ` · ${chosenConsultant.firm}` : ""}
                  {chosenConsultant.email ? ` · ${chosenConsultant.email}` : ""}
                </span>
              </div>
            ) : null}

            <p className="text-[11px] text-muted-foreground">
              The company is listed under this consultant in the Consultant Master. A new consultant is
              added there when you save; if that mobile is already there, that consultant is used.
            </p>
          </TabsContent>
        </div>
      </Tabs>

      <DirectorFormDialog
        open={editingEntry !== null}
        onOpenChange={(open) => {
          if (!open) setEditingEntry(null);
        }}
        initialDraft={editingEntry && editingEntry !== "new" ? editingEntry.draft : null}
        initialSeat={editingEntry && editingEntry !== "new" ? (editingEntry.seat ?? null) : null}
        defaultAppointedOn={draft.incorporatedOn}
        onDraft={acceptDirector}
      />

      {/* The dialog has no padding of its own, so the footer's usual negative margins are cancelled. */}
      <DialogFooter className="m-0 rounded-b-3xl border-t px-4 py-3">
        {client ? (
          <Button type="button" variant="outline" onClick={onDelete} className="mr-auto text-destructive hover:text-destructive">
            <Trash2 className="size-3.5" aria-hidden /> Delete
          </Button>
        ) : null}
        {stepIndex > 0 ? (
          <Button type="button" variant="outline" onClick={() => setTab(COMPANY_STEPS[stepIndex - 1])}>
            <ChevronLeft className="size-3.5" aria-hidden /> Back
          </Button>
        ) : null}
        <span className="hidden self-center text-xs text-muted-foreground sm:inline">
          Step {stepIndex + 1} of {COMPANY_STEPS.length}
        </span>
        <Button type="submit" disabled={saving}>
          {lastStep ? (
            <>
              <Save className="size-3.5" aria-hidden /> Finish
            </>
          ) : (
            <>
              Next <ChevronRight className="size-3.5" aria-hidden />
            </>
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}

function Field({
  label,
  error,
  hint,
  children,
  className,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </label>
      {children}
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

function CheckboxField({
  label,
  checked,
  onChange,
  disabled = false,
  title,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  title?: string;
}) {
  const id = React.useId();
  return (
    <label
      htmlFor={id}
      title={title}
      className={cn(
        "flex items-center gap-2 rounded-md border px-3 py-2 text-sm",
        disabled ? "cursor-default bg-muted/30" : "cursor-pointer hover:bg-muted/50",
      )}
    >
      <Checkbox id={id} checked={checked} disabled={disabled} onCheckedChange={(v) => onChange(v === true)} />
      {label}
    </label>
  );
}

/* ------------------------------------------------------------------ */
/* Auditor (Section 139)                                               */
/* ------------------------------------------------------------------ */

/**
 * Until the first AGM is due (nine months after the first financial year),
 * the auditor in office is the first auditor; after it, a subsequent one.
 */
function defaultAuditorType(d: ClientDraft): AuditorType {
  const inc = parseIsoDate(d.incorporatedOn);
  if (!inc || d.lastAgmOn) return "subsequent";
  const firstAgmBy = addMonths(firstFinancialYearEnd(inc), 9);
  return today().getTime() <= firstAgmBy.getTime() ? "first" : "subsequent";
}

/** When ADT-1 for the first auditor is due, or by when the Board must appoint. */
function firstAuditorHint(d: ClientDraft): string {
  const appointed = d.firstAuditorAppointedOn ? parseIsoDate(d.firstAuditorAppointedOn) : null;
  if (appointed) return `ADT-1 due by ${formatDate(addDays(appointed, 15))} (15 days after the Board meeting).`;
  const inc = parseIsoDate(d.incorporatedOn);
  return inc
    ? `Not yet appointed: the Board must appoint by ${formatDate(addDays(inc, 30))}, 30 days from incorporation.`
    : "Enter the date of incorporation on the Master data tab first.";
}

/**
 * What the ADT-1 entered means: the AGM up to which the auditor holds office,
 * the next ADT-1 due date, and how many years in between are NA.
 */
function adtPreview(d: ClientDraft): string | null {
  const filed = d.adt1FiledOn ? parseIsoDate(d.adt1FiledOn) : null;
  if (!filed || !parseIsoDate(d.incorporatedOn)) return null;
  const now = new Date().toISOString();
  const preview: Client = {
    id: "preview",
    name: d.name,
    cin: d.cin,
    type: d.type,
    incorporatedOn: d.incorporatedOn,
    registeredOffice: d.registeredOffice,
    status: d.status,
    auditorType: "subsequent",
    auditorAppointedAtAgmFy: agmFyOf(filed),
    auditorTermYears: d.auditorTermYears ?? null,
    createdAt: now,
    updatedAt: now,
  };
  return auditorTermSummary(preview);
}

