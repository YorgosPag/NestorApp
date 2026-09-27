/**
 * @fileoverview **Το πραγματικό μητρώο, για tests** — εύρεση οντότητας κατά **ταυτότητα**, όχι κατά γραφή.
 * @related ADR-893 · `src/utils/address/place-name.ts` (`foldPlaceIdentity`)
 *
 * 🔴 **ΓΙΑΤΙ ΥΠΑΡΧΕΙ — ΜΕΤΡΗΜΕΝΟ 2026-09-27**: δύο σουίτες είχαν η καθεμία δικό της `idOf(name)` με
 * `entry.n === name`. Όταν το ADR-893 έγραψε «ΔΗΜΟΣ ΘΕΡΜΗΣ» ως «Δήμος Θέρμης», **11** tests
 * κοκκίνισαν χωρίς να έχει αλλάξει **κανένας** τόπος. Η εφαρμογή συγκρίνει ονόματα **πάντα**
 * διπλωμένα· ένα test που συγκρίνει ωμά ελέγχει την ορθογραφία, όχι τη συμπεριφορά.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { foldPlaceIdentity } from '@/utils/address/place-name';

export interface RealHierarchyRow {
  readonly id: string;
  readonly n: string;
  readonly l: number;
  readonly p: string | null;
}

const HIERARCHY_PATH = join(process.cwd(), 'public', 'data', 'administrative-hierarchy.json');

export const realHierarchyRows: readonly RealHierarchyRow[] = (
  JSON.parse(readFileSync(HIERARCHY_PATH, 'utf8')) as { data: RealHierarchyRow[] }
).data;

/**
 * Το `id` μιας οντότητας από το **πλήρες** όνομά της — τα ονόματα είναι σταθερά, τα ids όχι.
 * Ακριβώς **μία** οντότητα, αλλιώς σφάλμα: ένα test που βρήκε «κάποιον» Δήμο Ηρακλείου δεν
 * αποδεικνύει τίποτα.
 */
export function hierarchyIdOf(name: string): string {
  const folded = foldPlaceIdentity(name);
  const rows = realHierarchyRows.filter((row) => foldPlaceIdentity(row.n) === folded);
  if (rows.length !== 1) throw new Error(`"${name}": ${rows.length} entities in hierarchy, expected 1`);
  return rows[0].id;
}
