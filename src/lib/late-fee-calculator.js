import { relaxationFor, waivesFee } from "@/data/fee-relaxations";
import { addDays, daysBetween, financialYearEnd, makeDate, parseIsoDate } from "@/lib/dates";
import { calculateLateFee, formatInr, normalFeeBand } from "@/lib/fees";
import { financialYearEndYear } from "@/lib/portfolio/directors";

/**
 * Late fee calculator for the six filings on the MCA dashboard: ADT-1,
 * INC-20A, ITR, AOC-4, MGT-7/7A and DPT-3, plus DIR-12, MGT-14, PAS-3, CHG-1
 * and the other event-based ROC forms. It works out the due date from
 * the event that starts the clock (AGM, incorporation, appointment or the
 * financial year), counts the delay to the date of filing and prices it.
 *
 * The MCA fee rules themselves live in `fees.js` (the 2022 additional-fee
 * table, the ₹100 a day for s.92/s.137); this file only knows which rule each
 * form takes and how its due date is found. Fee relaxations (MCA and CBDT
 * circulars) come from `data/fee-relaxations.js`.
 */

export const CALC_COMPANY_TYPES = [
  { value: "private", label: "Private Limited Company" },
  { value: "public", label: "Public Limited Company" },
  { value: "small", label: "Small Company" },
  { value: "opc", label: "One Person Company (OPC)" },
];

/**
 * `event` says which date starts the clock:
 * - "agm": the AGM date (or, for ADT-1, the meeting that appointed the auditor)
 * - "incorporation": the date of incorporation
 * - "fy": the financial year the filing is for
 */
export const CALC_FORMS = [
  {
    id: "adt-1",
    group: "dashboard",
    fee: "slab-adt",
    code: "ADT-1",
    name: "Appointment of auditor",
    event: "agm",
    eventLabel: "Date of AGM / board meeting appointing the auditor",
    dueRule: "Within 15 days of the meeting that appointed the auditor",
  },
  {
    id: "inc-20a",
    group: "dashboard",
    fee: "slab",
    code: "INC-20A",
    name: "Declaration of commencement of business",
    event: "incorporation",
    eventLabel: "Date of incorporation",
    dueRule: "Within 180 days of incorporation",
  },
  {
    id: "itr",
    group: "dashboard",
    fee: "itr",
    code: "ITR",
    name: "Income tax return (ITR-6)",
    event: "fy",
    eventLabel: "Financial year",
    dueRule: "31 October after the financial year (30 November with a transfer-pricing report)",
  },
  {
    id: "aoc-4",
    group: "dashboard",
    fee: "per-day",
    code: "AOC-4",
    name: "Financial statements",
    event: "agm",
    eventLabel: "Date of AGM",
    dueRule: "Within 30 days of the AGM (OPC: 180 days from the end of the financial year)",
  },
  {
    id: "mgt-7",
    group: "dashboard",
    fee: "per-day",
    code: "MGT-7/7A",
    name: "Annual return",
    event: "agm",
    eventLabel: "Date of AGM",
    dueRule: "Within 60 days of the AGM (OPC: 60 days from 30 September)",
  },
  {
    id: "dpt-3",
    group: "dashboard",
    fee: "slab",
    code: "DPT-3",
    name: "Return of deposits",
    event: "fy",
    eventLabel: "Financial year",
    dueRule: "30 June after the financial year",
  },
  // The other event-based ROC forms: [id, code, name, event, days to file, fee rule].
  ...[
    ["adt-3", "ADT-3", "Notice of resignation by auditor", "Date of resignation", 30, "slab"],
    ["aoc-5", "AOC-5", "Address for keeping books of account", "Date of board resolution", 7, "slab"],
    ["ben-2", "BEN-2", "Return of significant beneficial owners", "Date BEN-1 was received", 30, "slab"],
    ["chg-1", "CHG-1", "Creation or modification of charge", "Date of creation of charge", 30, "chg"],
    ["chg-4", "CHG-4", "Satisfaction of charge", "Date of satisfaction", 30, "slab"],
    ["chg-9", "CHG-9", "Charge for debentures", "Date of creation of charge", 30, "chg"],
    ["cra-2", "CRA-2", "Appointment of cost auditor", "Date of board meeting", 30, "slab"],
    ["cra-4", "CRA-4", "Cost audit report", "Date the cost audit report was received", 30, "slab"],
    ["dir-12", "DIR-12", "Appointment or cessation of director / KMP", "Date of appointment or cessation", 30, "slab"],
    ["inc-22", "INC-22", "Change of registered office", "Date of change", 30, "slab"],
    ["inc-28", "INC-28", "Order of Court / Tribunal", "Date the certified order was received", 30, "slab"],
    ["mgt-14", "MGT-14", "Resolutions and agreements", "Date of resolution", 30, "slab"],
    ["mgt-15", "MGT-15", "Report on AGM (listed company)", "Date of AGM", 30, "slab"],
    ["pas-3", "PAS-3", "Return of allotment", "Date of allotment", 15, "slab"],
    ["pas-6", "PAS-6", "Share capital reconciliation report", "Half-year ending on", 60, "slab"],
    ["other", "Other", "Any other event-based ROC form", "Date of event", 30, "slab"],
  ].map(([id, code, name, eventLabel, dueDays, fee]) => ({
    id,
    code,
    name,
    group: "other",
    fee,
    event: "date",
    eventLabel,
    dueDays,
    dueRule: `Within ${dueDays} days of the ${eventLabel.replace(/^Date (of )?(the )?/, "").toLowerCase()}`,
  })),
  {
    id: "dir-3-kyc",
    code: "DIR-3 KYC",
    name: "KYC of directors (DIN holders)",
    group: "other",
    fee: "kyc",
    event: "fy",
    eventLabel: "Financial year",
    dueRule: "30 June after the financial year in which KYC falls due",
  },
  {
    id: "msme-1",
    code: "MSME-1",
    name: "Half-yearly return of MSME dues",
    group: "other",
    fee: "none",
    event: "date",
    eventLabel: "Half-year ending on",
    dueRule: "31 October (April–September) and 30 April (October–March)",
  },
];

