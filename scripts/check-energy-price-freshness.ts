/**
 * ΠΥΛΗ ΦΡΕΣΚΑΔΑΣ ΤΩΝ ΤΙΜΩΝ ΑΝΑΦΟΡΑΣ ΕΝΕΡΓΕΙΑΣ (ADR-777 §8.95.10)
 * ===============================================================
 * Ρωτά «πόσες ημέρες μένουν ως τη μέρα που η εκτίμηση κόστους σβήνει στην παραγωγή;» για κάθε πηγή με τιμή.
 * Η λογική ζει στο `src/lib/energy-cost/energy-price-freshness.ts` — εδώ μόνο τυπώνεται και κρίνεται ο κωδικός εξόδου.
 *
 * ΧΡΗΣΗ:  npm run energy-prices:freshness            (τοπικά· τρέχει και στο `energy-prices-refresh.yml`)
 * ΕΞΟΔΟΣ: 0 = ok ή ⚠️ (annotation `::warning`) · 1 = ❌ (annotation `::error`)
 */

import {
  energyPriceFreshness,
  FRESHNESS_ERROR_DAYS_LEFT,
  FRESHNESS_WARN_DAYS_LEFT,
  worstFreshnessLevel,
  type SourceFreshness,
} from '../src/lib/energy-cost/energy-price-freshness';
import { ENERGY_REFERENCE_PRICES } from '../src/lib/energy-cost/energy-reference-prices';

const MARK = { ok: '✅', warn: '⚠️', error: '❌' } as const;
const inCi = process.env.GITHUB_ACTIONS === 'true';

function describeRow(row: SourceFreshness): string {
  const days = row.daysLeft === null ? 'δεν μετριέται' : `${row.daysLeft} ημέρες ως τη λήξη`;
  return `${row.source.padEnd(12)} νεότερο ${row.newest ?? '—'} · λήγει ${row.expiresOn ?? '—'} · ${days}`;
}

function main(): void {
  const today = new Date().toISOString().slice(0, 10);
  const rows = energyPriceFreshness(ENERGY_REFERENCE_PRICES, today);
  console.log(`Φρεσκάδα τιμών αναφοράς (${today}) — ⚠️ ≤ ${FRESHNESS_WARN_DAYS_LEFT} · ❌ ≤ ${FRESHNESS_ERROR_DAYS_LEFT} ημέρες`);
  for (const row of rows) {
    console.log(`  ${MARK[row.level]} ${describeRow(row)}`);
    if (inCi && row.level !== 'ok') {
      console.log(`::${row.level === 'error' ? 'error' : 'warning'} title=Energy reference prices::${describeRow(row)}`);
    }
  }
  if (worstFreshnessLevel(rows) === 'error') {
    console.error('❌ Οι τιμές αναφοράς πλησιάζουν ή πέρασαν τη λήξη: npm run energy-prices:refresh (ADR-777 §8.95.10).');
    process.exit(1);
  }
}

main();
