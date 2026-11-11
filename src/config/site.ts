/**
 * Single source of truth for branding, nav and legal copy.
 *
 * REPLACE BEFORE LAUNCH:
 *  - `brand.agency`      -> your agency / brand name
 *  - `brand.agencyUrl`   -> your site
 *  - `legal.disclaimer`  -> your exact approved wording
 */

export const site = {
  name: "ComplyKit",
  edition: "Professional Edition",
  tagline: "Companies Act, 2013 compliance reference for CA, CS and finance teams in India",
  description:
    "A free reference desk for Indian corporate compliance: MCA e-forms, key Companies Act sections, statutory due dates and calculators. Searchable, fast, and built for practitioners.",
  url: "https://cacompliancetool.com",
  /** Shown on the Privacy Policy and Terms pages (Google requires a contact). */
  contactEmail: "hasinisaimaram@gmail.com",
} as const;

export const brand = {
  // TODO(client): replace with the real agency name + URL.
  agency: "[YOUR AGENCY]",
  agencyUrl: "#",
} as const;

export const legal = {
  // TODO(client): replace with your exact approved wording.
  disclaimer:
    "ComplyKit is a reference tool provided for general information and educational purposes only. It does not constitute legal, financial, secretarial or professional advice, and no professional relationship is created by its use. Statutory thresholds, fees, forms and due dates are amended frequently by notification, circular and general exemption. Always verify against the bare Act, the relevant Rules and the official MCA portal before filing or advising.",
  sourceNote:
    "Form particulars are compiled from the Ministry of Corporate Affairs (mca.gov.in) and the Companies Act, 2013.",
  // When true, shows the "Pre-launch: seeded data is unverified" banner on every
  // page and a matching line in printed reports. Turned off at the owner's request.
  dataUnverified: false,
} as const;

/* Navigation moved to src/config/navigation.ts, which owns icons and badges. */

export const MCA_URL = "https://www.mca.gov.in";

/**
 * Official sources for statutory text.
 *
 * NOT MACHINE-VERIFIED: both mca.gov.in and indiacode.nic.in block automated
 * clients (403/404 to anything that is not a real browser), so these could not
 * be checked programmatically. Open both in a browser before launch.
 *
 * India Code uses opaque per-section query ids that cannot be derived, so every
 * section links to the Act landing page rather than a per-section deep link.
 */
export const OFFICIAL_SOURCES = {
  /** India Code (Govt. of India) — Companies Act, 2013 landing page. */
  indiaCodeAct: "https://www.indiacode.nic.in/handle/123456789/2114",
  /** MCA acts & rules e-book library. */
  mcaActsRules:
    "https://www.mca.gov.in/content/mca/global/en/acts-rules/ebooks/acts.html",
} as const;
