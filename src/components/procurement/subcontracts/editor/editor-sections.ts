/**
 * @fileoverview **Οι ενότητες του επεξεργαστή και πόσα ευρήματα έχει η καθεμία** (ADR-928 Φ3γ-2 απόφαση 9).
 * @module components/procurement/subcontracts/editor/editor-sections
 *
 * Η φόρμα είναι μακριά. Το «3 ευρήματα» της εργαλειοθήκης πρέπει να οδηγεί **κάπου**: κάθε εύρημα ανήκει σε μία ενότητα
 * κατά το πρώτο τμήμα του `path` του (ίδια μονοπάτια με τον κριτή), και η πλοήγηση λέει πόσα έχει η καθεμία.
 * Ολική αντιστοίχιση: ό,τι δεν είναι μέρος, γραμμή, όρος ή ρήτρα ανήκει στην ταυτότητα. Κανένα εύρημα δεν χάνεται.
 */

import type { SubcontractIssue } from '@/subapps/procurement/subcontracts/clauses/clause-issues';

export const EDITOR_SECTIONS = ['identity', 'parties', 'lines', 'terms', 'plan', 'clauses'] as const;
export type EditorSection = (typeof EDITOR_SECTIONS)[number];

const PARTY_FIELDS: ReadonlySet<string> = new Set(['subcontractorContactId', 'scope', 'projectOwners', 'issuerSignatory']);
const PLAN_PREFIX = 'terms.paymentPlan';

export function sectionOfPath(path: string): EditorSection {
  const head = path.split('.')[0];
  if (head === 'lines') return 'lines';
  if (head === 'clauses') return 'clauses';
  if (head === 'terms') return path === PLAN_PREFIX || path.startsWith(`${PLAN_PREFIX}.`) ? 'plan' : 'terms';
  return PARTY_FIELDS.has(head) ? 'parties' : 'identity';
}

export function issueCountsBySection(issues: readonly SubcontractIssue[]): Readonly<Record<EditorSection, number>> {
  const counts: Record<EditorSection, number> = { identity: 0, parties: 0, lines: 0, terms: 0, plan: 0, clauses: 0 };
  for (const issue of issues) counts[sectionOfPath(issue.path)] += 1;
  return counts;
}
