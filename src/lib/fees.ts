/**
 * MCA filing fees and additional (late) fees.
 *
 * The fee tables are amended by notification. Last checked October 2026
 * against the Companies (Registration Offices and Fees) Amendment Rules, 2022
 * (in force 1 July 2022) and the LLP (Second Amendment) Rules, 2022. Check the
 * current Rules before quoting a figure to a client.
 *
 * This is the single source of truth for the tables. `src/data/forms.ts`
 * renders its prose description from `describeSlabs()` so the two can never
 * drift apart.
 */

/** Normal filing fee by nominal share capital, in rupees. */
export type FeeBand = {
  /** Inclusive lower bound in rupees. */
  from: number;
  /** Exclusive upper bound, or null for the top band. */
  to: number | null;
  fee: number;
  label: string;
};

export const NORMAL_FEE_BANDS: FeeBand[] = [
  { from: 0, to: 100_000, fee: 200, label: "Less than ₹1,00,000" },
  { from: 100_000, to: 500_000, fee: 300, label: "₹1,00,000 to under ₹5,00,000" },
  { from: 500_000, to: 2_500_000, fee: 400, label: "₹5,00,000 to under ₹25,00,000" },
  { from: 2_500_000, to: 10_000_000, fee: 500, label: "₹25,00,000 to under ₹1,00,00,000" },
  { from: 10_000_000, to: null, fee: 600, label: "₹1,00,00,000 and above" },
];

/** Fee for a company not having share capital. */
export const NO_SHARE_CAPITAL_FEE = 200;

export function normalFeeBand(nominalCapital: number): FeeBand {
  const capital = Math.max(0, nominalCapital);
  return (
    NORMAL_FEE_BANDS.find((b) => capital >= b.from && (b.to === null || capital < b.to)) ??
    NORMAL_FEE_BANDS[NORMAL_FEE_BANDS.length - 1]
  );
}

export function normalFee(nominalCapital: number): number {
  return normalFeeBand(nominalCapital).fee;
}

/** Additional fee as a multiple of the normal fee, by length of delay. */
export type FeeSlab = {
  /** Inclusive upper bound in days, or null for "beyond that". */
  uptoDays: number | null;
  multiple: number;
  /**
   * "Higher additional fee": charged instead of `multiple` on a second or
   * later late INC-22 or PAS-3 within 365 days. Null where none applies.
   */
  higherMultiple: number | null;
  label: string;
};

/**
 * Companies (Registration Offices and Fees) Amendment Rules, 2022, in force
 * from 1 July 2022. Applies to every e-form EXCEPT forms under Sections 92 and
 * 137 (MGT-7/7A, AOC-4 — per day instead), charge forms (ad valorem), and an
 * increase in nominal share capital (SH-7, its own schedule).
 */
export const ADDITIONAL_FEE_SLABS: FeeSlab[] = [
  { uptoDays: 30, multiple: 2, higherMultiple: 3, label: "Up to 30 days" },
  { uptoDays: 60, multiple: 4, higherMultiple: 6, label: "More than 30 and up to 60 days" },
  { uptoDays: 90, multiple: 6, higherMultiple: 9, label: "More than 60 and up to 90 days" },
  { uptoDays: 180, multiple: 10, higherMultiple: 15, label: "More than 90 and up to 180 days" },
  { uptoDays: null, multiple: 12, higherMultiple: 18, label: "More than 180 days" },
];

/**
 * Forms under Sections 139 and 157 (ADT-1, DIR-3C) get a gentler first
 * fortnight: 1x for up to 15 days, then 2x up to 30, then the general table.
 */
export const FIRST_FORTNIGHT_SLAB: FeeSlab = {
  uptoDays: 15,
  multiple: 1,
  higherMultiple: null,
  label: "Up to 15 days (ADT-1 and DIR-3C only)",
};

/** Which slab table a form follows. */
export type SlabSchedule = "general" | "s139-s157";

export function slabsFor(schedule: SlabSchedule = "general"): FeeSlab[] {
  if (schedule === "general") return ADDITIONAL_FEE_SLABS;
  return [
    FIRST_FORTNIGHT_SLAB,
    { ...ADDITIONAL_FEE_SLABS[0], label: "More than 15 and up to 30 days" },
    ...ADDITIONAL_FEE_SLABS.slice(1),
  ];
}

