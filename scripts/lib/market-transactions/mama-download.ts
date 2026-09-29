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
import {
  SourceHttpError,
  loadCachedSource,
  probeSource,
  type CachedSourceMeta,
  type SourceAccessRestriction,
  type SourceProbe,
} from '../cached-download';
import type { CoverageTotals } from './mama-match-report';

/**
 * ⚠️ Στο `node_modules/.cache`, όπως η cache των ορίων: ο ένας φάκελος που **καμία** ρύθμιση δεν
 * παρακολουθεί ούτε σαρώνει. Εδώ ζει και η **έξοδος** της Φ1 (δες τον γεννήτορα).
 */
export const MARKET_TRANSACTIONS_CACHE_DIR = join(REPO_ROOT, 'node_modules', '.cache', 'market-transactions');

/** Η σύνοψη της τελευταίας εκτέλεσης (κάλυψη αντιστοίχισης) — την κρίνει η πύλη της ανανέωσης (ADR-889 §11). Εκτός `public/`. */
export const MAMA_RUN_SUMMARY_PATH = join(MARKET_TRANSACTIONS_CACHE_DIR, 'run-summary.json');

/** Τι γράφει ο γεννήτορας στη σύνοψη — κοινό γραφέα (γεννήτορας) και αναγνώστη (ανανέωση). */
export interface MamaRunSummary {
  readonly window: MamaWindow;
  readonly asOf: string;
  readonly totals: CoverageTotals;
}

/** Το πρώτο έτος του μητρώου (1/3/2017). */
export const MAMA_FIRST_YEAR = 2017;
/** Το προεπιλεγμένο παράθυρο: τα πέντε τελευταία **δημοσιευμένα** έτη (§5.2 βήμα 1). */
const MAMA_DEFAULT_YEARS = 5;

export interface MamaWindow {
  readonly from: number;
  readonly to: number;
}

type Probe = (url: string) => Promise<SourceProbe>;

/**
 * Το τελευταίο **δημοσιευμένο** έτος. 🔑 Τον Ιανουάριο το αρχείο του νέου έτους δεν υπάρχει ακόμη: με `to = έτος του
 * ρολογιού` ο γεννήτορας έσπαγε με 404 για εβδομάδες (ADR-889 §11.1). **Μόνο** το 404 σημαίνει «όχι ακόμη»·
 * κάθε άλλη απάντηση ή σφάλμα δεν μασκάρεται.
 */
export async function latestPublishedMamaYear(now: Date, probe: Probe = probeSource): Promise<number> {
  const year = now.getFullYear();
  const result = await probe(mamaSourceUrl(year));
  if (result.status === 404) return year - 1;
  if (result.status >= 200 && result.status < 300) return year;
  throw new SourceHttpError(`ΜΑΜΑ ${year}: απρόσμενο HTTP ${result.status} στον έλεγχο δημοσίευσης`, result.url, result.status);
}

function yearArg(argv: readonly string[], name: string): number | null {
  const arg = argv.find((a) => a.startsWith(`--${name}=`));
  return arg === undefined ? null : Number(arg.slice(name.length + 3));
}

/** Το παράθυρο ετών: `--from` / `--to`, αλλιώς τα πέντε τελευταία δημοσιευμένα. */
export async function resolveMamaWindow(argv: readonly string[], now = new Date(), probe: Probe = probeSource): Promise<MamaWindow> {
  const to = yearArg(argv, 'to') ?? (await latestPublishedMamaYear(now, probe));
  const from = yearArg(argv, 'from') ?? to - (MAMA_DEFAULT_YEARS - 1);
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < MAMA_FIRST_YEAR || from > to) {
    throw new Error(`άκυρο παράθυρο ετών ${from}–${to} (το μητρώο αρχίζει το ${MAMA_FIRST_YEAR})`);
  }
  return { from, to };
}

/**
 * 🔴 ADR-889 §11.11 — ο gsis.gr (Akamai) απαντά **403** εκτός Ελλάδας, ακόμη και στην αρχική του σελίδα: μετρημένο
 * 2026-09-29 από τον runner του GitHub (ΗΠΑ) σε 6 παραλλαγές κεφαλίδων **και** από το Netcup (Γερμανία)· από ελληνική IP
 * 200. Ο δρόμος λήψης σήμερα: runbook §11.8 (ανανέωση από ελληνική IP).
 */
export const MAMA_SOURCE_ACCESS: SourceAccessRestriction = {
  kind: 'geo',
  allowedRegion: 'GR',
  status: 403,
  evidence: '2026-09-29 · GitHub runner (US) + Netcup (DE) ⇒ 403 · ελληνική IP ⇒ 200',
  adr: 'ADR-889 §11.11',
};

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
