"use client";

import * as React from "react";
import { AlertTriangle, ArrowDownToLine, Check, Printer, Target, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tip } from "@/components/shared/tip";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import { StatCard, StatCardGrid } from "@/components/shared/stat-card";
import { InfoBanner } from "@/components/shared/info-banner";
import { PdfUploadDropzone } from "@/components/shared/pdf-upload-dropzone";
import { COMPANY_TYPES } from "@/lib/dates";
import { usePortfolio } from "@/components/portfolio/portfolio-provider";
import { applicabilityProfileFor } from "@/lib/portfolio/clients";
import { applyExtractionToApplicabilityProfile } from "@/lib/pdf-extraction";
import {
  APPLICABILITY_CATEGORIES,
  emptyProfile,
  evaluateApplicability,
  summarise,
  type ApplicabilityResult,
  type ApplicabilityStatus,
  type CompanyProfile,
} from "@/lib/applicability";

const MONEY_FIELDS: { key: keyof CompanyProfile; label: string }[] = [
  { key: "paidUpCapital", label: "Paid-up share capital (₹)" },
  { key: "turnover", label: "Turnover (₹)" },
  { key: "netWorth", label: "Net worth (₹)" },
  { key: "netProfit", label: "Net profit, preceding FY (₹)" },
  { key: "borrowings", label: "Outstanding borrowings (₹)" },
  { key: "deposits", label: "Outstanding deposits (₹)" },
];

export function ApplicabilityView() {
  const { ready, activeClient } = usePortfolio();
  const [profile, setProfile] = React.useState<CompanyProfile>(emptyProfile);
  const [loadedFrom, setLoadedFrom] = React.useState<string | null>(null);

  const results = React.useMemo(() => evaluateApplicability(profile), [profile]);
  const summary = React.useMemo(() => summarise(results), [results]);

  function setField<K extends keyof CompanyProfile>(key: K, value: CompanyProfile[K]) {
    setProfile((p) => ({ ...p, [key]: value }));
    setLoadedFrom(null);
  }

  function loadFromActiveClient() {
    if (!activeClient) return;
    setProfile(applicabilityProfileFor(activeClient));
    setLoadedFrom(activeClient.name);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Target}
        eyebrow="Applicability Analyzer"
        badge="NEW"
        title="What Compliances Apply To My Company?"
        lede="Enter your numbers once and instantly see every threshold-based requirement — CSR, internal/secretarial/cost audit, woman and independent directors, KMP, XBRL, MGT-8 and more — with the exact reason for each."
      />

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        {/* Left column: the form */}
        <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-lg border bg-card p-4">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 className="font-heading text-lg font-semibold">Your company profile</h2>
              {ready && activeClient ? (
                <Tip label={`Load from ${activeClient.name}`}>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="outline"
                    className="size-8"
                    onClick={loadFromActiveClient}
                    aria-label={`Load from ${activeClient.name}`}
                  >
                    <ArrowDownToLine className="size-4" aria-hidden />
                  </Button>
                </Tip>
              ) : null}
            </div>
            {loadedFrom ? (
              <p className="-mt-2 mb-4 text-xs text-muted-foreground">
                Loaded from {loadedFrom}&apos;s saved profile. Edit any field below without
                changing the saved record — this only updates what you see here.
              </p>
            ) : null}

            <PdfUploadDropzone
              className="mb-4"
              onExtracted={(data) => {
                setProfile((p) => applyExtractionToApplicabilityProfile(p, data));
                setLoadedFrom(null);
              }}
            />

            <div className="space-y-4">
              <Field label="Entity type">
                <Select
                  value={profile.entityType}
                  onValueChange={(v) => setField("entityType", v as CompanyProfile["entityType"])}
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

              <CheckboxField
                label="Listed company"
                checked={profile.listed}
                onChange={(v) => setField("listed", v)}
              />

              {MONEY_FIELDS.map((f) => (
                <Field key={f.key} label={f.label}>
                  <Input
                    inputMode="numeric"
                    value={profile[f.key] === 0 ? "" : String(profile[f.key])}
                    onChange={(e) => {
                      const n = Number(e.target.value.replace(/[^\d]/g, ""));
                      setField(f.key, (Number.isFinite(n) ? n : 0) as CompanyProfile[typeof f.key]);
                    }}
                    placeholder="0"
                    className="tabular"
                  />
                </Field>
              ))}

              <CheckboxField
                label="Has MSME dues outstanding beyond 45 days"
                checked={profile.msmeDuesOver45Days}
                onChange={(v) => setField("msmeDuesOver45Days", v)}
              />
              <CheckboxField
                label="Securities held in demat form"
                checked={profile.securitiesInDemat}
                onChange={(v) => setField("securitiesInDemat", v)}
              />
            </div>
          </div>

          <InfoBanner>
            Enter amounts in rupees. Results update live and are indicative — confirm edge cases
            with a professional.
          </InfoBanner>

          <div className="flex justify-end print:hidden">
            <Tip label="Print applicability report">
              <Button
                size="icon"
                variant="outline"
                onClick={() => window.print()}
                aria-label="Print applicability report"
              >
                <Printer className="size-4" aria-hidden />
              </Button>
            </Tip>
          </div>
        </div>

        {/* Right column: results */}
        <div className="space-y-6">
          <StatCardGrid>
            <StatCard icon={Check} value={summary.applicable} label="Applicable" tone="good" />
            <StatCard icon={AlertTriangle} value={summary.review} label="Needs review" tone="warn" />
            <StatCard icon={X} value={summary.notApplicable} label="Not applicable" tone="neutral" />
          </StatCardGrid>

          <ResultSection
            title="Applicable to you"
            status="applicable"
            results={results}
            groupByCategory
          />
          <ResultSection title="Needs your review" status="review" results={results} />
          <ResultSection title="Not applicable" status="not-applicable" results={results} />
        </div>
      </div>
    </div>
  );
}

