import type { Block } from "@/lib/documents/types";
import { cn } from "@/lib/utils";

/**
 * The generated document on screen, styled as a printed page: serif type,
 * black on white in both themes, so it looks like what will be downloaded.
 */
export function DocumentPreview({ blocks }: { blocks: Block[] }) {
  return (
    <div
      className="mx-auto max-w-[46rem] rounded-sm bg-white px-10 pt-5 pb-10 text-[13.5px] leading-relaxed text-neutral-900 shadow-sm ring-1 ring-black/10 sm:px-14"
      style={{ fontFamily: '"Bookman Old Style", "Bookman", Georgia, "Times New Roman", serif' }}
    >
      {blocks.map((b, i) => (
        <PreviewBlock key={i} block={b} />
      ))}
    </div>
  );
}

function PreviewBlock({ block: b }: { block: Block }) {
  switch (b.kind) {
    case "letterhead":
      return (
        <div className="mb-5 border-b border-neutral-500 pb-2 text-center">
          <p className="text-[17px] font-bold tracking-wide">{b.name}</p>
          {b.lines.map((l, i) => (
            <p key={i} className="text-[11.5px]">
              {l}
            </p>
          ))}
        </div>
      );
    case "title":
      return <p className="my-3 text-center font-bold uppercase tracking-wide">{b.text}</p>;
    case "subtitle":
      return <p className="mb-2 text-center font-bold">{b.text}</p>;
    case "heading":
      return <p className="mt-4 mb-1.5 font-bold">{b.text}</p>;
    case "para":
      return (
        <p
          className={cn(
            "mb-2",
            b.bold && "font-bold",
            b.align === "center" && "text-center",
            b.align === "right" && "text-right",
            b.align === "justify" && "text-justify",
          )}
        >
          {b.text}
        </p>
      );
    case "resolution":
      return <p className="mb-3 pl-6 text-justify">{b.text}</p>;
    case "list": {
      const Tag = b.ordered ? "ol" : "ul";
      return (
        <Tag className={cn("mb-3 space-y-1 pl-10 text-justify", b.ordered ? "list-decimal" : "list-disc")}>
          {b.items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </Tag>
      );
    }
    case "details":
      return (
        <dl className="mb-3 grid grid-cols-[minmax(9rem,14rem)_1fr] gap-x-4 gap-y-0.5">
          {b.rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="font-bold">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      );
    case "signature":
      return (
        <div className={cn("mb-2", b.align === "right" ? "text-right" : "text-left")}>
          {b.lines.map((l, i) => (
            <p key={i}>{l || " "}</p>
          ))}
        </div>
      );
    case "gap":
      return <div className="h-4" aria-hidden />;
  }
}
