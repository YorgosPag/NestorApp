/**
 * @fileoverview **Η ΛΗΨΗ ΤΩΝ ΖΩΝΩΝ ΑΝΤΙΚΕΙΜΕΝΙΚΩΝ ΑΞΙΩΝ** — ο πόρος shp του ΥΠΕΘΟΟ, μία φορά, σε cache εκτός git (ADR-889 §2.3 · §10).
 * @related `scripts/lib/cached-download.ts` (η ΜΙΑ λήψη πηγής) · αδελφό του `market-transactions/mama-download.ts`
 *
 * 🔑 Η διεύθυνση ζει **εδώ** και όχι ιδιωτική στον γεννήτορα: τη ρωτά και ο γεννήτορας (λήψη) και η αυτόματη ανανέωση
 * (ADR-889 §11, φθηνός έλεγχος `HEAD`). Δύο αντίγραφα της ίδιας διεύθυνσης θα απέκλιναν στην πρώτη μετακόμιση του πόρου.
 */

import { join } from 'node:path';

import { REPO_ROOT } from '../admin-boundaries/admin-boundary-source';
import { loadCachedSource, type CachedSource } from '../cached-download';

/** Ο πόρος shp του συνόλου δεδομένων (ADR-889 §2.3). Η σελίδα του συνόλου ζει στο `OPEN_DATA_SOURCES.valueZones`. */
export const VALUE_ZONES_SOURCE_URL =
  'https://data.gov.gr/dataset/1fcf3d7d-e9f3-423d-83ff-59b930aa18f8/resource/7bba2acd-1aea-49f3-badb-60a7961d1b1a/download/zones_for_data_gov_gr.zip';

const VALUE_ZONES_CACHE_DIR = join(REPO_ROOT, 'node_modules', '.cache', 'value-zones');

/** Η σύνοψη της τελευταίας εκτέλεσης — την κρίνει η πύλη της ανανέωσης (ADR-889 §11). Εκτός `public/`. */
export const VALUE_ZONES_RUN_SUMMARY_PATH = join(VALUE_ZONES_CACHE_DIR, 'run-summary.json');

/** Τι γράφει ο γεννήτορας στη σύνοψη — κοινό γραφέα (γεννήτορας) και αναγνώστη (ανανέωση). */
export interface ValueZonesRunSummary {
  readonly areas: number;
  readonly zones: number;
  readonly fronts: number;
  /** Ζώνες/μέτωπα που δεν έπεσαν σε καμία περιοχή — θα χάνονταν σιωπηλά από τον χάρτη. */
  readonly unassigned: number;
  readonly collapsed: number;
}

export function loadValueZonesSource(refresh: boolean): Promise<CachedSource> {
  return loadCachedSource({
    url: VALUE_ZONES_SOURCE_URL,
    path: join(VALUE_ZONES_CACHE_DIR, 'zones_for_data_gov_gr.zip'),
    label: 'ζώνες ΥΠΕΘΟΟ',
    refresh,
  });
}