export function slabForDelay(delayDays: number, schedule: SlabSchedule = "general"): FeeSlab {
  const slabs = slabsFor(schedule);
  return slabs.find((s) => s.uptoDays !== null && delayDays <= s.uptoDays) ?? slabs[slabs.length - 1];
}

/** Forms that can attract the higher additional fee on a repeat late filing. */
export const HIGHER_FEE_FORM_IDS = ["inc-22", "pas-3"] as const;

/** Prose used in the forms library, generated so it cannot drift from the table. */
export function describeSlabs(): string {
  const parts = ADDITIONAL_FEE_SLABS.map((s, i) => {
    if (i === 0) return `${s.multiple}x up to ${s.uptoDays} days`;
    if (s.uptoDays === null) return `${s.multiple}x beyond ${ADDITIONAL_FEE_SLABS[i - 1].uptoDays} days`;
    return `${s.multiple}x beyond ${ADDITIONAL_FEE_SLABS[i - 1].uptoDays} and up to ${s.uptoDays}`;
  });
  return (
    "Additional fee is charged as a multiple of the normal filing fee under the Companies " +
    "(Registration Offices and Fees) Rules, as amended with effect from 1 July 2022: " +
    parts.slice(0, -1).join(", ") +
    ", and " +
    parts[parts.length - 1] +
    ". Forms under Sections 139 and 157 (ADT-1, DIR-3C) pay 1x for the first 15 days. A second or later late INC-22 or PAS-3 within 365 days pays a higher additional fee of 3x to 18x instead. The normal fee itself depends on the nominal share capital of the company."
  );
}

/** Flat per-day additional fee for the annual filings under s.92 and s.137. */
export const PER_DAY_FEE = 100;

/* ------------------------------------------------------------------ */
/* LLP Form 8 and Form 11                                              */
/* ------------------------------------------------------------------ */

/**
 * Normal fee for LLP Form 8 and Form 11, by the LLP's total contribution
 * (LLP Rules, 2009, Annexure A).
 */
export const LLP_NORMAL_FEE_BANDS: FeeBand[] = [
  { from: 0, to: 100_001, fee: 50, label: "Up to ₹1,00,000" },
  { from: 100_001, to: 500_001, fee: 100, label: "₹1,00,001 to ₹5,00,000" },
  { from: 500_001, to: 1_000_001, fee: 150, label: "₹5,00,001 to ₹10,00,000" },
  { from: 1_000_001, to: 2_500_001, fee: 200, label: "₹10,00,001 to ₹25,00,000" },
  { from: 2_500_001, to: 10_000_001, fee: 400, label: "₹25,00,001 to ₹1,00,00,000" },
  { from: 10_000_001, to: null, fee: 600, label: "Above ₹1,00,00,000" },
];

export function llpNormalFeeBand(contribution: number): FeeBand {
  const c = Math.max(0, contribution);
  return (
    LLP_NORMAL_FEE_BANDS.find((b) => c >= b.from && (b.to === null || c < b.to)) ??
    LLP_NORMAL_FEE_BANDS[LLP_NORMAL_FEE_BANDS.length - 1]
  );
}

export type LlpSlab = {
  uptoDays: number | null;
  small: number;
  other: number;
  label: string;
};

/**
 * Additional fee for LLP Form 8 and Form 11 under the LLP (Second Amendment)
 * Rules, 2022 (from 1 April 2022), replacing the earlier flat ₹100 a day.
 * Multiples of the normal fee; beyond 360 days the top multiple plus a daily
 * amount, with no cap. A small LLP (contribution up to ₹25 lakh and turnover
 * up to ₹40 lakh) pays half the multiple of other LLPs.
 *
 * UNVERIFIED: secondary sources disagree on the bands; confirm against the
 * notification before quoting a figure.
 */
export const LLP_ADDITIONAL_FEE_SLABS: LlpSlab[] = [
  { uptoDays: 15, small: 1, other: 1, label: "Up to 15 days" },
  { uptoDays: 30, small: 2, other: 4, label: "More than 15 and up to 30 days" },
  { uptoDays: 60, small: 4, other: 8, label: "More than 30 and up to 60 days" },
  { uptoDays: 90, small: 6, other: 12, label: "More than 60 and up to 90 days" },
  { uptoDays: 180, small: 10, other: 20, label: "More than 90 and up to 180 days" },
  { uptoDays: 360, small: 15, other: 30, label: "More than 180 and up to 360 days" },
  { uptoDays: null, small: 15, other: 30, label: "More than 360 days (plus a daily amount)" },
];

