/**
 * Μικρός κατάλογος ΚΑΔ για τα unit tests του `src/lib/kad` (ADR-372 §8.5 a4 · ADR-ACC-013).
 * Χτίζεται με τον ΠΡΑΓΜΑΤΙΚΟ `indexKadCatalog`, άρα ο κανόνας σύγκρουσης των 8 ψηφίων
 * εκτελείται και εδώ — όχι χειρόγραφο `byGemi`.
 *
 * Συγκρούσεις 8 ψηφίων που περιέχει (δες `kad-resolve.ts`):
 * - `41000000`: 41 (κλάδος) · 41.0 (ομάδα) · 41.00 (τάξη) ⇒ νικά το **41.00** (ρηχότερο επιλέξιμο).
 * - `43221000`: 43.22.1 (κατηγορία) · 43.22.10 (υποκατηγορία) ⇒ νικά το **43.22.1**.
 * - `99000000`: 99 (κλάδος) · 99.0 (ομάδα), κανένα επιλέξιμο ⇒ νικά το **99.0** (βαθύτερο).
 */

import { indexKadCatalog } from '../kad-catalog-shape';
import type { KadCatalogEntry, KadLevel } from '../kad-types';

function entry(code: string, level: KadLevel, parent: string | null, gemi: string | null): KadCatalogEntry {
  return { code, level, parent, gemi, description: `Περιγραφή ${code}` };
}

export const FIXTURE_ENTRIES: readonly KadCatalogEntry[] = [
  entry('F', 'section', null, null),
  entry('01.11.41', 'subcategory', '01.11.4', '01114100'),
  entry('41', 'division', 'F', '41000000'),
  entry('41.0', 'group', '41', '41000000'),
  entry('41.00', 'class', '41.0', '41000000'),
  entry('41.00.1', 'category', '41.00', '41001000'),
  entry('41.00.11', 'subcategory', '41.00.1', '41001100'),
  entry('41.00.11.01', 'national', '41.00.11', '41001101'),
  entry('43.22.1', 'category', '43.22', '43221000'),
  entry('43.22.10', 'subcategory', '43.22.1', '43221000'),
  entry('99', 'division', 'U', '99000000'),
  entry('99.0', 'group', '99', '99000000'),
];

export const FIXTURE_CATALOG = indexKadCatalog(null, FIXTURE_ENTRIES);

/** Η γραμμή του fixture με αυτόν τον κωδικό (πετά αν λείπει — λάθος του ίδιου του test). */
export function fixtureEntry(code: string): KadCatalogEntry {
  const found = FIXTURE_CATALOG.byCode.get(code);
  if (!found) throw new Error(`fixture: δεν υπάρχει ο κωδικός ${code}`);
  return found;
}
