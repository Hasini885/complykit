import {
  BookOpen,
  ClipboardList,
  Contact,
  FilePen,
  House,
  Landmark,
  LayoutGrid,
  ListChecks,
  ReceiptIndianRupee,
  ShieldCheck,
  Users,
} from "lucide-react";

/**
 * The five tools on the main dashboard. There is no menu across the whole
 * app: the top bar shows only the items of the tool that is open (MCA shows
 * its dashboard and masters, GST its register and return status, and so on).
 * The logo always leads back to the main dashboard.
 */
export const TOOLS = [
  {
    id: "mca",
    title: "MCA",
    href: "/mca",
    icon: ShieldCheck,
    description: "Companies Act compliance: post incorporation and annual filings, challans and master data.",
    items: [
      {
        title: "Dashboard",
        href: "/mca",
        icon: ShieldCheck,
        description: "Post incorporation and annual compliance across every company.",
      },
      {
        title: "Company Master Data",
        href: "/portfolio",
        icon: LayoutGrid,
        description: "Every company with its mobile, directors and reference.",
      },
      {
        title: "Director Master",
        href: "/directors",
        icon: Users,
        description: "Each director once, by DIN, with every company they sit on and their DIR-3 KYC.",
      },
      {
        title: "Consultant Master",
        href: "/consultants",
        icon: Contact,
        description: "Consultants with their mobile numbers, and the companies under each one.",
      },
    ],
  },
  {
    id: "gst",
    title: "GST",
    href: "/gst",
    icon: ReceiptIndianRupee,
    description: "GST client register and monthly GSTR-1 / GSTR-3B filing status.",
    items: [
      {
        title: "Client Register",
        href: "/gst",
        icon: ReceiptIndianRupee,
        description: "GST clients with GSTIN, portal user name, registration and folder.",
      },
      {
        title: "Return Filing Status",
        href: "/gst/returns",
        icon: ListChecks,
        description: "GSTR-1 and GSTR-3B filed or not, month by month, for every GST client.",
      },
      {
        title: "Helper Guide",
        href: "/gst/guide",
        icon: BookOpen,
        description: "How to add the free GST Helper to Chrome, autofill GST logins and check every client's status.",
      },
    ],
  },
  {
    id: "documents",
    title: "Document Generator",
    href: "/documents",
    icon: FilePen,
    description: "Notices, resolutions, DIR-2, DIR-8, MBP-1 and letters, downloaded as Word or PDF.",
    items: [
      {
        title: "Document Generator",
        href: "/documents",
        icon: FilePen,
        description: "Notices, resolutions, DIR-2, DIR-8, MBP-1 and letters, pre-filled and downloaded as Word or PDF.",
      },
    ],
  },
  {
    id: "bank",
    title: "Bank Statement to Excel",
    href: "/bank-statement",
    icon: Landmark,
    description: "Convert a bank statement PDF to Excel and tag each transaction to a ledger.",
    items: [
      {
        title: "Bank Statement to Excel",
        href: "/bank-statement",
        icon: Landmark,
        description: "Convert a bank statement PDF to Excel, tag each transaction to a ledger and download.",
      },
    ],
  },
  {
    id: "tasks",
    title: "Task Manager",
    href: "/tasks",
    icon: ClipboardList,
    description: "Every client task with who it is assigned to, its deadline, fee and status.",
    items: [
      {
        title: "Task Manager",
        href: "/tasks",
        icon: ClipboardList,
        description: "Client tasks with assignee, deadline, fee and Pending / Finished status.",
      },
    ],
  },
];

/** The tool a page belongs to, or null (the main dashboard and reference pages). */
export function toolFor(pathname) {
  const within = (href) => pathname === href || pathname.startsWith(`${href}/`);
  return TOOLS.find((t) => t.items.some((i) => within(i.href))) ?? null;
}

const DASHBOARD = {
  title: "Dashboard",
  href: "/dashboard",
  icon: House,
  description: "The five tools: MCA, GST, Document Generator, Bank Statement to Excel and Task Manager.",
};

/** Flat list of every page, for the search and the home page. */
export const allNavItems = [DASHBOARD, ...TOOLS.flatMap((t) => t.items)];

/** Shown in the context bar under the top navigation. */
export const LAW_UPDATED = "October 2026";
