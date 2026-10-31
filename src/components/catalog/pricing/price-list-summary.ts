/**
 * **Η εικόνα ενός τιμοκαταλόγου τη στιγμή «τώρα»** — τρέχουσα · μελλοντικές · πρόχειρες · ιστορικό (ADR-923 §5.11 «3δ»).
 *
 * Καθαρό, πάνω στη **μία** χρονογραμμή (`publishedTimeline` / `versionAt`): το «έως» κάθε έκδοσης **παράγεται** από την
 * επόμενη δημοσιευμένη (SAP), ποτέ δεν αποθηκεύεται — άρα ούτε εδώ υπολογίζεται αλλιώς.
 *
 * @module components/catalog/pricing/price-list-summary
 */

import { publishedTimeline, versionAt, type TimelineEntry } from '@/subapps/catalog/pricing/version-timeline';
import type { PriceListVersionWire } from '@/subapps/catalog/types/pricing-views';

/** Πού βρίσκεται μια δημοσιευμένη έκδοση σε σχέση με το «τώρα». */
export type TimelinePhase = 'past' | 'current' | 'future';

export interface TimelineBand {
  readonly entry: TimelineEntry<PriceListVersionWire>;
  readonly phase: TimelinePhase;
}

export interface PriceListSummary {
  /** Η έκδοση που ισχύει **τώρα** (ή `null` πριν από την πρώτη δημοσίευση). */
  readonly current: PriceListVersionWire | null;
  /** Δημοσιευμένες με έναρξη στο μέλλον — η λίστα αλλάζει **χωρίς** εγγραφή όταν φτάσουν. */
  readonly future: readonly PriceListVersionWire[];
  /** Πρόχειρες, νεότερη πρώτη. */
  readonly drafts: readonly PriceListVersionWire[];
  /** Απορριφθείσες, νεότερη πρώτη — ιστορικό, ποτέ μέρος της χρονογραμμής. */
  readonly discarded: readonly PriceListVersionWire[];
  /** Η χρονογραμμή των δημοσιευμένων, με τη φάση της καθεμιάς. */
  readonly bands: readonly TimelineBand[];
  /** Υπάρχει **οποιαδήποτε** έκδοση; — τότε είδος και τύπος τιμής κλειδώνουν (`typeLockedInUse`). */
  readonly hasVersions: boolean;
}

function phaseOf(entry: TimelineEntry<PriceListVersionWire>, current: PriceListVersionWire | null, nowMs: number): TimelinePhase {
  if (entry.version.id === current?.id) return 'current';
  return entry.window.fromMs !== null && entry.window.fromMs > nowMs ? 'future' : 'past';
}

/**
 * Η θέση μιας έκδοσης **τώρα**· `null` αν δεν ανήκει στη χρονογραμμή (πρόχειρη, απορριφθείσα). Το αποθηκευμένο `superseded`
 * σημαίνει «ήρθε νεότερη δημοσίευση», ακόμη και μελλοντική, άρα μόνο του δείχνει «Αντικατεστημένη» την έκδοση που **ισχύει**.
 */
export function phaseOfVersion(summary: PriceListSummary, versionId: string): TimelinePhase | null {
  return summary.bands.find((band) => band.entry.version.id === versionId)?.phase ?? null;
}

const newestFirst = (versions: readonly PriceListVersionWire[]): PriceListVersionWire[] => [...versions].sort((a, b) => b.number - a.number);

/** Η σύνοψη της λίστας `priceListId` από **όλες** τις εκδόσεις της όψης. */
export function summarizePriceList(priceListId: string, versions: readonly PriceListVersionWire[], nowMs: number): PriceListSummary {
  const own = versions.filter((version) => version.priceListId === priceListId);
  const current = versionAt(own, nowMs);
  const bands = publishedTimeline(own).map((entry) => ({ entry, phase: phaseOf(entry, current, nowMs) }));
  return {
    current,
    future: bands.filter((band) => band.phase === 'future').map((band) => band.entry.version),
    drafts: newestFirst(own.filter((version) => version.status === 'draft')),
    discarded: newestFirst(own.filter((version) => version.status === 'discarded')),
    bands,
    hasVersions: own.length > 0,
  };
}
