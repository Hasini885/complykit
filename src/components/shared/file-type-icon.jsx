import { cn } from "@/lib/utils";

/**
 * File-type icons for downloads: a green Excel sheet and a red PDF page, in
 * the colours people already know them by. Decorative: the button around
 * them carries the label.
 */

function Page({ fill, label, className }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("size-5 shrink-0", className)} aria-hidden focusable="false">
      {/* The page, with its folded corner. */}
      <path d="M6 2h8.5L20 7.5V20a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z" fill={fill} />
      <path d="M14.5 2v4a1.5 1.5 0 0 0 1.5 1.5h4Z" fill="#ffffff" fillOpacity="0.45" />
      <text
        x="12"
        y="17.6"
        textAnchor="middle"
        fontSize={label.length > 1 ? 6.2 : 9}
        fontWeight="800"
        fontFamily="Arial, Helvetica, sans-serif"
        fill="#ffffff"
      >
        {label}
      </text>
    </svg>
  );
}

export function ExcelIcon({ className }) {
  return <Page fill="#1D6F42" label="X" className={className} />;
}

export function PdfIcon({ className }) {
  return <Page fill="#D93025" label="PDF" className={className} />;
}
