/**
 * @fileoverview **Η τιμή ζώνης του δημόσιου υπολογιστή** — η ετυμηγορία του browser + η χειροκίνητη τιμή (ADR-898 Φ2).
 * @related `lib/objective-value/objective-value-zone.ts` (ο κοινός κανόνας ζώνης/μετώπου, και του server) ·
 *   `hooks/market/useValueZoneAt.ts`
 * @module components/objective-value/objective-value-zone
 *
 * 🔑 **Η χειροκίνητη τιμή μετρά μόνο όταν ΔΕΝ βρέθηκε ζώνη** (καμία θέση ακόμη · κατά προσέγγιση · εκτός ζωνών ·
 * αποτυχία). Με έτοιμη ζώνη αγνοείται — αλλιώς ένα ξεχασμένο πεδίο θα υπερίσχυε σιωπηλά του χάρτη.
 */

import type { ValueZoneLookup } from '@/hooks/market/useValueZoneAt';
import { zonePriceOf } from '@/lib/objective-value/objective-value-zone';

export function chosenZonePrice(lookup: ValueZoneLookup, frontKey: string | null, manualPrice: number | null): number | null {
  if (lookup.kind !== 'answered' || lookup.verdict.kind !== 'ready') return manualPrice;
  return zonePriceOf(lookup.verdict, frontKey);
}