export const calcForm = (id) => CALC_FORMS.find((f) => f.id === id) ?? CALC_FORMS[0];

/** Income-tax late fee, Section 234F. */
export const ITR_FEE = { standard: 5_000, smallIncome: 1_000, smallIncomeLimit: 500_000 };
/** Section 234A interest, per month or part of a month. */
export const ITR_INTEREST_RATE = 0.01;

/** MGT-7A is the abridged annual return of an OPC or a small company. */
export function annualReturnCode(companyType) {
  return companyType === "opc" || companyType === "small" ? "MGT-7A" : "MGT-7";
}

/**
 * The event that starts the clock for a form, in plain words, given the
 * company type (an OPC's AOC-4 and MGT-7A run from the financial year, as an
 * OPC holds no AGM).
 */
export function eventFor(formId, companyType) {
  const form = calcForm(formId);
  if (companyType === "opc" && (form.id === "aoc-4" || form.id === "mgt-7")) {
    return { event: "fy", label: "Financial year" };
  }
  return { event: form.event, label: form.eventLabel };
}

/**
 * The statutory due date. `eventDate` is the AGM / incorporation / meeting
 * date; `fyEndingYear` is the financial year (2026 = FY 2025–26).
 */
export function dueDateFor({ formId, companyType, eventDate, fyEndingYear, transferPricing = false }) {
  const opc = companyType === "opc";
  switch (formId) {
    case "adt-1":
      return eventDate ? addDays(eventDate, 15) : null;
    case "inc-20a":
      return eventDate ? addDays(eventDate, 180) : null;
    case "aoc-4":
      if (opc) return fyEndingYear ? addDays(financialYearEnd(fyEndingYear), 180) : null;
      return eventDate ? addDays(eventDate, 30) : null;
    case "mgt-7":
      if (opc) return fyEndingYear ? addDays(makeDate(fyEndingYear, 9, 30), 60) : null;
      return eventDate ? addDays(eventDate, 60) : null;
    case "dpt-3":
      return fyEndingYear ? makeDate(fyEndingYear, 6, 30) : null;
    case "itr":
      return fyEndingYear ? makeDate(fyEndingYear, transferPricing ? 11 : 10, transferPricing ? 30 : 31) : null;
    case "dir-3-kyc":
      return fyEndingYear ? makeDate(fyEndingYear, 6, 30) : null;
    case "msme-1":
      // The last day of the month after the half-year: 31 October, 30 April.
      return eventDate ? makeDate(eventDate.getFullYear(), eventDate.getMonth() + 3, 0) : null;
    default: {
      const days = calcForm(formId).dueDays;
      return eventDate && days ? addDays(eventDate, days) : null;
    }
  }
}

