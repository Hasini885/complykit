"use client";

import { toast } from "sonner";
import { Copy, ExternalLink } from "lucide-react";

import { MCA_URL } from "@/config/site";
import { cn } from "@/lib/utils";

/**
 * A filing's SRN, shown beside the deadline it met, with what is needed to
 * pull the filed document up on MCA: copy the SRN, then open the portal.
 *
 * MCA has no stable deep link to an SRN (the tracker sits under MCA Services
 * -> Track SRN / Transaction Status on the V3 portal, behind a CAPTCHA), so
 * this links to the portal and says where to paste it, rather than guessing a
 * URL that may break.
 */
/** Income-tax e-filing portal, where a filed ITR is looked up. */
const ITR_PORTAL_URL = "https://www.incometax.gov.in";

export function SrnChip({
  srn,
  kind = "srn",
  className,
}: {
  srn: string;
  /** "ack" for an income-tax return's acknowledgement number. */
  kind?: "srn" | "ack";
  className?: string;
}) {
  const ack = kind === "ack";
  const label = ack ? "Ack." : "SRN";
  const name = ack ? "acknowledgement number" : "SRN";
  const where = ack
    ? "On the e-filing portal: e-File → Income Tax Returns → View Filed Returns."
    : "On the MCA portal: MCA Services → Track SRN / Transaction Status.";

  async function copy() {
    try {
      await navigator.clipboard.writeText(srn);
      toast.success(`${label} ${srn} copied`, { description: where });
    } catch {
      toast.error(`Could not copy — select the ${name} and copy it by hand.`);
    }
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded border border-emerald-600/30 bg-emerald-500/10 py-0.5 pr-0.5 pl-1.5 font-mono text-[11px] font-medium text-emerald-800 dark:text-emerald-300",
        className,
      )}
    >
      <span className="select-all" title={ack ? "ITR acknowledgement number" : "Service Request Number"}>
        {label} {srn}
      </span>
      <button
        type="button"
        onClick={copy}
        className="rounded p-0.5 hover:bg-emerald-500/20 print:hidden"
        title={`Copy ${name}`}
      >
        <Copy className="size-3" aria-hidden />
        <span className="sr-only">
          Copy {name} {srn}
        </span>
      </button>
      <a
        href={ack ? ITR_PORTAL_URL : MCA_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded p-0.5 hover:bg-emerald-500/20 print:hidden"
        title={ack ? "Open the income-tax e-filing portal" : "Open the MCA portal — MCA Services → Track SRN / Transaction Status"}
      >
        <ExternalLink className="size-3" aria-hidden />
        <span className="sr-only">
          {ack ? "Open the e-filing portal to view the return" : `Open the MCA portal to track SRN ${srn}`}
        </span>
      </a>
    </span>
  );
}
