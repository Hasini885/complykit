export const ENTITY_TYPE_CARDS = [
  {
    id: "private",
    title: "Private Limited Company",
    popular: true,
    description: "Startups raising equity or VC funding, scalable businesses.",
    statPills: ["2 to 200 members", "Min 2 directors"],
  },
  {
    id: "opc",
    title: "One Person Company",
    popular: false,
    description: "Solo founders wanting a corporate structure with limited liability.",
    statPills: ["1 member (with 1 nominee)", "Min 1 director"],
  },
  {
    id: "llp",
    title: "Limited Liability Partnership",
    popular: true,
    description: "Professional firms, service businesses, low-compliance ventures.",
    statPills: ["Min 2 partners", "Min 2 designated partners"],
  },
  {
    id: "public",
    title: "Public Limited Company",
    popular: false,
    description: "Large businesses, those planning to list or raise public capital.",
    statPills: ["Min 7 members", "Min 3 directors"],
  },
  {
    id: "section8",
    title: "Section 8 Company",
    popular: false,
    description: "Not-for-profit / charitable objects (NGO with corporate form).",
    statPills: ["2 (Pvt) / 7 (Public) members", "Min 2 / 3 directors"],
  },
];

export const COMPARISON_ROWS = [
  {
    entityId: "private",
    entity: "Private Limited Company",
    members: "2 to 200",
    directors: "Min 2",
    minCapital: "No minimum",
    statutoryAudit: "Mandatory (statutory)",
    bestFor: "Startups raising equity/VC funding, scalable businesses.",
  },
  {
    entityId: "opc",
    entity: "One Person Company",
    members: "1 (with 1 nominee)",
    directors: "Min 1",
    minCapital: "No minimum",
    statutoryAudit: "Mandatory (statutory)",
    bestFor: "Solo founders wanting a corporate structure with limited liability.",
  },
  {
    entityId: "llp",
    entity: "Limited Liability Partnership",
    members: "Min 2 partners",
    directors: "Min 2 designated partners",
    minCapital: "No minimum",
    statutoryAudit: "Only if turnover > ₹40L / contribution > ₹25L",
    bestFor: "Professional firms, service businesses, low-compliance ventures.",
  },
  {
    entityId: "public",
    entity: "Public Limited Company",
    members: "Min 7 (no upper limit)",
    directors: "Min 3",
    minCapital: "No minimum",
    statutoryAudit: "Mandatory (statutory)",
    bestFor: "Large businesses, those planning to list or raise public capital.",
  },
  {
    entityId: "section8",
    entity: "Section 8 Company",
    members: "2 (Pvt) / 7 (Public)",
    directors: "Min 2 / 3",
    minCapital: "No minimum",
    statutoryAudit: "Mandatory (statutory)",
    bestFor: "Not-for-profit / charitable objects (NGO with corporate form).",
  },
];

export const SPICE_PLUS_STEPS = [
  {
    id: "dsc",
    title: "Obtain Digital Signature Certificates (DSC)",
    detail:
      "Class-3 DSC for all proposed directors and subscribers — required to e-sign every MCA form in the process, including SPICe+ itself.",
  },
  {
    id: "name",
    title: "Reserve the name",
    detail:
      "Part A of SPICe+ checks the proposed name against existing companies, LLPs and trademarks, and allows up to two proposed names. Approval is provisional — the name can still be objected to at incorporation if it conflicts with an existing mark.",
  },
  {
    id: "part-b",
    title: "Fill SPICe+ Part B",
    detail:
      "The incorporation details: registered office address, subscriber and director particulars, capital structure and shareholding, and the main business activity by NIC code.",
  },
  {
    id: "e-moa-aoa",
    title: "Prepare e-MOA (INC-33) and e-AOA (INC-34)",
    detail:
      "The Memorandum and Articles of Association, filed as linked e-forms and e-signed by every subscriber to the memorandum — no physical signing or notarisation for a resident subscriber.",
  },
  {
    id: "agile-pro",
    title: "File AGILE-PRO-S (INC-35)",
    detail:
      "One linked form that applies for GSTIN, an EPFO code, an ESIC code, a Profession Tax registration (in the states that levy one) and a bank account opening request, all alongside the incorporation itself.",
  },
  {
    id: "attachments",
    title: "Attach documents",
    detail:
      "Identity and address proof of every subscriber and director, proof of the registered office, a NOC from the property owner, DIR-2 consent to act as director, and the INC-9 declaration by subscribers and first directors.",
  },
  {
    id: "fees",
    title: "Pay fees and stamp duty",
    detail:
      "SPICe+ collects the ROC incorporation fee and, for most states, the state stamp duty on the memorandum, articles and share certificates in a single integrated payment.",
  },
  {
    id: "coi",
    title: "Certificate of Incorporation issued",
    detail:
      "The Registrar issues the Certificate of Incorporation with the company's CIN. PAN and TAN are allotted automatically as part of the same certificate — there is no separate PAN/TAN application.",
  },
  {
    id: "post",
    title: "Post-incorporation steps",
    detail:
      "Open the bank account, file INC-20A within 180 days before commencing business, hold the first Board meeting within 30 days, appoint the first auditor within 30 days, and issue share certificates within two months.",
  },
];