/** The relaxation id to look up: the annual return covers MGT-7 and MGT-7A alike. */
function relaxationFormId(formId) {
  return formId === "mgt-7" ? "mgt-7" : formId;
}

/** The financial year a filing is for, from its due date (the season runs the year after). */
export function seasonYear(dueDate) {
  return financialYearEndYear(dueDate) - 1;
}

/** DIR-3 KYC filed after its due date: a flat fee per DIN holder. */
export const KYC_LATE_FEE = 5_000;

/**
 * Charge forms (CHG-1, CHG-9), Companies (Registration Offices and Fees)
 * Amendment Rules, 2019: a multiple of the normal fee plus an ad valorem fee
 * on the amount secured, capped, with lower rates for a small company or OPC.
 * `uptoDelay` counts days after the 30-day due date (30 = filed within 60
 * days of creation). Past 90 days late the Registrar cannot register it; only
 * the Central Government can condone the delay (Section 87, CHG-8).
 */
export const CHARGE_BANDS = [
  {
    uptoDelay: 30,
    small: { multiple: 3, rate: 0.00025, cap: 100_000 },
    other: { multiple: 6, rate: 0.0005, cap: 500_000 },
  },
  {
    uptoDelay: 90,
    small: { multiple: 6, rate: 0.0005, cap: 200_000 },
    other: { multiple: 12, rate: 0.001, cap: 1_000_000 },
  },
];

const smallOrOpc = (companyType) => companyType === "small" || companyType === "opc";
const pct = (rate) => `${+(rate * 100).toFixed(3)}%`;

/**
 * Prices an MCA form (everything but ITR) for a known delay: normal fee,
 * additional fee, any ad valorem fee and the total. `waivedBy` is a
 * relaxation summary when a circular removes the fee.
 */
