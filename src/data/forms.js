/**
 * MCA e-forms reference data.
 *
 * SOURCE: compiled from the Companies Act, 2013, the rules made under it, and
 * the Ministry of Corporate Affairs (mca.gov.in).
 *
 * UNVERIFIED SEED DATA - must be reviewed by a practising CA/CS before launch.
 *   1. Deadlines, thresholds and fee structures change by amendment, notification
 *      and circular. Every row below needs checking against the current rules.
 *   2. `mcaUrl` points at the official MCA forms library, NOT a per-form deep
 *      link. MCA rotates deep links and blocks automated checking, so these were
 *      not machine-verified. Open each in a browser before launch.
 *
 * Flip `legal.dataUnverified` in src/config/site.ts once review is complete.
 */

import { describeSlabs, formatInr, PER_DAY_FEE } from "@/lib/fees";

export const FORM_CATEGORIES = [
  "Incorporation & setup",
  "Annual filing",
  "Directors & KMP",
  "Audit",
  "Share capital",
  "Charges",
  "Deposits & disclosures",
  "LLP",
];

const MCA_COMPANY_FORMS = "https://www.mca.gov.in/content/mca/global/en/mca/e-filing/company-forms-download.html";
const MCA_LLP_FORMS = "https://www.mca.gov.in/content/mca/global/en/mca/e-filing/llp-forms-download.html";

/** Additional fee slab used by most event-driven forms. */
const SLAB = {
  kind: "slab",
  summary: "Multiple of the normal fee, by length of delay",
  // Generated from the table in src/lib/fees.ts so the prose cannot drift.
  detail: describeSlabs(),
};

const PER_DAY_100 = {
  kind: "per-day",
  summary: `${formatInr(PER_DAY_FEE)} per day of delay, no cap`,
  detail: `Section 403 charges a flat ${formatInr(PER_DAY_FEE)} for every day the filing is late, with no upper limit, in addition to the normal fee. The amount runs until the form is actually filed, so a long-forgotten return can become the single largest compliance cost a small company faces.`,
};

/** LLP Form 8 and Form 11, LLP (Second Amendment) Rules, 2022. */
const LLP_SLAB = {
  kind: "slab",
  calc: "llp",
  summary: "Multiple of the normal fee by delay; a daily amount after 360 days",
  detail:
    "Since 1 April 2022 the flat ₹100 a day has been replaced by multiples of the normal fee (₹50 to ₹600 by contribution): for a small LLP 1x up to 15 days, then 2x, 4x, 6x, 10x and 15x up to 360 days; double those multiples for other LLPs. Beyond 360 days the top multiple applies plus ₹10 a day (small LLP) or ₹20 a day (other LLPs), with no cap. Form 8 and Form 11 each accrue separately. Secondary sources differ on the bands, so confirm against the LLP (Second Amendment) Rules, 2022 before quoting a figure.",
};

