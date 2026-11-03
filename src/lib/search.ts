import type { McaForm } from "@/data/forms";
import type { ActSection } from "@/data/sections";

/**
 * Shared search predicate. Kept out of the component so the forms table and the
 * Phase 5 command palette rank results the same way.
 *
 * Every whitespace-separated term must appear somewhere in the record, so
 * "aoc annual" narrows rather than widens. Matching is substring-based and
 * case-insensitive; punctuation in a form code ("AOC-4") is preserved, and a
 * query typed without the hyphen ("aoc4") is normalised to match it.
 */
export function normalise(value: string) {
  return value.toLowerCase().replace(/[\s\-–—·.]+/g, " ").trim();
}

export function terms(query: string) {
  return normalise(query).split(" ").filter(Boolean);
}

export function matchesTerms(haystack: string, query: string) {
  const t = terms(query);
  if (t.length === 0) return true;
  const hay = normalise(haystack);
  // Also allow a term with separators stripped entirely, so "aoc4" finds "AOC-4".
  const squashed = hay.replace(/ /g, "");
  return t.every((term) => hay.includes(term) || squashed.includes(term.replace(/ /g, "")));
}

export function formHaystack(form: McaForm) {
  return [
    form.code,
    form.name,
    form.purpose,
    form.section,
    form.trigger,
    form.deadline,
    form.category,
    form.watchOut,
    ...form.tags,
  ].join(" ");
}

export function matchesForm(form: McaForm, query: string) {
  return matchesTerms(formHaystack(form), query);
}

export function sectionHaystack(section: ActSection) {
  return [
    `Section ${section.number}`,
    section.number,
    section.title,
    section.theme,
    section.summary,
    ...section.keyPoints,
    section.penalty ? `${section.penalty.summary} ${section.penalty.detail}` : "",
    ...section.tags,
  ].join(" ");
}

export function matchesSection(section: ActSection, query: string) {
  return matchesTerms(sectionHaystack(section), query);
}