export function mcaLateFee({
  formId,
  capital,
  delayDays,
  companyType = "private",
  amountSecured = 0,
  waivedBy = null,
}) {
  const form = calcForm(formId);
  const band = normalFeeBand(capital);
  const days = Math.max(0, Math.trunc(delayDays));
  const plain = (normalFee, additionalFee, basis, extra = {}) => ({
    delayDays: days,
    normalFee,
    additionalFee,
    adValorem: 0,
    total: normalFee + additionalFee,
    basis,
    multiple: null,
    barred: false,
    band,
    ...extra,
  });

  if (form.fee === "none") {
    return plain(0, 0, "No filing fee and no additional fee are prescribed for MSME-1.");
  }
  if (form.fee === "kyc") {
    return days === 0
      ? plain(0, 0, "Filed on or before the due date, so no fee.")
      : plain(0, KYC_LATE_FEE, `Filed after the due date: a flat ${formatInr(KYC_LATE_FEE)} per DIN holder.`);
  }
  if (form.fee === "chg") {
    if (days === 0) return plain(band.fee, 0, "Filed within 30 days of creation, so only the normal fee.");
    const slab = CHARGE_BANDS.find((b) => days <= b.uptoDelay);
    if (!slab) {
      return plain(
        band.fee,
        0,
        "More than 120 days from creation: the Registrar cannot register it. Apply to the Central Government for condonation in CHG-8 (Section 87).",
        { barred: true },
      );
    }
    const small = smallOrOpc(companyType);
    const rule = small ? slab.small : slab.other;
    const secured = Math.max(0, amountSecured);
    const adValorem = Math.min(Math.round(secured * rule.rate), rule.cap);
    const additionalFee = band.fee * rule.multiple;
    return plain(
      band.fee,
      additionalFee,
      `Filed within ${days <= 30 ? 60 : 120} days of creation → ${rule.multiple}× the normal fee of ${formatInr(band.fee)}, ` +
        `plus ad valorem ${pct(rule.rate)} of the amount secured, up to ${formatInr(rule.cap)}` +
        `${small ? " (small company / OPC rates)" : ""}.` +
        (secured > 0 ? "" : " Enter the amount secured to add the ad valorem fee."),
      { adValorem, total: band.fee + additionalFee + adValorem, multiple: rule.multiple },
    );
  }

  const result = calculateLateFee({
    kind: form.fee === "per-day" ? "per-day" : "slab",
    normalFee: band.fee,
    delayDays: days,
    schedule: form.fee === "slab-adt" ? "s139-s157" : "general",
    waivedBy,
  });
  return { ...result, adValorem: 0, barred: false, band };
}

/**
 * Prices a late ITR: the s.234F fee plus s.234A interest at 1% a month or part
 * of a month on the tax unpaid on the due date. With dates the months are
 * counted exactly; with only a number of days, each 30 days (or part) is a
 * month.
 */
export function itrLateFee({ delayDays, smallIncome = false, taxUnpaid = 0, dueDate = null, filedDate = null }) {
  const days = Math.max(0, Math.trunc(delayDays));
  if (days === 0) {
    return {
      delayDays: 0,
      normalFee: 0,
      additionalFee: 0,
      adValorem: 0,
      interest: 0,
      months: 0,
      total: 0,
      multiple: null,
      basis: "Filed on or before the due date, so no fee under Section 234F and no interest under Section 234A.",
    };
  }
  const fee = smallIncome ? ITR_FEE.smallIncome : ITR_FEE.standard;
  const months = dueDate && filedDate ? monthsOrPart(dueDate, filedDate) : Math.ceil(days / 30);
  const tax = Math.max(0, taxUnpaid);
  const interest = Math.round(tax * ITR_INTEREST_RATE * months);
  return {
    delayDays: days,
    normalFee: 0,
    additionalFee: fee,
    adValorem: 0,
    interest,
    months,
    total: fee + interest,
    multiple: null,
    basis:
      `Section 234F fee of ${formatInr(fee)}` +
      (smallIncome ? " (total income up to ₹5 lakh)" : "") +
      (tax > 0
        ? `, plus Section 234A interest of 1% × ${months} month${months === 1 ? "" : "s"} on ${formatInr(tax)} of tax unpaid.`
        : ". Enter the tax unpaid on the due date to add Section 234A interest."),
  };
}

/** Months or part of a month from the day after `due` to `filed` (s.234A). */
export function monthsOrPart(due, filed) {
  const start = addDays(due, 1);
  if (filed < start) return 0;
  let months = (filed.getFullYear() - start.getFullYear()) * 12 + (filed.getMonth() - start.getMonth());
  if (filed.getDate() >= start.getDate()) months += 1;
  return Math.max(1, months);
}

/**
 * The whole calculation from dates. Returns null until the dates needed are
 * in. A circular that waives the fee (MCA) or extends the due date (CBDT) is
 * applied and reported in `relaxation`.
 */
