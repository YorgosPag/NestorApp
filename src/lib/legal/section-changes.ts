/**
 * **«Τι άλλαξε;»** ανάμεσα σε δύο εκδόσεις νομικού εγγράφου — ανά ενότητα, **κατά id**.
 *
 * 🔴 **Κατά id, ΠΟΤΕ κατά θέση**: μια νέα ενότητα στην αρχή θα έκανε κάθε επόμενη να φαίνεται
 * «αλλαγμένη», και ο αναγνώστης θα έχανε την **πραγματική** αλλαγή μέσα στον θόρυβο.
 *
 * Η σύγκριση κρίνει **περιεχόμενο** (επικεφαλίδα + μπλοκ), όχι αναπαράσταση: η κανονική
 * σειριοποίηση κάνει τη σειρά κλειδιών άσχετη.
 *
 * @module lib/legal/section-changes
 * @see ADR-861 §7
 */

import { canonicalJson } from '@/lib/legal/canonical-json';
import type { FrozenLegalSection, FrozenLegalText } from '@/lib/legal/frozen-legal-document';

export const SECTION_CHANGE_KINDS = ['added', 'removed', 'changed', 'unchanged'] as const;

export type SectionChangeKind = (typeof SECTION_CHANGE_KINDS)[number];

export type SectionChange =
  | { readonly kind: 'added'; readonly id: string; readonly next: FrozenLegalSection }
  | { readonly kind: 'removed'; readonly id: string; readonly previous: FrozenLegalSection }
  | {
      readonly kind: 'changed';
      readonly id: string;
      readonly previous: FrozenLegalSection;
      readonly next: FrozenLegalSection;
    }
  | { readonly kind: 'unchanged'; readonly id: string; readonly next: FrozenLegalSection };

const sameContent = (a: FrozenLegalSection, b: FrozenLegalSection): boolean =>
  canonicalJson(a) === canonicalJson(b);

/**
 * Οι αλλαγές με τη σειρά ανάγνωσης της **νέας** έκδοσης· οι ενότητες που αφαιρέθηκαν ακολουθούν
 * στο τέλος, με τη σειρά που είχαν.
 */
export function sectionChangesBetween(previous: FrozenLegalText, next: FrozenLegalText): readonly SectionChange[] {
  const before = new Map(previous.sections.map((s) => [s.id, s]));
  const nextIds = new Set(next.sections.map((s) => s.id));

  const present: SectionChange[] = next.sections.map((section) => {
    const old = before.get(section.id);
    if (old === undefined) return { kind: 'added', id: section.id, next: section };
    return sameContent(old, section)
      ? { kind: 'unchanged', id: section.id, next: section }
      : { kind: 'changed', id: section.id, previous: old, next: section };
  });
  const removed: SectionChange[] = previous.sections
    .filter((s) => !nextIds.has(s.id))
    .map((s) => ({ kind: 'removed', id: s.id, previous: s }));

  return [...present, ...removed];
}
