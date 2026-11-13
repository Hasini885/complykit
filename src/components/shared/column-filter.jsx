"use client";

import * as React from "react";
import { ArrowDownAZ, ArrowUpAZ, ChevronDown, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const BLANK = "(Blanks)";

/**
 * Excel-style filter for one column: sort A→Z / Z→A, search, and tick the
 * values to show. `selected` is a Set of allowed values, or null for all.
 */
export function ColumnFilter({ label, values, selected, onApply, sortDir, onSort }) {
  const [open, setOpen] = React.useState(false);
  const active = selected !== null || sortDir !== 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Filter or sort ${label}`}
          className={cn(
            "inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
            active && "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground",
          )}
        >
          <ChevronDown className="size-3.5" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        {open ? (
          <FilterBody
            label={label}
            values={values}
            selected={selected}
            onSort={(d) => {
              onSort(d);
              setOpen(false);
            }}
            onApply={(s) => {
              onApply(s);
              setOpen(false);
            }}
            onCancel={() => setOpen(false)}
          />
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

function FilterBody({ label, values, selected, onSort, onApply, onCancel }) {
  const [query, setQuery] = React.useState("");
  const [chosen, setChosen] = React.useState(() => new Set(selected ?? values));
  const shown = values.filter((v) => (v || BLANK).toLowerCase().includes(query.toLowerCase()));
  const allOn = shown.length > 0 && shown.every((v) => chosen.has(v));

  function toggle(v, on) {
    setChosen((c) => {
      const next = new Set(c);
      if (on) next.add(v);
      else next.delete(v);
      return next;
    });
  }

  return (
    <div className="text-sm">
      <div className="p-1">
        <MenuButton onClick={() => onSort(1)} icon={ArrowDownAZ}>
          Sort A → Z
        </MenuButton>
        <MenuButton onClick={() => onSort(-1)} icon={ArrowUpAZ}>
          Sort Z → A
        </MenuButton>
        <MenuButton onClick={() => onSort(0)} icon={X}>
          Clear sort
        </MenuButton>
      </div>
      <div className="border-t p-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${label}…`}
          className="h-8 w-full rounded-lg border bg-background px-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/40"
          autoFocus
        />
        <div className="mt-2 max-h-52 overflow-y-auto rounded-lg border">
          <label className="flex cursor-pointer items-center gap-2 px-2.5 py-1.5 hover:bg-accent">
            <input
              type="checkbox"
              checked={allOn}
              onChange={(e) => shown.forEach((v) => toggle(v, e.target.checked))}
            />
            <b>(Select all{query ? " results" : ""})</b>
          </label>
          {shown.map((v) => (
            <label key={v} className="flex cursor-pointer items-center gap-2 px-2.5 py-1.5 hover:bg-accent">
              <input type="checkbox" checked={chosen.has(v)} onChange={(e) => toggle(v, e.target.checked)} />
              <span className="truncate">{v || BLANK}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 border-t p-2">
        <Button size="sm" variant="ghost" onClick={() => onApply(null)}>
          Clear filter
        </Button>
        <span className="flex gap-1.5">
          <Button size="sm" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button size="sm" onClick={() => onApply(chosen.size === values.length ? null : chosen)}>
            OK
          </Button>
        </span>
      </div>
    </div>
  );
}

function MenuButton({ icon: Icon, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left hover:bg-accent"
    >
      <Icon className="size-3.5 text-muted-foreground" aria-hidden />
      {children}
    </button>
  );
}

/**
 * Filter and sort state for a table: `filters` maps a column key to its Set
 * of allowed values; `sort` is { key, dir } or null. `apply` gives the rows to
 * show, read through `valueOf(row, key)`.
 */
export function useColumnFilters(valueOf) {
  const [filters, setFilters] = React.useState({});
  const [sort, setSort] = React.useState(null);

  const apply = React.useCallback(
    (rows) => {
      const kept = rows.filter((r) => Object.entries(filters).every(([k, set]) => set.has(valueOf(r, k))));
      if (!sort) return kept;
      return [...kept].sort(
        (a, b) =>
          sort.dir *
          String(valueOf(a, sort.key)).localeCompare(String(valueOf(b, sort.key)), undefined, {
            numeric: true,
            sensitivity: "base",
          }),
      );
    },
    [filters, sort, valueOf],
  );

  /**
   * Props for the ColumnFilter of one column. `choices` (optional) is a fixed
   * list, such as the statuses, offered in that order even when no row has
   * the value yet; any other values in the rows follow.
   */
  const propsFor = React.useCallback(
    (key, label, rows, choices = []) => ({
      label,
      values: [
        ...choices,
        ...[...new Set(rows.map((r) => String(valueOf(r, key))))]
          .filter((v) => !choices.includes(v))
          .sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
      ],
      selected: filters[key] ?? null,
      sortDir: sort?.key === key ? sort.dir : 0,
      onSort: (dir) => setSort(dir === 0 ? null : { key, dir }),
      onApply: (set) =>
        setFilters((f) => {
          const next = { ...f };
          if (set === null) delete next[key];
          else next[key] = set;
          return next;
        }),
    }),
    [filters, sort, valueOf],
  );

  const clear = React.useCallback(() => {
    setFilters({});
    setSort(null);
  }, []);
  const any = Object.keys(filters).length > 0 || sort !== null;

  return { apply, propsFor, clear, any, filters, setFilters };
}
