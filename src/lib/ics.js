import { isoDate } from "@/lib/dates";

function foldLine(line) {
  // RFC 5545 §3.1: lines over 75 octets are folded with CRLF + a leading space.
  if (line.length <= 75) return line;
  const parts = [];
  let rest = line;
  while (rest.length > 75) {
    parts.push(rest.slice(0, 75));
    rest = " " + rest.slice(75);
  }
  parts.push(rest);
  return parts.join("\r\n");
}

function escapeText(value) {
  // §3.3.11: backslash, semicolon, comma and newlines must be escaped.
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function dateStamp(d) {
  return isoDate(d).replace(/-/g, "");
}

function nowStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(
    d.getUTCHours(),
  )}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

function addOneDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
}

/**
 * An all-day event starts at midnight, so "N days before, at 9:00" is
 * N-1 days and 15 hours before the start: 7 days -> -P6DT15H.
 */
export function alarmTrigger(daysBefore) {
  return `-P${daysBefore - 1}DT15H`;
}

export function buildIcs(events, calendarName = "CA Compliance Tool compliance calendar") {
  const stamp = nowStamp();
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CA Compliance Tool//Compliance Calendar//EN",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${escapeText(calendarName)}`,
  ];

  for (const event of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${escapeText(event.uid)}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${dateStamp(event.date)}`,
      // All-day events end the next day (exclusive), per RFC 5545 §3.6.1.
      `DTEND;VALUE=DATE:${dateStamp(addOneDay(event.date))}`,
      `SUMMARY:${escapeText(event.title)}`,
    );
    if (event.description) {
      lines.push(`DESCRIPTION:${escapeText(event.description)}`);
    }
    if (event.remindDaysBefore !== undefined && event.remindDaysBefore > 0) {
      lines.push(
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        `DESCRIPTION:${escapeText(`${event.title} is due in ${event.remindDaysBefore} days`)}`,
        `TRIGGER:${alarmTrigger(event.remindDaysBefore)}`,
        "END:VALARM",
      );
    }
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  // CRLF line endings per the spec, with folding applied line by line.
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

/** Triggers a browser download of the given text as a named file. No-op on the server. */
export function downloadTextFile(filename, content, mimeType) {
  if (typeof window === "undefined") return;
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadIcs(events, filename, calendarName) {
  downloadTextFile(filename, buildIcs(events, calendarName), "text/calendar;charset=utf-8");
}
