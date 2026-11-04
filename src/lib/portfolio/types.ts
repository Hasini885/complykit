import type { CompanyType } from "@/lib/dates";

/**
 * Portfolio domain types.
 *
 * Shapes are deliberately storage-agnostic: dates are ISO strings rather than
 * Date objects so a record round-trips through JSON, localStorage or a SQL
 * column unchanged. Nothing here imports React or touches the browser.
 */

export type ClientStatus = "active" | "dormant" | "strike-off" | "closed";

export type AuditorType = "first" | "subsequent";

export type AuthorisedPerson = { kind: "director"; directorId: string } | { kind: "consultant" };

export type PointOfContact = "authorised" | "consultant";

export const CLIENT_STATUSES: { value: ClientStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "dormant", label: "Dormant" },
  { value: "strike-off", label: "Under strike-off" },
  { value: "closed", label: "Closed" },
];

export type Client = {
  id: string;
  name: string;
  /** Corporate Identity Number, or LLPIN for an LLP. */
  cin: string;
  type: CompanyType;
  /** ISO date, yyyy-mm-dd. */
  incorporatedOn: string;
  registeredOffice: string;
  status: ClientStatus;
  /** The company's contact mobile, 10 digits, stored without +91 or spaces. */
  mobile?: string;
  /** The company's contact email, for its letterhead. */
  email?: string;
  /**
   * Reference: the consultant (from the consultant master) who handles or
   * referred this company. Null or absent when there is none.
   */
  consultantId?: string | null;
  /**
   * @deprecated Replaced by authorisedDirectorId and pointOfContact; read
   * only to carry an older save's choice across.
   */
  authorisedPerson?: AuthorisedPerson | null;
  /** The director who is the company's authorised person (always a director). */
  authorisedDirectorId?: string | null;
  /**
   * Who the firm deals with: the authorised person themself, or, where a
   * third person is involved, the consultant named in consultantId.
   */
  pointOfContact?: PointOfContact;
  /** SRN of the ADT-1 filed for the current (subsequent) auditor. */
  adt1Srn?: string;
  /** ISO date that ADT-1 was filed; the AGM it reports fixes the start of the term. */
  adt1FiledOn?: string | null;
  /**
   * ISO date of the most recent AGM actually held, where known. Each AGM
   * belongs to the financial year that closed before it (see agmFyOf in
   * src/lib/portfolio/clients.ts), so it only anchors that year's filings.
   */
  lastAgmOn?: string | null;
  /**
   * Earlier AGMs, ISO dates. Recording a new AGM moves the previous one here
   * rather than overwriting it, so every past year keeps its own anchor and
   * the next AGM's fifteen-month limit (Section 96) can be worked out.
   */
  agmHistory?: string[];
  notes?: string;

  /** Listed on a recognised stock exchange. Not visible in every crop of the
   * reference screenshot, but required for the Applicability Analyzer to
   * answer correctly — several thresholds turn entirely on this one flag. */
  listed?: boolean;

  /**
   * Calendar year the working financial year ends in, e.g. 2027 for
   * FY 2026-27. Absent means "compute from today's date" — this only exists
   * to let a user look at a year other than the current one; it is never
   * required to have a value.
   */
  workingFyEndingYear?: number | null;

  /** Rupees. The capital the MOA authorises the company to issue. */
  authorisedCapital?: number;
  /** Rupees. Same figures the Applicability Analyzer asks for, stored once. */
  paidUpCapital?: number;
  turnover?: number;
  netWorth?: number;
  netProfit?: number;
  borrowings?: number;
  deposits?: number;
  /** Rupees, LLPs only — the partners' contribution. */
  llpContribution?: number;
  directorsCount?: number;

  msmeDuesOver45Days?: boolean;
  securitiesInDemat?: boolean;
  /**
   * Files DPT-3: the company has deposits, or loans and other receipts not
   * treated as deposits, outstanding as at 31 March. Off by default; the
   * DPT-3 due appears only when ticked.
   */
  filesDpt3?: boolean;
  /**
   * ADT-1 applies to this company. Absent or true: it falls due as the
   * auditor's term works out (see auditorAppointedAtAgmFy). False: never shown.
   */
  filesAdt1?: boolean;
  /** A transfer-pricing report (Form 3CEB) is required, moving the ITR to 30 November. */
  transferPricing?: boolean;
  /**
   * Financial year (year of its 31 March) whose AGM appointed the current
   * auditor. ADT-1 recurs every five years from it. Null means "work it out":
   * the first AGM after incorporation, then every fifth year.
   */
  auditorAppointedAtAgmFy?: number | null;
  /**
   * Term, in years, for which the current (subsequent) auditor was appointed at
   * that AGM: up to five under Section 139(1). ADT-1 next falls due when the
   * term ends. Null means the usual five years.
   */
  auditorTermYears?: number | null;
  /**
   * Which auditor is in office. "first": appointed by the Board within 30 days
   * of incorporation (Section 139(6)), holding office until the first AGM.
   * "subsequent": appointed at an AGM for a term of up to five years (Section
   * 139(1)). Absent: worked out from whether the first AGM has come round.
   */
  auditorType?: AuditorType;
  /** ISO date of the Board meeting that appointed the first auditor; ADT-1 is due 15 days later. */
  firstAuditorAppointedOn?: string | null;
  /**
   * @deprecated A yes/no for "appointed this year" never moved on with the
   * year. Read only to migrate old saved data into auditorAppointedAtAgmFy.
   */
  auditorAppointedThisYear?: boolean;

  /** Deadlines met: when each was filed and its SRN. See src/lib/portfolio/filings.ts. */
  filings?: FilingRecord[];
  /** One-off due dates the user chose for a single occurrence. See due-overrides.ts. */
  dueOverrides?: DueOverride[];

  createdAt: string;
  updatedAt: string;
};

