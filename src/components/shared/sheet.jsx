"use client";

import * as React from "react";

import { Trash2 } from "lucide-react";

import { ColumnFilter } from "@/components/shared/column-filter";
import { cn } from "@/lib/utils";

/**
 * Spreadsheet building blocks for the GST and Task Manager tables, so they
 * work like Excel: gridlines, a header row and S.No column that stay put while
 * scrolling, arrow keys / Enter to move between cells, and pasting a block of
 * cells copied from Excel. Each editable control carries data-r (its row on
 * screen) and data-c (its column) so the keys can find its neighbours.
 */

/** Class for an input or select inside a sheet cell. */
export const SHEET_INPUT =
  "h-11 w-full min-w-0 bg-transparent px-3 text-[15px] outline-none placeholder:text-muted-foreground/60";

/**
 * The scrolling frame and table. `onPasteGrid(rows, r, c)` receives a block
 * pasted into the cell at row r, column c (rows of cells, as copied from Excel).
 * `onEnterPastEnd(c)` runs when Enter is pressed on the last row.
 */
export function Sheet({ children, onPasteGrid, onEnterPastEnd, minWidth }) {
  function onKeyDown(e) {
    const t = e.target;
    if (t.dataset?.r === undefined || e.altKey || e.ctrlKey || e.metaKey) return;
    const r = Number(t.dataset.r);
    const c = Number(t.dataset.c);
    const root = e.currentTarget;
    const at = (rr, cc) => root.querySelector(`[data-r="${rr}"][data-c="${cc}"]`);
    const go = (el) => {
      if (!el) return false;
      e.preventDefault();
      el.focus();
      if (el.tagName === "INPUT" && el.type !== "date" && el.select) el.select();
      return true;
    };
    /** The next control along the row, skipping columns without one. */
    const along = (dir) => {
      for (let i = 1; i <= 40; i++) {
        const el = at(r, c + dir * i);
        if (el) return el;
      }
      return null;
    };
    const text = t.tagName === "INPUT" && !["date", "month", "checkbox"].includes(t.type);
    const atStart = text ? t.selectionStart === 0 && t.selectionEnd === 0 : true;
    const atEnd = text ? t.selectionStart === t.value.length && t.selectionEnd === t.value.length : true;
    const allSelected = text && t.value.length > 0 && t.selectionStart === 0 && t.selectionEnd === t.value.length;

    switch (e.key) {
      case "ArrowUp":
        go(at(r - 1, c));
        break;
      case "ArrowDown":
        go(at(r + 1, c));
        break;
      case "Enter":
        if (t.tagName === "SELECT") break;
        if (e.shiftKey) go(at(r - 1, c));
        else if (!go(at(r + 1, c)) && onEnterPastEnd) {
          e.preventDefault();
          onEnterPastEnd(c);
        }
        break;
      case "ArrowLeft":
        if (t.type === "date") break;
        if (atStart || allSelected) go(along(-1));
        break;
      case "ArrowRight":
        if (t.type === "date") break;
        if (atEnd || allSelected) go(along(1));
        break;
      case "Escape":
        t.blur();
        break;
    }
  }

  function onPaste(e) {
    const t = e.target;
    if (!onPasteGrid || t.dataset?.r === undefined) return;
    const raw = e.clipboardData?.getData("text/plain") ?? "";
    // A single value pastes normally; a block (tabs or several lines) fills the cells from here.
    if (!/[\t\n]/.test(raw.replace(/\r?\n$/, ""))) return;
    e.preventDefault();
    const rows = raw
      .replace(/\r/g, "")
      .replace(/\n$/, "")
      .split("\n")
      .map((line) => line.split("\t").map((v) => v.trim()));
    onPasteGrid(rows, Number(t.dataset.r), Number(t.dataset.c));
  }

  return (
    <div
      className="sheet max-h-[calc(100dvh-13rem)] overflow-auto rounded-2xl border-2 border-dashed border-primary/30"
      onKeyDown={onKeyDown}
      onPaste={onPaste}
    >
      <table className="w-max min-w-full text-[15px]" style={minWidth ? { minWidth } : undefined}>
        {children}
      </table>
    </div>
  );
}

/** A header cell, with an Excel-style filter button. */
export function SheetHead({ children, filter, req, sno, className, style }) {
  return (
    <th className={cn(sno && "sheet-sno", className)} style={style}>
      <span className={cn("flex h-12 items-center gap-1 px-3", sno ? "justify-center" : "justify-between")}>
        <span className="truncate">
          {children}
          {req ? <span className="text-destructive"> *</span> : null}
        </span>
        {filter ? <ColumnFilter {...filter} /> : null}
      </span>
    </th>
  );
}

/** A body cell; `sno` makes it the row number, which stays put while scrolling sideways. */
export function SheetCell({ children, sno, className, ...props }) {
  return (
    <td className={cn(sno && "sheet-sno px-2", className)} {...props}>
      {children}
    </td>
  );
}

/**
 * The row number, which turns into a delete button while the row is pointed
 * at (the row needs className "group/row"). It stays in view however far the
 * sheet is scrolled sideways.
 */
export function SnoCell({ n, onDelete, label }) {
  return (
    <td className="sheet-sno px-1">
      <span className="group-hover/row:hidden group-focus-within/row:hidden">{n}</span>
      <button
        type="button"
        onClick={onDelete}
        aria-label={label ?? `Delete row ${n}`}
        title={label ?? `Delete row ${n}`}
        className="mx-auto hidden size-8 items-center justify-center rounded-lg text-destructive hover:bg-destructive/15 group-hover/row:inline-flex group-focus-within/row:inline-flex"
      >
        <Trash2 className="size-4" aria-hidden />
      </button>
    </td>
  );
}

export { pastedDate, pastedFiled } from "@/lib/sheet-paste";
