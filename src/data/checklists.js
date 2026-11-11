import { Briefcase, Flag, LayoutGrid, Shield, Users, Zap } from "lucide-react";

export const checklists = [
  {
    id: "private-annual",
    icon: LayoutGrid,
    pill: "Pvt Ltd",
    title: "Private Limited Company — Annual Compliance",
    description: "Recurring secretarial and ROC compliances every private company must complete each financial year.",
    items: [
      {
        id: "board-cadence",
        text: "Board meetings held on cadence",
        detail: "At least four in the year, with no more than 120 days between two consecutive meetings.",
      },
      {
        id: "mbp1-dir8",
        text: "Disclosure of interest and non-disqualification taken",
        detail: "MBP-1 and DIR-8 from every director at the first Board meeting of the year.",
      },
      {
        id: "financials-approved",
        text: "Financial statements approved and signed",
        detail: "By the Board, before being handed to the auditor for report.",
      },
      {
        id: "board-report",
        text: "Board's Report finalised",
        detail:
          "With every Section 134(3) disclosure, the annual return web link, and the CSR annexure where Section 135 applies.",
      },
      {
        id: "agm-held",
        text: "Annual General Meeting held",
        detail: "Within six months of the financial year end, on at least 21 clear days' notice.",
      },
      {
        id: "adt-1",
        text: "ADT-1 filed",
        detail: "Within 15 days of the AGM, only in a year an auditor is appointed or re-appointed.",
      },
      {
        id: "aoc-4",
        text: "AOC-4 (or AOC-4 CFS) filed",
        detail: "Within 30 days of the AGM. CFS where the company has a subsidiary, associate or joint venture.",
      },
      {
        id: "mgt-7",
        text: "Annual return filed",
        detail: "MGT-7A if the company is small or an OPC, otherwise MGT-7, within 60 days of the AGM.",
      },
      {
        id: "dpt-3",
        text: "DPT-3 filed",
        detail: "Return of deposits, including exempted receipts, by 30 June. A NIL return is still a filing.",
      },
      {
        id: "dir-3-kyc",
        text: "DIR-3 KYC current for every director",
        detail:
          "Triennial cycle, due 30 June — check each director's individual cycle rather than assuming a single date for the company.",
      },
      {
        id: "msme-1",
        text: "MSME-1 filed if applicable",
        detail: "Where payments to micro or small suppliers are outstanding beyond 45 days, for each half-year.",
      },
      {
        id: "mgt-14",
        text: "MGT-14 filed for resolutions requiring it",
        detail:
          "Every special resolution, and the Section 179(3) Board resolutions unless the private-company exemption applies.",
      },
      {
        id: "registers",
        text: "Statutory registers updated",
        detail: "Members, directors and KMP, charges, and the register of significant beneficial owners.",
      },
      {
        id: "minutes",
        text: "Minutes entered and signed",
        detail: "Within 30 days of each Board meeting and the AGM.",
      },
    ],
  },
  {
    id: "post-incorporation",
    icon: Zap,
    pill: "New company",
    title: "Post-Incorporation Checklist (first 180 days)",
    description:
      "Critical one-time tasks after a new company is incorporated — missing these risks penalties and strike-off.",
    items: [
      {
        id: "first-board",
        text: "First Board meeting held",
        detail: "Within 30 days of incorporation, notice to every director at the registered address.",
      },
      {
        id: "first-auditor",
        text: "First statutory auditor appointed",
        detail: "By the Board within 30 days; by the members within 90 days if the Board fails to.",
      },
      {
        id: "bank-account",
        text: "Bank account opened and subscription money collected",
        detail: "Every subscriber pays for the shares actually subscribed, into the company's account.",
      },
      {
        id: "inc-20a",
        text: "INC-20A filed",
        detail:
          "Within 180 days of incorporation, with proof of payment. Cannot commence business or borrow until this is filed.",
      },
      {
        id: "inc-22-verify",
        text: "Registered office verified",
        detail: "File INC-22 within 30 days if the office was not declared at incorporation.",
      },
      {
        id: "name-display",
        text: "Name, address and CIN displayed",
        detail: "Outside every office in legible letters, and printed on letterheads, invoices and notices.",
      },
      {
        id: "share-certificates",
        text: "Share certificates issued",
        detail: "To every subscriber within two months of incorporation.",
      },
      {
        id: "pan-tan-gst",
        text: "PAN, TAN and GST registration in hand",
        detail:
          "PAN/TAN are usually issued with the incorporation certificate; apply for GST if turnover or the nature of business requires it.",
      },
      {
        id: "registers-opened",
        text: "Statutory registers and minutes books opened",
        detail: "Register of members, register of directors and KMP, register of charges.",
      },
      {
        id: "mbp1-dir8-first",
        text: "MBP-1 and DIR-8 taken from every first director",
        detail: "At the first Board meeting, before any interested transaction is considered.",
      },
      {
        id: "dir-12-first",
        text: "DIR-12 filed for every appointment",
        detail: "Within 30 days of appointment, for any director appointed after incorporation.",
      },
    ],
  },
  {
    id: "opc-annual",
    icon: Users,
    pill: "OPC",
    title: "One Person Company (OPC) — Annual Compliance",
    description: "Lighter compliance regime applicable to One Person Companies.",
    items: [
      {
        id: "financials-approved-opc",
        text: "Financial statements approved and signed",
        detail: "By the sole director; the Board's Report may be in the abridged form.",
      },
      {
        id: "aoc-4-opc",
        text: "AOC-4 filed",
        detail:
          "Within 180 days of the financial year end — an OPC holds no AGM, so this does not run from a meeting date.",
      },
      {
        id: "mgt-7a-opc",
        text: "Abridged annual return filed",
        detail: "MGT-7A, within 60 days of the date the AGM would otherwise have been due.",
      },
      {
        id: "dpt-3-opc",
        text: "DPT-3 filed",
        detail: "By 30 June, including exempted receipts. A NIL return is still a filing.",
      },
      { id: "dir-3-kyc-opc", text: "DIR-3 KYC current for the sole director", detail: "Triennial cycle, due 30 June." },
      {
        id: "board-meetings-opc",
        text: "Board meeting cadence met",
        detail:
          "At least two meetings a year, one in each half, at least 90 days apart — or a single-director resolution recorded in the minutes book.",
      },
      {
        id: "registers-opc",
        text: "Statutory registers updated",
        detail: "Register of members and register of directors, even with a single member and director.",
      },
      {
        id: "nominee-opc",
        text: "Nominee's consent reviewed",
        detail: "INC-3 updated if the nominee named for the sole member has changed.",
      },
    ],
  },
  {
    id: "llp-annual",
    icon: Briefcase,
    pill: "LLP",
    title: "LLP — Annual Compliance",
    description: "Annual filings every Limited Liability Partnership must complete.",
    items: [
      {
        id: "sas-approved",
        text: "Statement of Account and Solvency approved",
        detail: "By the designated partners, before Form 8 is filed.",
      },
      {
        id: "form-8",
        text: "LLP Form 8 filed",
        detail: "Within 30 days from six months after the financial year close — by 30 October.",
      },
      {
        id: "form-11",
        text: "LLP Form 11 filed",
        detail: "Annual return, within 60 days of the financial year close — by 30 May.",
      },
      {
        id: "llp-audit",
        text: "Accounts audited if required",
        detail: "Mandatory where turnover exceeds ₹40 lakh or contribution exceeds ₹25 lakh.",
      },
      {
        id: "dir-3-kyc-llp",
        text: "DIR-3 KYC current for every designated partner",
        detail: "Triennial cycle, due 30 June, for each DPIN holder.",
      },
      {
        id: "llp-itr",
        text: "Income tax return filed for the LLP",
        detail: "An LLP files its own return regardless of the partners' individual filings.",
      },
      {
        id: "llp-agreement",
        text: "LLP agreement changes filed",
        detail: "Any change in partners or contribution ratio reflected in the agreement and filed in Form 3/4.",
      },
      {
        id: "llp-registers",
        text: "LLP records updated",
        detail: "Partner details, contribution and any changes during the year.",
      },
    ],
  },
  {
    id: "section8-annual",
    icon: Shield,
    pill: "Section 8",
    title: "Section 8 Company — Annual Compliance",
    description: "Compliances for companies formed for charitable or not-for-profit objects.",
    items: [
      {
        id: "board-s8",
        text: "Board meetings held",
        detail: "On the cadence applicable to the company's size and class.",
      },
      { id: "agm-s8", text: "Annual General Meeting held", detail: "Within six months of the financial year end." },
      {
        id: "financials-s8",
        text: "Financial statements and Board's Report approved",
        detail: "Including disclosures on the application of income towards the stated charitable objects.",
      },
      { id: "aoc-4-s8", text: "AOC-4 filed", detail: "Within 30 days of the AGM." },
      {
        id: "mgt-7-s8",
        text: "Annual return filed",
        detail: "MGT-7 or MGT-7A depending on size, within 60 days of the AGM.",
      },
      { id: "dir-3-kyc-s8", text: "DIR-3 KYC current for every director", detail: "Triennial cycle, due 30 June." },
      {
        id: "licence-conditions",
        text: "Section 8 licence conditions met",
        detail:
          "No dividend distributed, income applied only towards the stated objects, and the licence itself not breached.",
      },
      {
        id: "donor-records",
        text: "Donor and grant records updated",
        detail: "Alongside the ordinary statutory registers.",
      },
    ],
  },
  {
    id: "event-based",
    icon: Flag,
    pill: "All",
    title: "Common Event-Based Compliances",
    description: "Triggered when a specific corporate event happens — file within the prescribed window.",
    items: [
      { id: "event-office", text: "Registered office changed", detail: "INC-22 within 30 days of the change." },
      {
        id: "event-director",
        text: "Director or KMP appointed, resigned or redesignated",
        detail: "DIR-12 within 30 days of the change.",
      },
      { id: "event-allotment", text: "Shares allotted", detail: "PAS-3 within 15 days of the allotment." },
      { id: "event-capital", text: "Share capital altered", detail: "SH-7 within 30 days of the resolution." },
      {
        id: "event-charge-created",
        text: "Charge created or modified",
        detail: "CHG-1 within 30 days of creation — one of the least forgiving deadlines in the Act.",
      },
      { id: "event-charge-satisfied", text: "Charge satisfied", detail: "CHG-4 within 30 days of satisfaction." },
      {
        id: "event-resolution",
        text: "Special resolution or Section 179(3) Board resolution passed",
        detail: "MGT-14 within 30 days of passing.",
      },
      {
        id: "event-auditor-resigns",
        text: "Auditor resigns",
        detail: "ADT-3 within 30 days, filed by the auditor rather than the company.",
      },
    ],
  },
];
