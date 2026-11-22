#!/usr/bin/env tsx
/**
 * @fileoverview **ΕΙΝΑΙ Ο ΧΑΡΤΗΣ ΓΕΜΗ ΤΡΕΧΩΝ;** — εργαλείο συντήρησης, μόνο ανάγνωση (ADR-948 §8 Βήμα 3).
 *
 * Διαβάζει τους δύο ζωντανούς καταλόγους (`/metadata/legalTypes`, `/metadata/companyStatuses`) μέσα από την
 * **ίδια** πόρτα της εφαρμογής (`fetchRegistryCatalogs`) και τους συγκρίνει με το στιγμιότυπο του
 * `src/config/company-registry/gemi-legal-forms.ts`. **Δεν γράφει τίποτα**: ο χάρτης ενημερώνεται από άνθρωπο,
 * με πηγή ανά γραμμή — όπως μια νέα έκδοση της λίστας ELF του GLEIF.
 *
 * Χρήση: `npm run gemi:catalog-diff`. Το κλειδί διαβάζεται από το περιβάλλον ή το `.env.local` — **ποτέ** από όρισμα.
 * Δύο κλήσεις ανά εκτέλεση (όριο 8/λεπτό ανά κλειδί, κοινό για όλη την πλατφόρμα).
 *
 * Κωδικοί εξόδου: `0` τρέχων · `1` υπάρχουν διαφορές · `2` το ΓΕΜΗ δεν απάντησε (καμία κρίση).
 */

import type { GemiCatalogDrift, GemiCatalogDriftKind } from '../src/lib/company/gemi-catalog-drift';
import { applyEnvLocal } from './_shared/loadEnvLocal';

const MEANING: Readonly<Record<GemiCatalogDriftKind, string>> = {
  added: 'ΝΕΟΣ κωδικός — ο φράχτης αρνείται (unmapped)· πρόσθεσε γραμμή με πηγή',
  'descr-changed': 'ΑΛΛΑΞΕ η περιγραφή — ο φράχτης αρνείται (catalog-drift)· ξανάκρινε τη γραμμή',
  'activity-changed': 'ΑΛΛΑΞΕ το isActive — ενημέρωσε το στιγμιότυπο',
  removed: 'λείπει από τον κατάλογο — η γραμμή ΜΕΝΕΙ (παλιές απαντήσεις μπορεί να τον φέρουν)',
  'descr-en-changed': 'άλλαξε μόνο η αγγλική περιγραφή — καμία κρίση δεν επηρεάζεται',
};

function printDrift(drift: GemiCatalogDrift): void {
  console.log(`  [${drift.catalog}] ${drift.id} · ${drift.kind}`);
  console.log(`      στιγμιότυπο: ${drift.snapshot ?? '—'}`);
  console.log(`      ζωντανό:     ${drift.live ?? '—'}`);
  console.log(`      ⇒ ${MEANING[drift.kind]}`);
}

async function main(): Promise<number> {
  applyEnvLocal();
  // Δυναμικά, ΜΕΤΑ το `.env.local`: ο client διαβάζει τη βάση URL τη στιγμή που φορτώνεται.
  const { fetchRegistryCatalogs } = await import('../src/services/company-registry/gemi-opendata.client');
  const { diffGemiCatalog } = await import('../src/lib/company/gemi-catalog-drift');
  const { GEMI_CATALOG_SNAPSHOT_DATE } = await import('../src/config/company-registry/gemi-legal-forms');

  const verdict = await fetchRegistryCatalogs();
  if (verdict.kind === 'unavailable') {
    console.error(`❌ Το ΓΕΜΗ δεν απάντησε (${verdict.reason}) — καμία κρίση για τον χάρτη.`);
    return 2;
  }

  const drifts = [...diffGemiCatalog('legalTypes', verdict.legalTypes), ...diffGemiCatalog('statuses', verdict.statuses)];
  console.log(`Στιγμιότυπο χάρτη: ${GEMI_CATALOG_SNAPSHOT_DATE} · ζωντανά: ${verdict.legalTypes.length} νομικές μορφές, ${verdict.statuses.length} καταστάσεις`);
  if (drifts.length === 0) {
    console.log('✅ Ο χάρτης είναι τρέχων — καμία διαφορά.');
    return 0;
  }
  console.log(`⚠️ ${drifts.length} διαφορές:`);
  drifts.forEach(printDrift);
  return 1;
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error('❌', error instanceof Error ? error.message : error);
    process.exit(2);
  },
);
