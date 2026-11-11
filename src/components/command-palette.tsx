"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  getSearchItem,
  scoreItem,
  searchIndex,
  type SearchGroup,
} from "@/lib/search-index";
import { usePortfolio } from "@/components/portfolio/portfolio-provider";
import {
  DATA_GROUPS,
  buildDataIndex,
  scoreDataItem,
  type DataGroup,
  type DataSearchItem,
  type DataTarget,
} from "@/lib/portfolio/data-search";

/**
 * Global command palette.
 *
 * Filtering is delegated to cmdk via a custom `filter`, so cmdk keeps ownership
 * of keyboard navigation and selection while the ranking rules stay in
 * `scoreItem`. Item values are ids; the id is resolved back to its record
 * inside the filter.
 *
 * It searches the user's own records: companies, directors, consultants,
 * and filings by SRN or acknowledgement number (shown once something is
 * typed), plus the menu pages. The forms, sections and due-date library was
 * taken out of it at the owner's request.
 */
const SHOWN_GROUPS: SearchGroup[] = ["Pages"];
export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const { clients, directors, consultants, setActiveClient } = usePortfolio();

  // The user's own records, rebuilt whenever they change.
  const dataIndex = React.useMemo(
    () => buildDataIndex(clients, directors, consultants),
    [clients, directors, consultants],
  );
  const dataById = React.useMemo(() => new Map(dataIndex.map((i) => [i.id, i])), [dataIndex]);
  const dataGrouped = React.useMemo(() => {
    const map = new Map<DataGroup, DataSearchItem[]>();
    for (const g of DATA_GROUPS) map.set(g, []);
    for (const item of dataIndex) map.get(item.group)!.push(item);
    return map;
  }, [dataIndex]);

  const filter = React.useCallback(
    (value: string, search: string) => {
      const mine = dataById.get(value);
      if (mine) return scoreDataItem(mine, search);
      const item = getSearchItem(value);
      if (!item) return 0;
      return scoreItem(item, search);
    },
    [dataById],
  );

  function go(href: string) {
    onOpenChange(false);
    setQuery("");
    router.push(href);
  }

  async function openTarget(target: DataTarget) {
    if (target.kind === "href") return go(target.href);
    // A company result opens that company's dashboard.
    await setActiveClient(target.clientId);
    go("/dashboard");
  }

  // Of the reference index, only the menu pages are offered: the search is for
  // the user's own records, not the forms and sections library.
  const grouped = React.useMemo(() => {
    const map = new Map<SearchGroup, typeof searchIndex>();
    for (const g of SHOWN_GROUPS) map.set(g, []);
    for (const item of searchIndex) map.get(item.group)?.push(item);
    return map;
  }, []);

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Search CA Compliance Tool"
      description="Search your companies, directors, consultants, SRNs and DINs"
      className="max-w-2xl"
    >
      {/* CommandDialog only renders a Dialog, so the cmdk root goes here —
          otherwise `filter` would be spread onto the Radix Dialog and ignored. */}
      <Command filter={filter} loop>
        <CommandInput
          placeholder="Search companies, SRNs, DINs, mobiles…"
          value={query}
          onValueChange={setQuery}
        />
        <CommandList className="max-h-[60vh]">
          <CommandEmpty>
            <span className="block font-medium">Nothing matches that</span>
            <span className="mt-1 block text-xs text-muted-foreground">
              Try a company name, CIN, SRN, DIN, mobile number or consultant.
            </span>
          </CommandEmpty>

          {/* The user's own records first: they are usually what is being looked for. */}
          {DATA_GROUPS.map((group) => {
            const items = dataGrouped.get(group) ?? [];
            if (items.length === 0 || query.trim() === "") return null;
            return (
              <CommandGroup key={group} heading={group}>
                {items.map((item) => (
                  <CommandItem key={item.id} value={item.id} onSelect={() => void openTarget(item.target)}>
                    <span className="w-24 shrink-0 truncate font-mono text-xs font-semibold text-primary" title={item.badge ?? undefined}>
                      {item.badge}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{item.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">{item.subtitle}</span>
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            );
          })}

          {SHOWN_GROUPS.map((group) => {
            const items = grouped.get(group) ?? [];
            if (items.length === 0) return null;
            return (
              <CommandGroup key={group} heading={group}>
                {items.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={item.id}
                    onSelect={() => go(item.href)}
                  >
                    {item.badge ? (
                      <span className="w-24 shrink-0 truncate font-mono text-xs font-semibold text-primary">
                        {item.badge}
                      </span>
                    ) : (
                      <span className="w-24 shrink-0" aria-hidden />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">
                        {item.title}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {item.subtitle}
                      </span>
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            );
          })}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}

/** Owns the open state and the Ctrl/Cmd+K binding for the whole app. */
export function useCommandPalette() {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      // "/" opens it too, unless the user is already typing somewhere.
      if (e.key === "/" && !isTypingTarget(e.target)) {
        e.preventDefault();
        setOpen(true);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return { open, setOpen };
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}
