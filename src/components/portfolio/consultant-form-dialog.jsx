"use client";

import * as React from "react";
import { Save, UserPlus, X } from "lucide-react";
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
import { companyNameInput, emailInput, mobileInput, personNameInput } from "@/lib/input-filters";
import { usePortfolio } from "@/components/portfolio/portfolio-provider";
import { consultantDraftFrom, validateConsultant } from "@/lib/portfolio/consultants";
import { formatMobile } from "@/lib/portfolio/mobile";
const EMPTY = { name: "", mobile: "", email: "", firm: "" };

/**
 * Add / edit a consultant in the consultant master. Also opened from the
 * company form, so a consultant can be added without leaving it; `onSaved`
 * hands the new record back so the company can point at it straight away.
 */
export function ConsultantFormDialog({ open, onOpenChange, consultant, onSaved }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {open ? (
          <ConsultantFormFields consultant={consultant ?? null} onSaved={onSaved} onDone={() => onOpenChange(false)} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ConsultantFormFields({ consultant, onSaved, onDone }) {
  const { consultants, clients, addConsultant, updateConsultant, assignConsultant } = usePortfolio();
  const [draft, setDraft] = React.useState(() =>
    consultant ? { ...consultantDraftFrom(consultant), mobile: formatMobile(consultant.mobile) } : EMPTY,
  );
  // The companies under this consultant: each company names one reference.
  const [companyIds, setCompanyIds] = React.useState(
    () => new Set(consultant ? clients.filter((c) => c.consultantId === consultant.id).map((c) => c.id) : []),
  );

  function toggleCompany(id) {
    setCompanyIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  const [errors, setErrors] = React.useState({});
  const [saving, setSaving] = React.useState(false);

  function set(key, value) {
    setDraft((d) => ({ ...d, [key]: value }));
    setErrors((e) => ({ ...e, [key]: "" }));
  }

  async function onSubmit(e) {
    // The company form may sit behind this dialog: its own submit must not fire.
    e.preventDefault();
    e.stopPropagation();
    const found = validateConsultant(draft, consultants, consultant?.id);
    if (found.length > 0) {
      setErrors(Object.fromEntries(found.map((f) => [f.field, f.message])));
      return;
    }
    setSaving(true);
    try {
      if (consultant) {
        await updateConsultant(consultant.id, draft);
        await assignConsultant(consultant.id, [...companyIds]);
        toast.success(`${draft.name.trim()} updated`);
      } else {
        const created = await addConsultant(draft);
        if (companyIds.size > 0) await assignConsultant(created.id, [...companyIds]);
        toast.success(`${created.name} added to consultant files`);
        onSaved?.(created);
      }
      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <DialogHeader>
        <DialogTitle className="font-heading text-lg">
          {consultant ? "Edit consultant" : "Add a consultant"}
        </DialogTitle>
        <DialogDescription>
          Name, mobile, and the companies under this consultant. Each company has one consultant.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Consultant name" error={errors.name} className="sm:col-span-2">
          <Input
            value={draft.name}
            onChange={(e) => set("name", personNameInput(e.target.value))}
            maxLength={100}
            placeholder="CA Priya Sharma"
            autoFocus
            aria-invalid={!!errors.name}
          />
        </Field>
        <Field label="Mobile number" error={errors.mobile}>
          <Input
            type="tel"
            inputMode="tel"
            value={draft.mobile}
            onChange={(e) => set("mobile", mobileInput(e.target.value))}
            autoComplete="tel"
            placeholder="98765 43210"
            className="tabular"
            aria-invalid={!!errors.mobile}
          />
        </Field>
        <Field label="Email (optional)" error={errors.email}>
          <Input
            type="email"
            value={draft.email ?? ""}
            onChange={(e) => set("email", emailInput(e.target.value))}
            maxLength={254}
            autoComplete="email"
            placeholder="name@firm.in"
            aria-invalid={!!errors.email}
          />
        </Field>
        <Field label="Firm (optional)" className="sm:col-span-2">
          <Input
            value={draft.firm ?? ""}
            onChange={(e) => set("firm", companyNameInput(e.target.value))}
            maxLength={200}
            placeholder="Sharma & Associates"
          />
        </Field>
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Companies under this consultant
          </p>
          <span className="text-xs text-muted-foreground">{companyIds.size} selected</span>
        </div>
        <div className="max-h-48 space-y-0.5 overflow-y-auto rounded-md border p-1.5">
          {clients.length === 0 ? (
            <p className="p-2 text-xs text-muted-foreground">No companies yet. Add them in Company Master Data.</p>
          ) : (
            clients.map((c) => {
              const other =
                c.consultantId && c.consultantId !== consultant?.id
                  ? (consultants.find((x) => x.id === c.consultantId) ?? null)
                  : null;
              return (
                <label
                  key={c.id}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted"
                >
                  <input
                    type="checkbox"
                    checked={companyIds.has(c.id)}
                    onChange={() => toggleCompany(c.id)}
                    className="size-3.5 shrink-0 accent-primary"
                  />
                  <span className="min-w-0 flex-1 truncate">{c.name}</span>
                  {other ? (
                    <span className="shrink-0 text-[10px] text-muted-foreground" title="Ticking moves it here">
                      {companyIds.has(c.id) ? `moves from ${other.name}` : `under ${other.name}`}
                    </span>
                  ) : null}
                </label>
              );
            })
          )}
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          <X className="size-4" aria-hidden /> Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {consultant ? <Save className="size-4" aria-hidden /> : <UserPlus className="size-4" aria-hidden />}
          {consultant ? "Save changes" : "Add consultant"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function Field({ label, error, children, className }) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <label className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{label}</label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