/** Daily amount on top of the 360-day multiple, for each day beyond 360. */
export const LLP_DAILY_BEYOND_360 = { small: 10, other: 20 } as const;

/* ------------------------------------------------------------------ */
/* The calculation                                                     */
/* ------------------------------------------------------------------ */

export type LateFeeInput = {
  /** "per-day" for AOC-4 / MGT-7; "slab" for most other e-forms; "llp" for LLP Form 8/11. */
  kind: "per-day" | "slab" | "llp";
  normalFee: number;
  delayDays: number;
  /** "slab" only: which table. Defaults to the general one. */
  schedule?: SlabSchedule;
  /** "slab" only: a repeat late INC-22 / PAS-3, charged at the higher additional fee. */
  higher?: boolean;
  /** "llp" only: a small LLP pays the lower multiples. */
  smallLlp?: boolean;
  /**
   * An MCA relaxation that waives the additional fee for this filing, when
   * the filing date falls inside it. See src/data/fee-relaxations.ts.
   */
  waivedBy?: string | null;
};

export type LateFeeResult = {
  delayDays: number;
  normalFee: number;
  additionalFee: number;
  total: number;
  /** How the additional fee was arrived at. */
  basis: string;
  slab: FeeSlab | null;
  /** The multiple actually applied, where one was. */
  multiple: number | null;
};

export function calculateLateFee(input: LateFeeInput): LateFeeResult {
  const delayDays = Math.max(0, Math.trunc(input.delayDays));
  const base = Math.max(0, input.normalFee);
  const none = (basis: string): LateFeeResult => ({
    delayDays,
    normalFee: base,
    additionalFee: 0,
    total: base,
    basis,
    slab: null,
    multiple: null,
  });

  if (delayDays === 0) return none("Filed on or before the due date, so no additional fee arises.");
  if (input.waivedBy) {
    return none(`${delayDays} days late, but the additional fee is waived: ${input.waivedBy}`);
  }

  if (input.kind === "per-day") {
    const additionalFee = delayDays * PER_DAY_FEE;
    return {
      delayDays,
      normalFee: base,
      additionalFee,
      total: base + additionalFee,
      basis: `${delayDays} days × ${formatInr(PER_DAY_FEE)} per day, with no upper limit (s.403).`,
      slab: null,
      multiple: null,
    };
  }

  if (input.kind === "llp") {
    const small = input.smallLlp === true;
    const slab =
      LLP_ADDITIONAL_FEE_SLABS.find((s) => s.uptoDays !== null && delayDays <= s.uptoDays) ??
      LLP_ADDITIONAL_FEE_SLABS[LLP_ADDITIONAL_FEE_SLABS.length - 1];
    const multiple = small ? slab.small : slab.other;
    const daily = small ? LLP_DAILY_BEYOND_360.small : LLP_DAILY_BEYOND_360.other;
    const extraDays = Math.max(0, delayDays - 360);
    const additionalFee = base * multiple + extraDays * daily;
    const who = small ? "small LLP" : "LLP other than a small LLP";
    return {
      delayDays,
      normalFee: base,
      additionalFee,
      total: base + additionalFee,
      basis:
        extraDays > 0
          ? `${slab.label}: ${multiple}× the normal fee of ${formatInr(base)}, plus ${extraDays} days beyond 360 × ${formatInr(daily)} (${who}, LLP (Second Amendment) Rules, 2022).`
          : `${slab.label} → ${multiple}× the normal fee of ${formatInr(base)} (${who}, LLP (Second Amendment) Rules, 2022).`,
      slab: null,
      multiple,
    };
  }

  const slab = slabForDelay(delayDays, input.schedule ?? "general");
  const useHigher = input.higher === true && slab.higherMultiple !== null;
  const multiple = useHigher ? slab.higherMultiple! : slab.multiple;
  const additionalFee = base * multiple;
  return {
    delayDays,
    normalFee: base,
    additionalFee,
    total: base + additionalFee,
    basis: useHigher
      ? `${slab.label} → higher additional fee of ${multiple}× the normal fee of ${formatInr(base)}, for a repeat late filing within 365 days.`
      : `${slab.label} → ${multiple}× the normal fee of ${formatInr(base)}.`,
    slab,
    multiple,
  };
}

/** Indian digit grouping: ₹1,00,00,000 rather than ₹10,000,000. */
export function formatInr(amount: number): string {
  return `₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(
    Math.round(amount),
  )}`;
}
