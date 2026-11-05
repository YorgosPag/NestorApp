/**
 * @fileoverview **Οι ενότητες του επεξεργαστή και πόσα ευρήματα έχει η καθεμία** (ADR-928 Φ3γ-2 απόφαση 9 · §5.22).
 * @module components/procurement/subcontracts/editor/editor-sections
 *
 * Η φόρμα είναι μακριά. Το «3 ευρήματα» της εργαλειοθήκης πρέπει να οδηγεί **κάπου**: κάθε εύρημα ανήκει σε μία ενότητα
 * κατά το πρώτο τμήμα του `path` του (ίδια μονοπάτια με τον κριτή), και η πλοήγηση λέει πόσα έχει η καθεμία.
 * Ολική αντιστοίχιση: ό,τι δεν είναι μέρος, γραμμή, όρος ή ρήτρα ανήκει στην ταυτότητα. Κανένα εύρημα δεν χάνεται.
 *
 * 🔑 Ο χάρτης είναι **παράμετρος** (§5.22): το συμφωνητικό κρατά τους όρους στο `terms`, το πρότυπο στο `defaultTerms`
 *    και δεν έχει μέρη. Ίδια λογική, άλλα προθέματα — όχι δεύτερο αντίγραφο.
 */

import type { SubcontractIssue } from '@/subapps/procurement/subcontracts/clauses/clause-issues';

export const EDITOR_SECTIONS = ['identity', 'parties', 'lines', 'terms', 'plan', 'clauses'] as const;
export type EditorSection = (typeof EDITOR_SECTIONS)[number];

export interface EditorSectionMap {
  /** Οι ενότητες που έχει ο επεξεργαστής, με τη σειρά της φόρμας. */
  readonly sections: readonly EditorSection[];
  /** Το πρόθεμα των εμπορικών όρων (`terms` · `defaultTerms`). */
  readonly termsPrefix: string;
  readonly partyFields: ReadonlySet<string>;
}

export const AGREEMENT_SECTION_MAP: EditorSectionMap = {
  sections: EDITOR_SECTIONS,
  termsPrefix: 'terms',
  partyFields: new Set(['subcontractorContactId', 'scope', 'projectOwners', 'issuerSignatory']),
};

export const TEMPLATE_SECTION_MAP: EditorSectionMap = {
  sections: ['identity', 'lines', 'terms', 'plan', 'clauses'],
  termsPrefix: 'defaultTerms',
  partyFields: new Set(),
};

const SECTION_HASH_PREFIX = '#editor-';

/** Το hash μιας ενότητας (`#editor-lines`) — ίδιο με το `id` της επικεφαλίδας της, άρα και βαθύς σύνδεσμος. */
export function sectionHash(section: EditorSection): string {
  return `${SECTION_HASH_PREFIX}${section}`;
}

/** `#editor-plan` ⇒ `plan` — μόνο αν ο επεξεργαστής **έχει** αυτή την ενότητα· αλλιώς `null` (ποτέ μαντεψιά). */
export function sectionOfHash(hash: string, map: EditorSectionMap = AGREEMENT_SECTION_MAP): EditorSection | null {
  if (!hash.startsWith(SECTION_HASH_PREFIX)) return null;
  const candidate = hash.slice(SECTION_HASH_PREFIX.length);
  return map.sections.find((section) => section === candidate) ?? null;
}

export function sectionOfPath(path: string, map: EditorSectionMap = AGREEMENT_SECTION_MAP): EditorSection {
  const head = path.split('.')[0];
  if (head === 'lines') return 'lines';
  if (head === 'clauses') return 'clauses';
  if (head === map.termsPrefix) {
    const plan = `${map.termsPrefix}.paymentPlan`;
    return path === plan || path.startsWith(`${plan}.`) ? 'plan' : 'terms';
  }
  return map.partyFields.has(head) ? 'parties' : 'identity';
}

export function issueCountsBySection(issues: readonly SubcontractIssue[], map: EditorSectionMap = AGREEMENT_SECTION_MAP): Readonly<Record<EditorSection, number>> {
  const counts: Record<EditorSection, number> = { identity: 0, parties: 0, lines: 0, terms: 0, plan: 0, clauses: 0 };
  for (const issue of issues) counts[sectionOfPath(issue.path, map)] += 1;
  return counts;
}
