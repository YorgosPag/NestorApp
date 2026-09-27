/**
 * @fileoverview **Η ΛΗΨΗ ΤΩΝ ΑΡΧΕΙΩΝ ΜΑΜΑ** — μία φορά ανά έτος, σε cache εκτός git, με την προέλευση δίπλα (ADR-889 §5.2 βήμα 1).
 * @related ADR-889 · `scripts/lib/cached-download.ts` (η ΜΙΑ λήψη πηγής των γεννητόρων, ADR-891 Φ2)
 *
 * 🔑 **Η ΠΡΟΕΛΕΥΣΗ ΤΑΞΙΔΕΥΕΙ ΜΕ ΤΟ ΑΡΧΕΙΟ.** Δίπλα σε κάθε `.xlsx` γράφεται `.meta.json` με το `Last-Modified`
 * του διακομιστή και το sha256 των bytes (το εγγυάται το `cached-download`). Το ευρετήριο εξόδου τα αντιγράφει,
 * οπότε κάθε αριθμός ανάγεται σε **συγκεκριμένη** έκδοση της πηγής και όχι σε «όποτε τρέξαμε». Το αρχείο του
 * τρέχοντος έτους ξαναγράφεται μέσα στη χρονιά (§2).
 */

import { join } from 'node:path';

import { REPO_ROOT } from '../admin-boundaries/admin-boundary-source';
import { loadCachedSource, type CachedSourceMeta } from '../cached-download';

/**
 * ⚠️ Στο `node_modules/.cache`, όπως η cache των ορίων: ο ένας φάκελος που **καμία** ρύθμιση δεν
 * παρακολουθεί ούτε σαρώνει. Εδώ ζει και η **έξοδος** της Φ1 (δες τον γεννήτορα).
 */
export const MARKET_TRANSACTIONS_CACHE_DIR = join(REPO_ROOT, 'node_modules', '.cache', 'market-transactions');

export function mamaSourceUrl(year: number): string {
  return `https://www.gsis.gr/sites/default/files/akinhta/mhtrwo-ax-met-ak-${year}.xlsx`;
}

export interface MamaSourceMeta extends CachedSourceMeta {
  readonly year: number;
}

export interface MamaSourceFile {
  readonly path: string;
  readonly meta: MamaSourceMeta;
}

/** Το αρχείο ενός έτους από την cache, αλλιώς (ή με `refresh`) από τη ΓΓΠΣΨΔ. */
export async function loadMamaYear(year: number, refresh: boolean): Promise<MamaSourceFile> {
  const source = await loadCachedSource({
    url: mamaSourceUrl(year),
    path: join(MARKET_TRANSACTIONS_CACHE_DIR, `mama-${year}.xlsx`),
    label: String(year),
    refresh,
  });
  return { path: source.path, meta: { year, ...source.meta } };
}
