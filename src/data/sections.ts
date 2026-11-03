/**
 * Companies Act, 2013 — section reference.
 *
 * PARAPHRASED, NOT REPRODUCED. Nothing here is the statutory text. Each entry is
 * a plain-language summary written for practitioners, with a link to the bare
 * section on the official India Code repository.
 *
 * UNVERIFIED SEED DATA — must be reviewed by a practising CA/CS before launch.
 * Penalty figures in particular were substantially revised by the Companies
 * (Amendment) Acts of 2019 and 2020, which converted several offences from fines
 * to penalties and changed the amounts. Check every figure against the current
 * bare Act before relying on it.
 *
 * Flip `legal.dataUnverified` in src/config/site.ts once review is complete.
 */

import { OFFICIAL_SOURCES } from "@/config/site";

export const SECTION_THEMES = [
  "Definitions",
  "Incorporation & office",
  "Accounts & audit",
  "Meetings & governance",
  "Directors",
  "Charges & security",
  "Filings & fees",
] as const;

export type SectionTheme = (typeof SECTION_THEMES)[number];

export type Penalty = {
  /** One line for the list view. */
  summary: string;
  /** Who carries it and how it accrues. */
  detail: string;
};

export type ActSection = {
  id: string;
  /** Bare number as cited, e.g. "137", "2(85)", "10A". Matches McaForm.sectionRefs. */
  number: string;
  title: string;
  theme: SectionTheme;
  /** Plain-language paraphrase. Never the statutory text. */
  summary: string;
  /** The operative points a practitioner needs at hand. */
  keyPoints: string[];
  /** Form ids from src/data/forms.ts. */
  relatedFormIds: string[];
  penalty: Penalty | null;
  officialUrl: string;
  tags: string[];
};

const INDIA_CODE = OFFICIAL_SOURCES.indiaCodeAct;