/**
 * A deadline met. `key` names the obligation and the year it belongs to (see
 * filingKey), so a record stays attached to the right row as dates are
 * recomputed. The SRN is the Service Request Number MCA issues on filing.
 */
/** A user-chosen due date for one occurrence; `key` is the same as a filing's. */
export type DueOverride = {
  key: string;
  /** ISO date the user wants to work to, this time only. */
  date: string;
  note?: string;
};

export type FilingRecord = {
  key: string;
  /** ISO date the form was filed or the meeting held. */
  filedOn: string;
  /** Uppercase; empty where nothing is filed with MCA (e.g. holding the AGM). */
  srn: string;
};

/**
 * One director's appointment at one client.
 *
 * A director can hold many of these, which is what makes the relationship
 * many-to-many. Kept as an embedded array on the director rather than a
 * separate collection: it is the side that is always read together, and it maps
 * cleanly onto a join table later.
 */
export type Directorship = {
  clientId: string;
  /**
   * The DIN this director is recorded under at this company, where it differs
   * from their main DIN (Director.din). Absent means the main DIN. Kept at the
   * owner's request: one person, with a DIN per company.
   */
  din?: string;
  role: string;
  /** ISO date. */
  appointedOn: string;
  /** ISO date, or null while still in office. */
  cessationOn?: string | null;
  /** Why the director ceased, under the Act. Absent while in office. */
  cessationReason?: CessationReason;
};

/** Ways a directorship ends under the Companies Act, 2013. */
export type CessationReason = "resignation" | "removal" | "vacation" | "retirement" | "death" | "other";

export const CESSATION_REASONS: { value: CessationReason; label: string; section: string }[] = [
  { value: "resignation", label: "Resignation", section: "Section 168" },
  { value: "removal", label: "Removal by the members", section: "Section 169" },
  { value: "vacation", label: "Vacation of office (e.g. disqualified, absent from all meetings for 12 months)", section: "Section 167" },
  { value: "retirement", label: "Retirement by rotation, not re-appointed at the AGM", section: "Section 152(6)" },
  { value: "death", label: "Death", section: "—" },
  { value: "other", label: "Other (e.g. end of a fixed term)", section: "—" },
];

export type Director = {
  id: string;
  name: string;
  /** 8-digit DIN, or DPIN for an LLP designated partner. */
  din: string;
  /**
   * ISO date the DIN was allotted. This anchors the DIR-3 KYC cycle, which
   * runs from the financial year of allotment rather than from the last filing.
   * Optional: "" when not known, and then no KYC due date is shown.
   */
  dinAllottedOn: string;
  /** ISO date of the most recent DIR-3 KYC actually filed, if any. */
  lastKycFiledOn?: string | null;
  /** SRN of that DIR-3 KYC filing. */
  lastKycSrn?: string | null;
  email?: string;
  /**
   * Whether this director is the authorised person (for signing and filing on
   * the company's behalf). False means someone other than a director is, a
   * consultant, whose name and mobile are recorded below. Absent on records
   * saved before the question was asked.
   */
  isAuthorisedPerson?: boolean;
  /** The consultant acting as authorised person, when isAuthorisedPerson is false. */
  consultantName?: string;
  /** Their mobile number, 10 digits, stored without +91 or spaces. */
  consultantMobile?: string;
  directorships: Directorship[];
  createdAt: string;
  updatedAt: string;
};

/**
 * A consultant: a professional (CA, CS or other) who handles companies in the
 * portfolio. Companies point at one through Client.consultantId.
 */
export type Consultant = {
  id: string;
  name: string;
  /** 10 digits, stored without +91 or spaces. */
  mobile: string;
  email?: string;
  /** Firm or practice name, optional. */
  firm?: string;
  createdAt: string;
  updatedAt: string;
};

/** Everything the portfolio holds, as one serialisable unit. */
export type PortfolioSnapshot = {
  clients: Client[];
  directors: Director[];
  /** The consultant master. Absent in saves made before it existed. */
  consultants: Consultant[];
  activeClientId: string | null;
  /** Bumped when the stored shape changes, so a migration can be written. */
  version: number;
};

export const PORTFOLIO_VERSION = 1;

export function emptySnapshot(): PortfolioSnapshot {
  return { clients: [], directors: [], consultants: [], activeClientId: null, version: PORTFOLIO_VERSION };
}