function ResultSection({
  title,
  status,
  results,
  groupByCategory = false,
}: {
  title: string;
  status: ApplicabilityStatus;
  results: ApplicabilityResult[];
  groupByCategory?: boolean;
}) {
  const items = results.filter((r) => r.status === status);
  if (items.length === 0) {
    return null;
  }

  return (
    <section>
      <h2 className="mb-2 flex items-baseline gap-2 font-heading text-lg font-semibold">
        {title}
        <span className="tabular font-mono text-xs font-normal text-muted-foreground">
          {items.length}
        </span>
      </h2>
      <div className="max-h-[480px] overflow-y-auto rounded-lg border print:max-h-none print:overflow-visible">
        {groupByCategory ? (
          APPLICABILITY_CATEGORIES.map((cat) => {
            const inCat = items.filter((r) => r.category === cat);
            if (inCat.length === 0) return null;
            return (
              <div key={cat}>
                <p className="border-b bg-muted/40 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {cat}
                </p>
                {inCat.map((r) => (
                  <ResultRow key={r.id} result={r} />
                ))}
              </div>
            );
          })
        ) : (
          items.map((r) => <ResultRow key={r.id} result={r} />)
        )}
      </div>
    </section>
  );
}

const STATUS_ICON: Record<ApplicabilityStatus, React.ReactNode> = {
  applicable: <Check className="size-4 text-emerald-600 dark:text-emerald-400" aria-hidden />,
  review: <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" aria-hidden />,
  "not-applicable": <X className="size-4 text-muted-foreground" aria-hidden />,
};

function ResultRow({ result }: { result: ApplicabilityResult }) {
  return (
    <div className="flex items-start gap-3 border-b bg-card px-4 py-3 last:border-b-0">
      <span className="mt-0.5 shrink-0">{STATUS_ICON[result.status]}</span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-medium">{result.title}</span>
          {result.refs.map((ref) => (
            <Badge key={ref} variant="outline" className="text-[10px]">
              {ref}
            </Badge>
          ))}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{result.reason}</p>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

function CheckboxField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  const id = React.useId();
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted/50"
    >
      <Checkbox id={id} checked={checked} onCheckedChange={(v) => onChange(v === true)} />
      {label}
    </label>
  );
}

