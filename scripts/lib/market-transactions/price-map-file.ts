/**
 * @fileoverview **Το συγκεντρωτικό του χάρτη τιμών από τα αρχεία περιοχών** — 12μηνο ανά περιοχή × τμήμα (ADR-890 §14.4).
 * @related `src/lib/market/price-map.ts` (σχήμα + κελί) · `area-summary.ts` (η πηγή των κελιών)
 * @module scripts/lib/market-transactions/price-map-file
 *
 * 🔑 **Προβολή, όχι δεύτερος υπολογισμός**: το κελί είναι το **ίδιο** `last12` που δείχνει η σελίδα περιοχής — ο
 * χάρτης και η σελίδα δεν μπορούν να διαφωνήσουν για τον αριθμό. Ντετερμινιστικό: ταξινομημένα κλειδιά, κανένα ρολόι.
 */

import type { AreaSummaryFile } from '../../../src/lib/market/market-transactions-file';
import type { MarketSegment } from '../../../src/lib/market/market-segments';
import {
  PRICE_MAP_FORMAT_VERSION,
  priceMapSegmentsOf,
  type ContractPriceMapFile,
  type PriceMapSegments,
} from '../../../src/lib/market/price-map';
import type { StatCell } from '../../../src/lib/market/market-statistics';

export function buildContractPriceMapFile(summaries: readonly AreaSummaryFile[], asOf: string): ContractPriceMapFile {
  const areas: Record<string, PriceMapSegments> = {};
  for (const summary of [...summaries].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
    const cells: Partial<Record<MarketSegment, StatCell>> = {};
    for (const [segment, value] of Object.entries(summary.segments)) {
      if (value !== undefined) cells[segment as MarketSegment] = value.last12;
    }
    const segments = priceMapSegmentsOf(cells);
    if (Object.keys(segments).length > 0) areas[summary.id] = segments;
  }
  return { v: PRICE_MAP_FORMAT_VERSION, asOf, areas };
}