export function calculateFromDates({
  formId,
  companyType,
  capital,
  eventDate,
  fyEndingYear,
  filedDate,
  transferPricing = false,
  smallIncome = false,
  taxUnpaid = 0,
  amountSecured = 0,
}) {
  const statutoryDue = dueDateFor({ formId, companyType, eventDate, fyEndingYear, transferPricing });
  if (!statutoryDue || !filedDate) return null;

  const relaxation = relaxationFor(relaxationFormId(formId), seasonYear(statutoryDue));
  // The CBDT extension for audit cases moves the ITR due date itself
  // (companies are always audited); MCA circulars only waive the fee.
  const extended = relaxation?.extendsDueDate && !transferPricing ? relaxation : null;
  const due = extended ? parseIsoDate(extended.feeFreeUntil) : statutoryDue;
  const delayDays = Math.max(0, daysBetween(due, filedDate));

  if (formId === "itr") {
    const r = itrLateFee({ delayDays, smallIncome, taxUnpaid, dueDate: due, filedDate });
    return { ...r, statutoryDue, due, relaxation: extended, waived: false };
  }

  const waived = relaxation && !relaxation.extendsDueDate && delayDays > 0 && waivesFee(relaxation, filedDate);
  const r = mcaLateFee({
    formId,
    capital,
    delayDays,
    companyType,
    amountSecured,
    waivedBy: waived ? `${relaxation.summary} (${relaxation.circular}).` : null,
  });
  return { ...r, interest: 0, statutoryDue, due, relaxation: relaxation?.extendsDueDate ? null : relaxation, waived };
}

/** Every form priced for the same number of days late, for the compare table. */
export function compareAll({
  capital,
  delayDays,
  companyType = "private",
  amountSecured = 0,
  smallIncome = false,
  taxUnpaid = 0,
}) {
  return CALC_FORMS.map((form) => ({
    form,
    result:
      form.id === "itr"
        ? itrLateFee({ delayDays, smallIncome, taxUnpaid })
        : { ...mcaLateFee({ formId: form.id, capital, delayDays, companyType, amountSecured }), interest: 0 },
  }));
}

/** Notes worth showing beside the figure, by form. */
export function notesFor(formId, companyType, delayDays) {
  const notes = [];
  if (formId === "inc-20a") {
    notes.push(
      "Besides the additional fee, Section 10A(2) carries a penalty of ₹50,000 on the company and ₹1,000 a day on each officer in default (up to ₹1,00,000), and the company cannot commence business until it is filed.",
    );
  }
  if (formId === "adt-1") {
    notes.push("ADT-1 pays 1× the normal fee for the first 15 days late, then the usual 2× to 12×.");
  }
  if ((formId === "aoc-4" || formId === "mgt-7") && delayDays > 0) {
    notes.push(
      "₹100 a day with no upper limit. Penalties under Section 137(3) or 92(5) are separate and are levied by the ROC.",
    );
  }
  if ((formId === "inc-22" || formId === "pas-3") && delayDays > 0) {
    notes.push("A second late INC-22 or PAS-3 within 365 days pays the higher additional fee (3× to 18×) instead.");
  }
  if (formId === "chg-1" || formId === "chg-9") {
    notes.push(
      "Charge forms do not use the 2× to 12× table: the 2019 rules charge a multiple plus an ad valorem fee, and nothing can be filed directly after 120 days from creation.",
    );
  }
  if (formId === "dir-3-kyc") {
    notes.push(
      "A missed DIR-3 KYC deactivates the DIN until it is filed with the ₹5,000 fee. The fee is per person, not per company.",
    );
  }
  if (formId === "msme-1") {
    notes.push("Not filing attracts a penalty under Section 405(4), levied separately by the ROC.");
  }
  const fee = calcForm(formId).fee;
  if ((fee === "slab" || fee === "slab-adt" || fee === "per-day") && delayDays > 270) {
    notes.push("More than 270 days late: confirm on the MCA portal whether the form can still be filed directly.");
  }
  if (smallOrOpc(companyType) && (fee === "slab" || fee === "slab-adt" || fee === "per-day")) {
    notes.push("Small companies and OPCs get half the penalty under Section 446B; the filing fees are the same.");
  }
  return notes;
}
