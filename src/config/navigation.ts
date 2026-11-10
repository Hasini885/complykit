import { Contact, FilePen, House, Landmark, LayoutGrid, Users, type LucideIcon } from "lucide-react";

/**
 * Site navigation.
 *
 * Single source of truth for the top bar, the mobile menu, the home page cards and the command
 * palette's "Pages" group, so a route cannot appear in one and not the others.
 *
 * `badge` is purely a visual flag — NEW and LIVE deliberately share one style.
 *
 * The Compliance Calendar, Beyond-ROC Calendar, What Applies To Me?, Forms &
 * Returns, calculators, checklists and the Incorporation Toolkit were taken
 * out of the menu at the owner's request. Directors can be entered with each
 * company in Company Master Data as well as in the Director Master. Their pages still exist and stay reachable by URL and from
 * links elsewhere; add them back here to restore them to the menu.
 */

export type NavBadge = "NEW" | "LIVE";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  badge?: NavBadge;
  /** Used by the home page cards, the nav menus and the command palette. */
  description: string;
};

export type NavSection = {
  label: string;
  items: NavItem[];
};

export const NAV_SECTIONS: NavSection[] = [
  {
    label: "Overview",
    items: [
      {
        title: "Dashboard",
        href: "/dashboard",
        icon: House,
        description: "Portfolio-wide position and what falls due across every client.",
      },
      {
        title: "Company Master Data",
        href: "/portfolio",
        icon: LayoutGrid,
        badge: "NEW",
        description: "Every company with its mobile, directors and reference, and a compliance health indicator.",
      },
      {
        title: "Director Master",
        href: "/directors",
        icon: Users,
        badge: "NEW",
        description: "Each director once, by DIN, with every company they sit on and their DIR-3 KYC.",
      },
    ],
  },
  {
    label: "Compliance",
    items: [
      {
        title: "Consultant Master",
        href: "/consultants",
        icon: Contact,
        badge: "NEW",
        description: "Consultants with their mobile numbers, and the companies that name each one as their reference.",
      },
      {
        title: "Document Generator",
        href: "/documents",
        icon: FilePen,
        badge: "NEW",
        description: "Notices, resolutions, DIR-2, DIR-8, MBP-1 and letters, pre-filled and downloaded as Word or PDF.",
      },
      {
        title: "Bank Statement to Excel",
        href: "/bank-statement",
        icon: Landmark,
        badge: "NEW",
        description: "Convert a bank statement PDF to Excel, tag each transaction to a ledger and download.",
      },
    ],
  },
];

/** Flat list, for the command palette and the home page. */
export const allNavItems: NavItem[] = NAV_SECTIONS.flatMap((s) => s.items);

/** Shown in the context bar under the top navigation. */
export const LAW_UPDATED = "October 2026";
