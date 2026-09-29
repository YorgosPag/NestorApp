/**
 * @jest-environment node
 *
 * ADR-890 §14 — **οι φρουροί πάνω στα ΠΡΑΓΜΑΤΙΚΑ αρχεία του `public/`**, όχι σε κατασκευασμένα δείγματα:
 *
 * 1. **Αντι-σάπιση των σταθερών ορίων** (§14.2): καμία κλάση δεν αδειάζει. Αν η αγορά ξεφύγει (το Λονδίνο πέρασε τις
 *    £500k και ο χάρτης LSOA επέκτεινε τις ζώνες του), αυτό κοκκινίζει και τα όρια αλλάζουν **συνειδητά**, με γραμμή
 *    στο ADR — ποτέ σιωπηλά με την επόμενη έκδοση των δεδομένων.
 * 2. **Κάθε περιοχή με τιμή έχει σχήμα στον χάρτη** — αλλιώς θα έμενε άβαφη χωρίς εξήγηση.
 * 3. **Το συγκεντρωτικό είναι ΠΡΟΒΟΛΗ του `summary/`** — ο χάρτης και η σελίδα περιοχής δεν διαφωνούν ποτέ.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { readAdminOverviewFile, type AdminOverviewFile } from '@/lib/geo/admin-overview-file';
import { MARKET_TRANSACTIONS_PRICE_MAP_PUBLIC_PATH, marketTransactionsPublicPath, readAreaSummaryFile } from '@/lib/market/market-transactions-file';
import type { MarketSegment } from '@/lib/market/market-segments';
import { PRICE_MAP_BREAKS, priceMapCellOf, priceMapClassOf, priceMapMedian, readContractPriceMapFile } from '@/lib/market/price-map';

const PUBLIC = join(process.cwd(), 'public');
const read = (path: readonly string[]): unknown => JSON.parse(readFileSync(join(PUBLIC, ...path), 'utf8'));

const priceMap = readContractPriceMapFile(read(MARKET_TRANSACTIONS_PRICE_MAP_PUBLIC_PATH));
const overview = (tier: string): AdminOverviewFile | null => readAdminOverviewFile(read(['data', 'admin-overview', `${tier}.json`]));

/** Ελάχιστο μερίδιο περιοχών ανά κλάση. Μετρημένο 2026-09-28: 10–35% σε κάθε τμήμα × βαθμίδα. */
const MIN_CLASS_SHARE = 0.05;
/** Κάτω από τόσες περιοχές με τιμή, ένα ποσοστό δεν λέει τίποτα — ο φρουρός σωπαίνει ρητά. */
const MIN_AREAS_FOR_SHARE = 30;

describe('price-map — πραγματικά αρχεία', () => {
  it('τα αρχεία διαβάζονται με το σχήμα τους (αλλιώς ο χάρτης λέει «μη διαθέσιμο» σε όλους)', () => {
    expect(priceMap).not.toBeNull();
    expect(overview('municipality')?.features.length).toBeGreaterThan(300);
    expect(overview('municipal_unit')?.features.length).toBeGreaterThan(1000);
  });

  it.each(Object.keys(PRICE_MAP_BREAKS.sale) as MarketSegment[])('αντι-σάπιση ορίων πώλησης: %s — καμία κλάση κάτω από 5%%', (segment) => {
    const breaks = PRICE_MAP_BREAKS.sale[segment] ?? [];
    const medians = Object.entries(priceMap?.areas ?? {})
      .filter(([id]) => id.startsWith('municipality:'))
      .map(([, segments]) => priceMapMedian(segments[segment]))
      .filter((median): median is number => median !== null);
    expect(medians.length).toBeGreaterThanOrEqual(MIN_AREAS_FOR_SHARE);
    const counts = [0, 0, 0, 0, 0];
    for (const median of medians) counts[priceMapClassOf(breaks, median)] += 1;
    for (const count of counts) expect(count / medians.length).toBeGreaterThanOrEqual(MIN_CLASS_SHARE);
  });

  it('κάθε περιοχή με τιμή έχει σχήμα στον χάρτη — ή καλύπτεται από Δήμο-φύλλο με τα ίδια νούμερα', () => {
    const drawn = new Set([...(overview('municipality')?.features ?? []), ...(overview('municipal_unit')?.features ?? [])].map((f) => f.properties.id));
    const missing = Object.keys(priceMap?.areas ?? {}).filter((id) => !drawn.has(id));
    // Η Δ.Ε. Νεμέας λείπει από την πηγή ορίων (μετρημένο 2026-09-28)· φύλλο της είναι ο Δήμος, με το ίδιο άθροισμα.
    expect(missing).toEqual(['municipal_unit:420401']);
    expect(priceMap?.areas['municipality:4204']).toEqual(priceMap?.areas['municipal_unit:420401']);
  });

  it('το συγκεντρωτικό είναι ΠΡΟΒΟΛΗ του 12μήνου των αρχείων περιοχής (δείγμα)', () => {
    for (const id of ['municipality:4501', 'municipality:0701', 'municipal_unit:010101']) {
      const summary = readAreaSummaryFile(read(marketTransactionsPublicPath('summary', id)), id);
      for (const [segment, value] of Object.entries(summary?.segments ?? {})) {
        expect(priceMap?.areas[id]?.[segment as MarketSegment] ?? null).toEqual(priceMapCellOf(value?.last12));
      }
    }
  });
});