export const sections: ActSection[] = [
  {
    id: "s-2-85",
    number: "2(85)",
    title: "Small company",
    theme: "Definitions",
    summary:
      "Defines the small company, which is the single most useful status in the Act for a closely held business. A small company is a private company whose paid-up share capital and turnover both stay within the prescribed limits, and which is neither a holding nor a subsidiary company.",
    keyPoints: [
      "Both limbs must be satisfied — capital and turnover — not just one.",
      "A holding company, a subsidiary, a Section 8 company and a company governed by a special Act are excluded however small they are.",
      "Status is tested afresh each financial year, so a company can gain or lose it without doing anything deliberate.",
      "The concessions that follow are substantial: the abridged annual return, two Board meetings a year instead of four, no cash flow statement, no mandatory auditor rotation and halved penalties under Section 446B.",
    ],
    relatedFormIds: ["mgt-7a"],
    penalty: null,
    officialUrl: INDIA_CODE,
    tags: ["small company", "definition", "thresholds", "private company"],
  },
  {
    id: "s-10a",
    number: "10A",
    title: "Commencement of business",
    theme: "Incorporation & office",
    summary:
      "A company incorporated with share capital cannot begin business or borrow until a director files a declaration confirming that every subscriber has actually paid for the shares they agreed to take. The declaration is filed in INC-20A with proof of payment.",
    keyPoints: [
      "The declaration is due within 180 days of incorporation.",
      "Until it is filed the company cannot commence business and cannot exercise borrowing powers, which in practice freezes the bank account for anything operational.",
      "The registered office must also be verified before the declaration can be made.",
      "Persistent non-filing gives the Registrar reasonable cause to believe the company is not carrying on business, which is a ground for striking it off.",
    ],
    relatedFormIds: ["inc-20a"],
    penalty: {
      summary: "₹50,000 on the company; ₹1,000 per day on each officer in default",
      detail:
        "The company is liable to a penalty of ₹50,000. Every officer in default is liable to ₹1,000 for each day the default continues, subject to a maximum of ₹1,00,000.",
    },
    officialUrl: INDIA_CODE,
    tags: ["incorporation", "commencement", "subscription money", "startup"],
  },
  {
    id: "s-12",
    number: "12",
    title: "Registered office of a company",
    theme: "Incorporation & office",
    summary:
      "Every company must have a registered office capable of receiving communications from the fifteenth day of its incorporation, must display its identity outside that office and on its documents, and must tell the Registrar whenever the address changes.",
    keyPoints: [
      "The name, registered address and CIN must be painted or affixed outside every office, and printed on letterheads, invoices, notices and other official publications.",
      "Any change of address is notified in INC-22 within 30 days.",
      "A shift outside local limits needs a members' special resolution; a shift from the jurisdiction of one Registrar to another additionally needs Regional Director approval.",
      "The Registrar may physically verify the registered office, and may initiate striking off if the company is not found there.",
    ],
    relatedFormIds: ["inc-22"],
    penalty: {
      summary: "₹1,000 per day on the company and each officer, capped at ₹1,00,000",
      detail:
        "Default attracts a penalty of ₹1,000 for every day during which the default continues, on the company and on every officer in default, subject to a maximum of ₹1,00,000 each.",
    },
    officialUrl: INDIA_CODE,
    tags: ["registered office", "CIN", "address change"],
  },
  {
    id: "s-77",
    number: "77",
    title: "Duty to register charges",
    theme: "Charges & security",
    summary:
      "A company that creates a charge over its property or undertaking must register it with the Registrar within 30 days. This is one of the least forgiving deadlines in the Act, because the consequence of missing it falls on the lender rather than on the company.",
    keyPoints: [
      "The 30 days run from the date the charge is created, not from the date the documents reach the professional.",
      "The provisos allow limited further windows on payment of ad valorem additional fees, with different rates for a small company or One Person Company.",
      "Once those windows close the only route is an application to the Central Government for condonation of delay under Section 87.",
      "An unregistered charge is void against the liquidator and other creditors — the debt survives, but the security does not.",
    ],
    relatedFormIds: ["chg-1", "chg-4"],
    penalty: {
      summary: "Penalised under Section 86; the security itself is void if unregistered",
      detail:
        "Contravention is penalised under Section 86, on the company and on every officer in default. The commercial consequence is usually worse than the penalty: under Section 77(3) an unregistered charge cannot be taken into account by a liquidator or any other creditor, so the lender drops to unsecured.",
    },
    officialUrl: INDIA_CODE,
    tags: ["charges", "security", "lending", "condonation"],
  },
  {
    id: "s-90",
    number: "90",
    title: "Register of significant beneficial owners",
    theme: "Definitions",
    summary:
      "Looks through the shareholder register to the individuals who really control a company. A person who holds a prescribed threshold of shares, voting rights or distributable dividend indirectly, or who exercises significant influence or control, must declare that interest to the company.",
    keyPoints: [
      "The individual declares in BEN-1; the company files the return in BEN-2 within 30 days of receiving it.",
      "The company maintains a register of significant beneficial owners in BEN-3 whether or not any declaration arrives.",
      "Where the company has reason to believe someone is a significant beneficial owner and no declaration comes, it must issue a notice in BEN-4 rather than doing nothing.",
      "If the notice is ignored the company can apply to the Tribunal for restrictions on the shares concerned.",
    ],
    relatedFormIds: ["ben-2"],
    penalty: {
      summary: "₹1,00,000 plus ₹500 a day on the company, up to ₹5,00,000; ₹25,000 plus ₹200 a day on each officer, up to ₹1,00,000",
      detail:
        "Under Section 90(11), a company that fails to maintain the register of significant beneficial owners, file the return in BEN-2 or allow inspection is liable to a penalty of ₹1,00,000, with a further ₹500 for each day after the first during which the failure continues, subject to a maximum of ₹5,00,000. Every officer in default is liable to ₹25,000, with a further ₹200 for each day after the first, subject to a maximum of ₹1,00,000. Separately, under Section 90(10), an individual who fails to make the BEN-1 declaration is liable to ₹50,000, with a further ₹1,000 a day, subject to a maximum of ₹2,00,000.",
    },
    officialUrl: INDIA_CODE,
    tags: ["beneficial ownership", "SBO", "control", "disclosure"],
  },
  {
    id: "s-92",
    number: "92",
    title: "Annual return",
    theme: "Filings & fees",
    summary:
      "Requires every company to prepare an annual return giving a picture of itself as at the close of the financial year — its capital and shareholding, indebtedness, directors and key managerial personnel, meetings held, and its compliance record.",
    keyPoints: [
      "Filed in MGT-7, or in the abridged MGT-7A by a One Person Company or small company, within 60 days of the annual general meeting.",
      "Where no AGM is held, the 60 days run from the last date on which it should have been held.",
      "The extract in MGT-9 has been dispensed with; instead the annual return must be placed on the company's website, if it has one, and the web link disclosed in the Board's Report.",
      "A listed company, or one crossing the prescribed capital or turnover limits, must also annex a certificate from a company secretary in practice in MGT-8.",
    ],
    relatedFormIds: ["mgt-7", "mgt-7a"],
    penalty: {
      summary: "₹10,000 plus ₹100 for each day of continuing failure, subject to caps",
      detail:
        "The company and every officer in default are liable to a penalty of ₹10,000, with a further ₹100 for each day the failure continues, subject to a maximum of ₹2,00,000 for the company and ₹50,000 for an officer. A company secretary in practice who certifies the return wrongly carries a separate penalty.",
    },
    officialUrl: INDIA_CODE,
    tags: ["annual return", "MGT-7", "annual filing"],
  },
  {
    id: "s-96",
    number: "96",
    title: "Annual general meeting",
    theme: "Meetings & governance",
    summary:
      "Every company other than a One Person Company must hold an annual general meeting each year. The date of that meeting is the anchor from which the year's main filing deadlines are counted, which is why getting it right matters beyond the meeting itself.",
    keyPoints: [
      "The meeting must be held within six months of the close of the financial year.",
      "The first annual general meeting is due within nine months of the close of the first financial year.",
      "Not more than fifteen months may elapse between two annual general meetings.",
      "The Registrar may extend the time by up to three months for special reasons — but never for a first annual general meeting.",
      "AOC-4 is then due within 30 days of the meeting, MGT-7 within 60 days, and ADT-1 within 15 days where an auditor is appointed.",
    ],
    relatedFormIds: ["aoc-4", "mgt-7", "adt-1"],
    penalty: {
      summary: "Fine of up to ₹1,00,000, plus up to ₹5,000 a day, on the company and every officer (Section 99)",
      detail:
        "Under Section 99, if default is made in holding a meeting in accordance with Section 96, or in complying with a Tribunal direction under Section 97 or 98, the company and every officer in default are punishable with a fine which may extend to ₹1,00,000, and in the case of a continuing default, with a further fine which may extend to ₹5,000 for every day during which the default continues. This is a fine on prosecution rather than a penalty adjudicated by the Registrar, so the Section 446B halving does not apply. The Tribunal may also order a meeting to be called under Section 97 or 98.",
    },
    officialUrl: INDIA_CODE,
    tags: ["AGM", "general meeting", "deadline anchor"],
  },
  {
    id: "s-117",
    number: "117",
    title: "Resolutions and agreements to be filed",
    theme: "Filings & fees",
    summary:
      "Certain resolutions must be put on the public record. Every special resolution, and the Board resolutions listed in Section 179(3), must be filed with the Registrar along with the explanatory statement where one applies.",
    keyPoints: [
      "Filed in MGT-14 within 30 days of the resolution being passed.",
      "A private company is exempt from filing the Section 179(3) Board resolutions, but that exemption does not cover special resolutions.",
      "The exemption is conditional — a private company that is in default on its annual filings loses the benefit of it.",
      "Banking-company resolutions on granting loans or guarantees in the ordinary course of business are outside the requirement.",
    ],
    relatedFormIds: ["mgt-14"],
    penalty: {
      summary: "₹10,000 plus ₹100 a day on the company, up to ₹2,00,000; the same on each officer, up to ₹50,000",
      detail:
        "Under Section 117(2), the company is liable to a penalty of ₹10,000, with a further ₹100 for each day after the first during which the failure continues, subject to a maximum of ₹2,00,000. Every officer in default, including a liquidator where applicable, is liable to ₹10,000, with a further ₹100 for each day after the first, subject to a maximum of ₹50,000.",
    },
    officialUrl: INDIA_CODE,
    tags: ["resolutions", "MGT-14", "special resolution"],
  },
  {
    id: "s-129",
    number: "129",
    title: "Financial statements",
    theme: "Accounts & audit",
    summary:
      "Financial statements must give a true and fair view of the state of affairs of the company, comply with the notified accounting standards, and be in the form set out in Schedule III. A company with a subsidiary, associate or joint venture must also prepare consolidated statements.",
    keyPoints: [
      "For this purpose 'subsidiary' includes an associate company and a joint venture, so a single significant minority investment can trigger consolidation.",
      "The consolidated statements are laid before the members and filed in the same way as the standalone ones, using AOC-4 CFS.",
      "A separate statement in AOC-1 giving the salient features of each subsidiary, associate and joint venture is annexed.",
      "A One Person Company, small company or dormant company need not include a cash flow statement.",
    ],
    relatedFormIds: ["aoc-4", "aoc-4-cfs"],
    penalty: {
      summary: "Imprisonment or fine on the managing director, whole-time director and CFO",
      detail:
        "Where a company contravenes the section, the managing director, the whole-time director in charge of finance, the chief financial officer, or any other person charged by the Board with compliance, is punishable with imprisonment or with a fine, or with both. This is one of the provisions that still carries a custodial element.",
    },
    officialUrl: INDIA_CODE,
    tags: ["financial statements", "consolidation", "Schedule III", "accounting standards"],
  },
  {
    id: "s-134",
    number: "134",
    title: "Board's Report and signing of financial statements",
    theme: "Accounts & audit",
    summary:
      "Governs who signs the financial statements and what the Board must report to members alongside them. The Board's Report is the main narrative disclosure document in the Act, and its contents are prescribed rather than left to judgement.",
    keyPoints: [
      "The financial statements are approved by the Board and signed on its behalf before being given to the auditor for report.",
      "The Board's Report carries the directors' responsibility statement, the web address of the annual return, particulars of loans and investments, related party transactions and details of Board meetings held.",
      "Where a secretarial audit report or a CSR annexure applies, it is annexed to the Board's Report, and the Board must explain every qualification or adverse remark in it.",
      "A One Person Company and a small company file an abridged Board's Report covering the prescribed items only.",
    ],
    relatedFormIds: ["aoc-4"],
    penalty: {
      summary: "₹3,00,000 on the company; ₹50,000 on each officer in default",
      detail:
        "Contravention attracts a penalty of ₹3,00,000 on the company and ₹50,000 on every officer in default. Because the Board's Report has many prescribed contents, an omission here is one of the most commonly reported defaults.",
    },
    officialUrl: INDIA_CODE,
    tags: ["Board report", "directors responsibility statement", "disclosure"],
  },
  {
    id: "s-137",
    number: "137",
    title: "Filing of financial statements with the Registrar",
    theme: "Filings & fees",
    summary:
      "Once the financial statements have been adopted at the annual general meeting they must be filed with the Registrar, together with all the documents required to be attached to them.",
    keyPoints: [
      "Filed in AOC-4 within 30 days of the annual general meeting, with AOC-4 CFS where consolidated statements apply.",
      "Where the statements are not adopted at the meeting, the unadopted statements are filed provisionally and the adopted ones filed later.",
      "Where no annual general meeting is held, the statements are filed within 30 days of the last date on which it should have been held, together with the reasons for not holding it.",
      "Failure to file for three continuous financial years disqualifies every director of that company under Section 164(2).",
    ],
    relatedFormIds: ["aoc-4", "aoc-4-cfs"],
    penalty: {
      summary: "₹10,000 plus ₹100 a day on the company, up to ₹2,00,000; the same on each officer, up to ₹50,000",
      detail:
        "Under Section 137(3), the company is liable to a penalty of ₹10,000, with a further ₹100 for each day after the first during which the failure continues, subject to a maximum of ₹2,00,000. The managing director and the chief financial officer, or in their absence any other director charged by the Board (and, failing that, all the directors), are liable to ₹10,000, with a further ₹100 a day, subject to a maximum of ₹50,000. This is on top of the ₹100 per day additional filing fee under Section 403.",
    },
    officialUrl: INDIA_CODE,
    tags: ["AOC-4", "financial statements", "annual filing"],
  },
  {
    id: "s-139",
    number: "139",
    title: "Appointment of auditors",
    theme: "Accounts & audit",
    summary:
      "Sets out who appoints the statutory auditor and for how long. The first auditor is appointed by the Board shortly after incorporation; thereafter the members appoint an auditor to hold office for a five-year term.",
    keyPoints: [
      "The first auditor is appointed by the Board within 30 days of incorporation; if the Board fails, the members appoint within 90 days.",
      "Subsequent appointments are made by the members at an annual general meeting, for a term of five years, and intimated in ADT-1 within 15 days.",
      "Prescribed classes of company must rotate: an individual auditor may serve one term of five years, and an audit firm two consecutive terms, followed by a five-year cooling-off.",
      "Tenure served before the rotation provisions came into force counts towards the limit.",
    ],
    relatedFormIds: ["adt-1", "adt-3"],
    penalty: {
      summary: "Fine of ₹25,000 to ₹5,00,000 on the company; ₹10,000 to ₹1,00,000 on each officer (Section 147)",
      detail:
        "Under Section 147(1), contravention of Sections 139 to 146 makes the company punishable with a fine of not less than ₹25,000, which may extend to ₹5,00,000, and every officer in default with a fine of not less than ₹10,000, which may extend to ₹1,00,000. An auditor who contravenes the audit provisions faces a fine of ₹25,000 to ₹5,00,000 under Section 147(2), and where the contravention is knowing or wilful, with intent to deceive, imprisonment of up to one year and a fine of ₹50,000 to ₹25,00,000, with liability to refund remuneration and pay damages.",
    },
    officialUrl: INDIA_CODE,
    tags: ["auditor", "appointment", "rotation", "ADT-1"],
  },
  {
    id: "s-164",
    number: "164",
    title: "Disqualifications for appointment of director",
    theme: "Directors",
    summary:
      "Lists the circumstances in which a person cannot be appointed or continue as a director. The limb that catches ordinary companies is not fraud or insolvency but simple non-filing.",
    keyPoints: [
      "A director of a company that has failed to file financial statements or annual returns for three continuous financial years is disqualified for five years.",
      "The disqualification attaches to the person, so it blocks them from being appointed in any other company as well.",
      "Other limbs cover unsound mind, undischarged insolvency, conviction for an offence, and failure to pay calls.",
      "Every director gives an annual declaration of non-disqualification in DIR-8, which is why that declaration is taken at the first Board meeting of each year.",
    ],
    relatedFormIds: ["aoc-4", "mgt-7", "dir-12"],
    penalty: {
      summary: "Disqualification for five years, not a monetary penalty",
      detail:
        "The consequence is disqualification rather than a fine: the person vacates office and cannot be reappointed for five years. A person who acts as a director while disqualified is separately liable under Section 172, and the vacated office must be reported in DIR-12.",
    },
    officialUrl: INDIA_CODE,
    tags: ["disqualification", "directors", "DIR-8", "non-filing"],
  },
  {
    id: "s-173",
    number: "173",
    title: "Meetings of the Board",
    theme: "Meetings & governance",
    summary:
      "Sets the minimum rhythm of Board meetings and the notice required for them. The rule that trips companies up is not the number of meetings but the maximum gap allowed between two of them.",
    keyPoints: [
      "A company must hold at least four Board meetings a year, with not more than 120 days between two consecutive meetings.",
      "A One Person Company, small company or dormant company need hold only two meetings a year, one in each half, with at least 90 days between them.",
      "At least seven days' notice in writing must be given to every director; a meeting on shorter notice is valid only if an independent director is present, where the company has independent directors.",
      "Directors may participate by video conferencing or other audio-visual means, except for the items excluded by the rules.",
    ],
    relatedFormIds: ["mgt-14"],
    penalty: {
      summary: "₹25,000 on every officer whose duty it was to give notice",
      detail:
        "Every officer of the company whose duty it is to give notice of the meeting and who fails to do so is liable to a penalty of ₹25,000. The four-meeting and 120-day requirements are also a governance failure reportable in the annual return and by the secretarial auditor.",
    },
    officialUrl: INDIA_CODE,
    tags: ["Board meeting", "120 days", "notice", "quorum"],
  },
  {
    id: "s-403",
    number: "403",
    title: "Fee for filing, and additional fees",
    theme: "Filings & fees",
    summary:
      "Sets the machinery for filing fees and for what happens when a document is filed late. It is the section behind every late-fee figure quoted elsewhere in this toolkit.",
    keyPoints: [
      "Documents may be filed after the prescribed time on payment of additional fee, which is charged as a multiple of the normal fee for most forms.",
      "For the annual return under Section 92 and the financial statements under Section 137, the additional fee is a flat ₹100 for each day of delay, with no upper limit.",
      "The normal fee itself is calculated on the nominal share capital of the company, in bands.",
      "Charge documents under Section 77 sit outside the ordinary slab and carry their own ad valorem schedule.",
    ],
    relatedFormIds: ["aoc-4", "mgt-7", "mgt-14", "dir-12"],
    penalty: {
      summary: "Higher additional fee, and the default remains actionable",
      detail:
        "Paying the additional fee regularises the filing but does not cure the underlying default: the penalty provisions in the substantive sections continue to apply, and a company that files late is still a company that filed late for the purposes of Section 164(2) and the officer-in-default provisions.",
    },
    officialUrl: INDIA_CODE,
    tags: ["fees", "additional fee", "late filing", "penalty"],
  },
];

export const sectionsByNumber = new Map(sections.map((s) => [s.number, s]));

/** Returns the section entry for a bare number cited on a form, if one exists. */
export function findSection(number: string) {
  return sectionsByNumber.get(number) ?? null;
}
