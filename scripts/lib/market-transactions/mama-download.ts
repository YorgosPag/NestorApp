/**
 * @fileoverview **Η ΛΗΨΗ ΤΩΝ ΑΡΧΕΙΩΝ ΜΑΜΑ** — μία φορά ανά έτος, σε cache εκτός git, με την προέλευση δίπλα (ADR-889 §5.2 βήμα 1).
 * @related ADR-889 · `scripts/lib/admin-boundaries/admin-boundary-source.ts` (ίδιο ιδίωμα cache)
 *
 * 🔑 **Η ΠΡΟΕΛΕΥΣΗ ΤΑΞΙΔΕΥΕΙ ΜΕ ΤΟ ΑΡΧΕΙΟ.** Δίπλα σε κάθε `.xlsx` γράφεται `.meta.json` με το `Last-Modified`
 * του διακομιστή και το sha256 των bytes. Το ευρετήριο εξόδου τα αντιγράφει, οπότε κάθε αριθμός ανάγεται
 * σε **συγκεκριμένη** έκδοση της πηγής και όχι σε «όποτε τρέξαμε». Το αρχείο του τρέχοντος έτους
 * ξαναγράφεται μέσα στη χρονιά (§2).
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { REPO_ROOT } from '../admin-boundaries/admin-boundary-source';

/**
 * ⚠️ Στο `node_modules/.cache`, όπως η cache των ορίων: ο ένας φάκελος που **καμία** ρύθμιση δεν
 * παρακολουθεί ούτε σαρώνει. Εδώ ζει και η **έξοδος** της Φ1 (δες τον γεννήτορα).
 */
export const MARKET_TRANSACTIONS_CACHE_DIR = join(REPO_ROOT, 'node_modules', '.cache', 'market-transactions');

export function mamaSourceUrl(year: number): string {
  return `https://www.gsis.gr/sites/default/files/akinhta/mhtrwo-ax-met-ak-${year}.xlsx`;
}

export interface MamaSourceMeta {
  readonly year: number;
  readonly url: string;
  /** Ο διακομιστής το δίνει· `null` αν δεν το έδωσε. */
  readonly lastModified: string | null;
  readonly bytes: number;
  readonly sha256: string;
}

export interface MamaSourceFile {
  readonly path: string;
  readonly meta: MamaSourceMeta;
}

async function download(year: number, path: string, metaPath: string): Promise<MamaSourceMeta> {
  const url = mamaSourceUrl(year);
  process.stdout.write(`  ↓ ${year} … `);
  const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (NestorApp ADR-889 market-transactions generator)' } });
  if (!response.ok) throw new Error(`ΜΑΜΑ ${year}: HTTP ${response.status} από ${url}`);
  const body = Buffer.from(await response.arrayBuffer());
  const meta: MamaSourceMeta = {
    year,
    url,
    lastModified: response.headers.get('last-modified'),
    bytes: body.length,
    sha256: createHash('sha256').update(body).digest('hex'),
  };
  writeFileSync(path, body);
  writeFileSync(metaPath, `${JSON.stringify(meta, null, 2)}\n`);
  process.stdout.write(`${(body.length / 1e6).toFixed(1)} MB\n`);
  return meta;
}

/**
 * Το αρχείο ενός έτους από την cache, αλλιώς (ή με `refresh`) από τη ΓΓΠΣΨΔ.
 * ⚠️ Αρχείο χωρίς `.meta.json` ξανακατεβαίνει: χωρίς προέλευση δεν ξέρουμε **ποια** έκδοση είναι.
 */
export async function loadMamaYear(year: number, refresh: boolean): Promise<MamaSourceFile> {
  mkdirSync(MARKET_TRANSACTIONS_CACHE_DIR, { recursive: true });
  const path = join(MARKET_TRANSACTIONS_CACHE_DIR, `mama-${year}.xlsx`);
  const metaPath = `${path}.meta.json`;
  if (!refresh && existsSync(path) && existsSync(metaPath)) {
    return { path, meta: JSON.parse(readFileSync(metaPath, 'utf8')) as MamaSourceMeta };
  }
  return { path, meta: await download(year, path, metaPath) };
}