export const FILLIP_STEPS = [
  {
    id: "dsc",
    title: "Obtain Digital Signature Certificates (DSC)",
    detail:
      "Class-3 DSC for all proposed designated partners — required to e-sign FiLLiP and the forms that follow it.",
  },
  {
    id: "name",
    title: "Reserve the name",
    detail: "Via RUN-LLP, checked against existing companies, LLPs and trademarks, with up to two proposed names.",
  },
  {
    id: "fillip",
    title: "Fill FiLLiP",
    detail:
      "The single incorporation form for an LLP: partner and designated-partner particulars, registered office, and the proposed contribution amount.",
  },
  {
    id: "agreement-draft",
    title: "Draft the LLP Agreement",
    detail:
      "Unlike a company's e-MOA/e-AOA, the LLP Agreement is not filed with FiLLiP itself — it is drafted now but filed separately, after incorporation, in Form 3. Get it in near-final form here to avoid a late Form 3.",
  },
  {
    id: "attachments",
    title: "Submit FiLLiP with its attachments",
    detail:
      "Identity and address proof of every partner, proof of the registered office, a NOC from the property owner, and the subscriber sheet with consent to act as a designated partner. FiLLiP does not bundle GST/EPFO/ESIC registration the way AGILE-PRO-S does for a company — those are applied for separately.",
  },
  {
    id: "docs",
    title: "Attach the remaining incorporation documents",
    detail:
      "Consent of each designated partner, proof of the proposed contribution, and any subscriber declarations the form calls for.",
  },
  {
    id: "fees",
    title: "Pay fees and stamp duty",
    detail:
      "The ROC fee for an LLP is scaled to the contribution amount rather than a share-capital slab, plus the state stamp duty on the LLP Agreement once it is filed in Form 3.",
  },
  {
    id: "coi",
    title: "Certificate of Incorporation issued",
    detail:
      "The Registrar issues the Certificate of Incorporation with the LLP's LLPIN. PAN and TAN are allotted alongside it through the same integrated process.",
  },
  {
    id: "post",
    title: "Post-incorporation steps",
    detail:
      "File the LLP Agreement in Form 3 within 30 days of incorporation, open the bank account, and apply separately for GST or any other registration the business needs.",
  },
];

export const DOCUMENT_COLUMNS = [
  {
    id: "director",
    title: "For each director / partner",
    items: [
      "PAN card (mandatory for Indian nationals)",
      "Aadhaar card",
      "Passport-size photograph",
      "Identity proof (Voter ID / Passport / Driving Licence)",
      "Address proof (bank statement / utility bill, 2 months old or less)",
      "Email ID and mobile number (for OTP verification)",
      "Passport (mandatory for foreign nationals — notarised or apostilled)",
    ],
  },
  {
    id: "office",
    title: "For registered office",
    items: [
      "Latest utility bill of the registered office (2 months old or less)",
      "No-Objection Certificate (NOC) from the property owner",
      "Rent or lease agreement (if rented)",
      "Sale deed or ownership proof (if owned)",
    ],
  },
  {
    id: "common",
    title: "Common / declarations",
    items: [
      "Digital Signature Certificate (DSC) of subscribers",
      "DIR-2 — consent to act as director",
      "INC-9 — declaration by subscribers and first directors",
      "Proposed name(s) with significance",
      "Capital structure and shareholding ratio",
      "NIC code of the main business activity",
    ],
  },
];
