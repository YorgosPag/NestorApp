/**
 * Firestore Rules — `asset_pack_config` collection (ADR-655)
 *
 * Pattern: deny_all (Pattern E — server-only via Admin SDK).
 *
 * Doc: `asset_pack_config/{packId} → { status: 'public' | 'entitled' | 'disabled' }`
 *
 * Αυτό είναι ο **διακόπτης διανομής** των πακέτων περιεχομένου. Ζει σε δεδομένα (όχι σε
 * κώδικα) ώστε το «κόψε τη βρύση» να γυρίζει σε δευτερόλεπτα, χωρίς build/deploy.
 *
 * Ο κανόνας είναι σκέτο `allow read, write: if false` — **ούτε ανάγνωση** από client:
 * η κατάσταση κάθε πακέτου είναι πληροφορία της πύλης, όχι του φυλλομετρητή. Το UI μαθαίνει
 * τι δικαιούται ΜΟΝΟ από το `/api/asset-packs`, που αποφασίζει server-side.
 *
 * Το suite κλειδώνει ότι deny παίρνει **και ο super_admin** από client context — δηλαδή ότι
 * δεν υπάρχει `isSuperAdminOnly()` παραθυράκι· η μόνη διαδρομή είναι το Admin SDK.
 *
 * See ADR-298 §4 (harness) + ADR-655 (asset packs).
 *
 * 2026-07-31 (ADR-738): το σώμα του κελιού πέρασε στο `_harness/deny-all-suite`.
 * Ήταν κατά λέξη ίδιο με το accounting-invoice-counters — και θα γινόταν επτά
 * φορές ίδιο μόλις προστέθηκαν οι πέντε συλλογές OAuth. Το ωφέλιμο φορτίο
 * (`status: 'entitled'`) δεν χάθηκε ως κάλυψη: με `if false` ο κανόνας κόβει
 * πριν κοιτάξει έγγραφο, άρα κανένα κελί δεν το διάβαζε ποτέ.
 */

import { FIRESTORE_RULES_COVERAGE } from '../_registry/coverage-manifest';
import { defineDenyAllCell, useDenyAllEmulator } from '../_harness/deny-all-suite';

export const COVERAGE = FIRESTORE_RULES_COVERAGE.find(
  (c) => c.collection === 'asset_pack_config',
)!;

describe('asset_pack_config.rules — the distribution switch is not client-readable', () => {
  const env = useDenyAllEmulator();

  for (const cell of COVERAGE.matrix) {
    defineDenyAllCell(env, cell, COVERAGE.collection);
  }
});