export const forms = [
  {
    id: "inc-20a",
    code: "INC-20A",
    name: "Declaration for commencement of business",
    purpose:
      "Declaration by a director that every subscriber to the memorandum has paid the value of the shares agreed to be taken, filed with proof of payment.",
    section: "Section 10A · Rule 23A",
    sectionRefs: ["10A"],
    trigger: "Incorporation of a company having share capital",
    deadline: "Within 180 days of the date of incorporation",
    category: "Incorporation & setup",
    entity: ["company"],
    lateFee: {
      kind: "flat",
      summary: "₹50,000 on the company; ₹1,000 per day on each officer",
      detail:
        "Section 10A(2) provides a penalty of ₹50,000 on the company, and ₹1,000 per day of default on every officer in default, subject to a maximum of ₹1,00,000. This is a penalty rather than an additional filing fee.",
    },
    watchOut:
      "Until INC-20A is filed the company cannot commence business or exercise borrowing powers, which means the bank account is effectively frozen for operations. Non-filing is also a ground for the Registrar to strike the company off.",
    mcaUrl: MCA_COMPANY_FORMS,
    tags: ["one-time", "startup", "subscription money"],
  },
  {
    id: "inc-22",
    code: "INC-22",
    name: "Notice of situation or change of registered office",
    purpose:
      "Notice to the Registrar of the address of the registered office, with proof of ownership or a lease and a recent utility bill.",
    section: "Section 12 · Rule 25",
    sectionRefs: ["12"],
    trigger: "Incorporation, or any change in the registered office address",
    deadline: "Within 30 days of incorporation or of the change",
    category: "Incorporation & setup",
    entity: ["company"],
    lateFee: SLAB,
    watchOut:
      "A shift outside local limits needs a members special resolution first, and a shift between the jurisdictions of two Registrars needs Regional Director approval in INC-23 before INC-22 can be filed.",
    mcaUrl: MCA_COMPANY_FORMS,
    tags: ["event-driven", "registered office"],
  },
  {
    id: "dir-3-kyc",
    code: "DIR-3 KYC",
    name: "KYC of directors and DIN holders",
    purpose:
      "Know-your-customer filing for every individual holding a Director Identification Number, whether or not the DIN is currently in use.",
    section: "Section 153 · Rule 12A",
    sectionRefs: ["153"],
    trigger: "Close of the third financial year of the DIN holder's KYC cycle",
    deadline: "On or before 30 June, once every three financial years",
    category: "Directors & KMP",
    entity: ["company", "llp"],
    lateFee: {
      kind: "flat",
      summary: "₹5,000 flat, and the DIN is deactivated",
      detail:
        "Missing the date deactivates the DIN, which blocks the person from signing any MCA filing. Reactivation requires filing the form with a flat fee of ₹5,000. The fee is per DIN holder, not per company.",
    },
    watchOut:
      "The Amendment Rules of 2025, effective 31 March 2026, moved this from an annual filing due 30 September to one due every three financial years by 30 June. The cycle is anchored to the financial year in which the DIN was allotted, not to the last filing, so filing early does not shift the next due date. A director who sits on five boards still files once, but if that one filing is missed, all five companies lose a signatory.",
    mcaUrl: MCA_COMPANY_FORMS,
    tags: ["triennial", "directors", "DIN", "KYC"],
  },
  {
    id: "dir-12",
    code: "DIR-12",
    name: "Particulars of directors and key managerial personnel",
    purpose:
      "Intimation of the appointment, resignation, or change in designation of a director, manager, CEO, CFO or company secretary.",
    section: "Section 152 · Section 168 · Section 170",
    sectionRefs: ["152", "161", "168", "170"],
    trigger: "Appointment, cessation or change in designation",
    deadline: "Within 30 days of the change",
    category: "Directors & KMP",
    entity: ["company"],
    lateFee: SLAB,
    watchOut:
      "On a resignation the outgoing director may also file DIR-11 in their own name. That is worth doing, because it is the only evidence of the resignation date the director controls if the company never files DIR-12.",
    mcaUrl: MCA_COMPANY_FORMS,
    tags: ["event-driven", "directors", "KMP"],
  },
  {
    id: "aoc-4",
    code: "AOC-4",
    name: "Filing of financial statements",
    purpose:
      "Balance sheet, statement of profit and loss, cash flow statement where applicable, Board report, auditor report and annexures, filed with the Registrar.",
    section: "Section 137 · Rule 12",
    sectionRefs: ["137", "134", "129"],
    trigger: "Adoption of the financial statements at the annual general meeting",
    deadline: "Within 30 days of the AGM",
    category: "Annual filing",
    entity: ["company"],
    lateFee: PER_DAY_100,
    watchOut:
      "Where no AGM is held, the 30 days run from the last date on which the AGM ought to have been held, and the reasons for not holding it must be filed. Failure to file for three continuous financial years disqualifies every director under Section 164(2).",
    mcaUrl: MCA_COMPANY_FORMS,
    tags: ["annual", "financial statements"],
  },
  {
    id: "aoc-4-cfs",
    code: "AOC-4 CFS",
    name: "Filing of consolidated financial statements",
    purpose:
      "Consolidated financial statements, filed in addition to the standalone AOC-4 by a company that has a subsidiary, associate company or joint venture.",
    section: "Section 129(3) · Section 137",
    sectionRefs: ["129", "137"],
    trigger: "Adoption of consolidated financial statements at the AGM",
    deadline: "Within 30 days of the AGM",
    category: "Annual filing",
    entity: ["company"],
    lateFee: PER_DAY_100,
    watchOut:
      "For this purpose subsidiary includes associate companies and joint ventures, so a single minority investment that meets the significant-influence test can pull a company into consolidation for the first time.",
    mcaUrl: MCA_COMPANY_FORMS,
    tags: ["annual", "consolidation", "group"],
  },
  {
    id: "mgt-7",
    code: "MGT-7",
    name: "Annual return",
    purpose:
      "Annual return as at the close of the financial year: capital and shareholding, indebtedness, directors and KMP, meetings held, penalties and compliance particulars.",
    section: "Section 92 · Rule 11",
    sectionRefs: ["92"],
    trigger: "Holding of the annual general meeting",
    deadline: "Within 60 days of the AGM",
    category: "Annual filing",
    entity: ["company"],
    lateFee: PER_DAY_100,
    watchOut:
      "The 60 days run from the AGM date, or from the last date on which the AGM should have been held. MGT-9 has been dispensed with; instead the annual return must be placed on the company website, and the web link disclosed in the Board report.",
    mcaUrl: MCA_COMPANY_FORMS,
    tags: ["annual", "annual return"],
  },
  {
    id: "mgt-7a",
    code: "MGT-7A",
    name: "Abridged annual return",
    purpose:
      "Shorter form of the annual return, available to a One Person Company and to a small company as defined in Section 2(85).",
    section: "Section 92 · Rule 11(1)",
    sectionRefs: ["92", "2(85)"],
    trigger: "Holding of the annual general meeting",
    deadline: "Within 60 days of the AGM",
    category: "Annual filing",
    entity: ["company"],
    lateFee: PER_DAY_100,
    watchOut:
      "Small-company status is tested afresh every year against the paid-up capital and turnover limits, so a growing company can move from MGT-7A to MGT-7 without any deliberate change on its part.",
    mcaUrl: MCA_COMPANY_FORMS,
    tags: ["annual", "small company", "OPC"],
  },
  {
    id: "mgt-14",
    code: "MGT-14",
    name: "Filing of resolutions and agreements",
    purpose:
      "Filing of special resolutions, and of the Board resolutions specified in Section 179(3) read with Rule 8, with the Registrar.",
    section: "Section 117",
    sectionRefs: ["117", "179"],
    trigger: "Passing of the resolution or entering into the agreement",
    deadline: "Within 30 days of passing",
    category: "Deposits & disclosures",
    entity: ["company"],
    lateFee: SLAB,
    watchOut:
      "A private company is exempt from filing the Section 179(3) Board resolutions, but that exemption does not extend to special resolutions, which still have to be filed. The exemption is also lost if the company is in default on its annual filings.",
    mcaUrl: MCA_COMPANY_FORMS,
    tags: ["event-driven", "resolutions"],
  },
  {
    id: "adt-1",
    code: "ADT-1",
    name: "Notice of appointment of auditor",
    purpose:
      "Intimation to the Registrar of the appointment or re-appointment of the statutory auditor, with the written consent and eligibility certificate of the auditor.",
    section: "Section 139(1) · Rule 4(2)",
    sectionRefs: ["139"],
    trigger: "Appointment of the auditor at the annual general meeting",
    deadline: "Within 15 days of the AGM",
    category: "Audit",
    entity: ["company"],
    lateFee: {
      kind: "slab",
      calc: "s139-s157",
      summary: "1× the normal fee up to 15 days, then the usual multiples",
      detail:
        "Forms under Section 139 pay a gentler first fortnight: 1x the normal fee for a delay of up to 15 days, 2x from 16 to 30 days, then 4x, 6x, 10x and 12x as for other forms (Companies (Registration Offices and Fees) Amendment Rules, 2022, from 1 July 2022).",
    },
    watchOut:
      "This is only due in a year in which an appointment is actually made. Where an auditor is appointed for a five-year term, ADT-1 is filed once at the start of the term rather than annually.",
    mcaUrl: MCA_COMPANY_FORMS,
    tags: ["audit", "auditor"],
  },
  {
    id: "adt-3",
    code: "ADT-3",
    name: "Notice of resignation by auditor",
    purpose: "Statement by a resigning auditor of the reasons for the resignation and any other facts relevant to it.",
    section: "Section 140(2) · Rule 8",
    sectionRefs: ["140"],
    trigger: "Resignation of the statutory auditor",
    deadline: "Within 30 days of the resignation",
    category: "Audit",
    entity: ["company"],
    lateFee: SLAB,
    watchOut:
      "Filed by the auditor in their own name, not by the company. The company should still confirm it has been filed, because the casual vacancy cannot be properly regularised until the record is clean.",
    mcaUrl: MCA_COMPANY_FORMS,
    tags: ["audit", "resignation"],
  },
  {
    id: "sh-7",
    code: "SH-7",
    name: "Notice of alteration of share capital",
    purpose:
      "Notice of an increase in authorised share capital, redemption of preference shares, or another alteration of the capital structure.",
    section: "Section 64 · Rule 15",
    sectionRefs: ["64"],
    trigger: "Passing of the resolution altering the share capital",
    deadline: "Within 30 days of the resolution",
    category: "Share capital",
    entity: ["company"],
    lateFee: {
      kind: "slab",
      calc: "not-modelled",
      summary: "Own additional-fee schedule for an increase in nominal capital",
      detail:
        "An increase in nominal share capital is expressly left out of the general additional-fee table of the 2022 amendment, and is charged under its own schedule along with the fee on the increased capital. Price a late SH-7 from the current Fees Rules or the MCA fee calculator rather than from the general multiples.",
    },
    watchOut:
      "Fee is charged on the differential capital, and is entirely separate from stamp duty, which is a state levy at state rates. Budget for both, because the stamp duty is often the larger of the two.",
    mcaUrl: MCA_COMPANY_FORMS,
    tags: ["event-driven", "capital"],
  },
  {
    id: "pas-3",
    code: "PAS-3",
    name: "Return of allotment",
    purpose:
      "Return of allotment of shares, with the complete list of allottees and, where required, the report of the registered valuer.",
    section: "Section 39(4) · Rule 12",
    sectionRefs: ["39", "42"],
    trigger: "Allotment of securities by the Board",
    deadline: "Within 15 days of the allotment",
    category: "Share capital",
    entity: ["company"],
    lateFee: SLAB,
    watchOut:
      "On a private placement the money raised cannot be utilised until PAS-3 is filed. Companies routinely spend subscription money before the filing and only discover the problem at audit.",
    mcaUrl: MCA_COMPANY_FORMS,
    tags: ["event-driven", "allotment", "private placement"],
  },
  {
    id: "pas-6",
    code: "PAS-6",
    name: "Reconciliation of share capital audit report",
    purpose:
      "Half-yearly reconciliation of issued capital with the capital held in dematerialised form, certified by a practising company secretary or chartered accountant.",
    section: "Rule 9A(8), PAS Rules",
    sectionRefs: ["29"],
    trigger: "Close of each half of the financial year",
    deadline: "Within 60 days of each half-year end (broadly 30 May and 29 November)",
    category: "Share capital",
    entity: ["company"],
    lateFee: SLAB,
    watchOut:
      "Applies to unlisted public companies under Rule 9A. The separate demat mandate for private companies under Rule 9B is a different obligation and does not by itself bring PAS-6 with it, so check which rule the company is actually in.",
    mcaUrl: MCA_COMPANY_FORMS,
    tags: ["half-yearly", "demat", "capital"],
  },
  {
    id: "chg-1",
    code: "CHG-1",
    name: "Creation or modification of charge",
    purpose:
      "Registration of a charge created or modified on the property or undertaking of the company, other than a charge on debentures.",
    section: "Section 77 · Section 79",
    sectionRefs: ["77", "79", "85"],
    trigger: "Creation or modification of the charge",
    deadline: "Within 30 days of creation",
    category: "Charges",
    entity: ["company", "llp"],
    lateFee: {
      kind: "ad-valorem",
      summary: "Ad valorem additional fee, on its own schedule",
      detail:
        "Charge forms do not follow the ordinary slab table. The provisos to Section 77 allow limited extended windows beyond the 30 days on payment of ad valorem additional fees, with different rates for a small company or OPC. Once those windows close, only the Central Government can condone the delay under Section 87.",
    },
    watchOut:
      "The 30 days run from the date the charge is created, not from the date the documents reach you. This is one of the few deadlines in the Act with almost no cheap remedy once missed, and an unregistered charge is void against a liquidator and other creditors.",
    mcaUrl: MCA_COMPANY_FORMS,
    tags: ["event-driven", "charges", "lending"],
  },
  {
    id: "chg-4",
    code: "CHG-4",
    name: "Satisfaction of charge",
    purpose: "Intimation to the Registrar that a registered charge has been satisfied in full.",
    section: "Section 82 · Rule 8",
    sectionRefs: ["82", "85"],
    trigger: "Full satisfaction of the registered charge",
    deadline: "Within 30 days of satisfaction",
    category: "Charges",
    entity: ["company", "llp"],
    lateFee: {
      kind: "ad-valorem",
      summary: "Ad valorem additional fee, on its own schedule",
      detail:
        "As with CHG-1, satisfaction filings sit outside the ordinary slab table. Delay beyond the permitted window requires an application to the Central Government under Section 87.",
    },
    watchOut:
      "Chase the lender for the no-dues letter the moment the loan is repaid. The 30 days run from satisfaction, not from the date the letter finally arrives, and an open charge on the register will stall the next diligence.",
    mcaUrl: MCA_COMPANY_FORMS,
    tags: ["event-driven", "charges"],
  },
  {
    id: "dpt-3",
    code: "DPT-3",
    name: "Return of deposits",
    purpose:
      "Annual return of deposits, and of money received that is not treated as a deposit, outstanding as at 31 March, with a certificate from the auditor.",
    section: "Rule 16, Deposit Rules",
    sectionRefs: ["73", "76"],
    trigger: "Close of the financial year on 31 March",
    deadline: "On or before 30 June each year",
    category: "Deposits & disclosures",
    entity: ["company"],
    lateFee: SLAB,
    watchOut:
      "Filed even by a company whose only receipts are exempted ones, such as director loans, share application money pending allotment and bank borrowings. A NIL return is still a filing, and there is no exemption for having nothing to report.",
    mcaUrl: MCA_COMPANY_FORMS,
    tags: ["annual", "deposits"],
  },
  {
    id: "msme-1",
    code: "MSME-1",
    name: "Half-yearly return of outstanding dues to micro and small enterprises",
    purpose:
      "Return of amounts outstanding to micro and small enterprise suppliers where payment exceeds 45 days from the date of acceptance of goods or services.",
    section: "Order under Section 405",
    sectionRefs: ["405"],
    trigger: "Close of each half of the financial year",
    deadline: "31 October for April to September; 30 April for October to March",
    category: "Deposits & disclosures",
    entity: ["company"],
    lateFee: SLAB,
    watchOut:
      "Status is tested on the Udyam registration of the supplier, not on your ledger classification, so the data has to be collected from suppliers. Only micro and small enterprises count; medium enterprises fall outside this return entirely.",
    mcaUrl: MCA_COMPANY_FORMS,
    tags: ["half-yearly", "MSME", "creditors"],
  },
  {
    id: "ben-2",
    code: "BEN-2",
    name: "Return of significant beneficial owners",
    purpose:
      "Return filed by the company on receiving a declaration in BEN-1 from a person who is a significant beneficial owner of its shares.",
    section: "Section 90(4) · Rule 4",
    sectionRefs: ["90"],
    trigger: "Receipt of a declaration in BEN-1",
    deadline: "Within 30 days of receiving BEN-1",
    category: "Deposits & disclosures",
    entity: ["company"],
    lateFee: SLAB,
    watchOut:
      "The register in BEN-3 must be maintained regardless of whether any declaration comes in. Where the company believes someone is a significant beneficial owner and no BEN-1 arrives, it must issue a notice in BEN-4 rather than simply doing nothing.",
    mcaUrl: MCA_COMPANY_FORMS,
    tags: ["event-driven", "beneficial ownership"],
  },
  {
    id: "llp-form-11",
    code: "LLP Form 11",
    name: "Annual return of an LLP",
    purpose:
      "Annual return of the limited liability partnership: partners, contribution received, and changes during the year.",
    section: "Section 35, LLP Act 2008",
    sectionRefs: [],
    trigger: "Close of the financial year on 31 March",
    deadline: "On or before 30 May each year",
    category: "LLP",
    entity: ["llp"],
    lateFee: LLP_SLAB,
    watchOut:
      "Due within 60 days of the close of the financial year, which for an LLP is always 31 March. An LLP cannot choose a different financial year end the way some entities can.",
    mcaUrl: MCA_LLP_FORMS,
    tags: ["annual", "LLP"],
  },
  {
    id: "llp-form-8",
    code: "LLP Form 8",
    name: "Statement of account and solvency",
    purpose:
      "Statement of account and solvency for the financial year, with the declaration of solvency by the designated partners.",
    section: "Section 34(3), LLP Act 2008",
    sectionRefs: [],
    trigger: "Close of the financial year on 31 March",
    deadline: "On or before 30 October each year",
    category: "LLP",
    entity: ["llp"],
    lateFee: LLP_SLAB,
    watchOut:
      "Due within 30 days from the end of six months after the financial year close. An LLP whose turnover exceeds ₹40 lakh, or whose contribution exceeds ₹25 lakh, also needs its accounts audited before this is filed.",
    mcaUrl: MCA_LLP_FORMS,
    tags: ["annual", "LLP", "solvency"],
  },
];

export const formsById = new Map(forms.map((f) => [f.id, f]));

export function formsByCategory(category) {
  return forms.filter((f) => f.category === category);
}
