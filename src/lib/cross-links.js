import { forms } from "@/data/forms";
import { sections, sectionsByNumber } from "@/data/sections";

/**
 * Two-way links between forms and sections.
 *
 * Forms cite sections by bare number in `sectionRefs`. Only some of those
 * numbers have a written entry in the section reference, so resolution is
 * deliberately lossy: an unresolved citation is dropped rather than rendered as
 * a dead link. Tests assert that every link that *does* resolve points at a real
 * record in the other direction.
 */

/** Sections written up in the reference that this form cites. */
export function sectionsForForm(form) {
  return form.sectionRefs.map((n) => sectionsByNumber.get(n)).filter((s) => s !== undefined);
}

/** Forms explicitly listed on a section entry. */
export function formsForSection(section) {
  return section.relatedFormIds.map((id) => forms.find((f) => f.id === id)).filter((f) => f !== undefined);
}

/**
 * Forms that cite this section, whether or not the section lists them back.
 * Used to catch cross-links a hand-written `relatedFormIds` array would miss.
 */
export function formsCitingSection(section) {
  return forms.filter((f) => f.sectionRefs.includes(section.number));
}

/** Union of both directions, de-duplicated, in data order. */
export function allFormsForSection(section) {
  const seen = new Set();
  return [...formsForSection(section), ...formsCitingSection(section)].filter((f) => {
    if (seen.has(f.id)) return false;
    seen.add(f.id);
    return true;
  });
}

/** Section numbers cited by forms that have no written entry yet — a content backlog. */
export function unwrittenSectionRefs() {
  const written = new Set(sections.map((s) => s.number));
  const cited = new Set(forms.flatMap((f) => f.sectionRefs));
  return [...cited].filter((n) => !written.has(n)).sort();
}
