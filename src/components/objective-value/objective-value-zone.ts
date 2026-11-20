/**
 * @fileoverview **Η τιμή ζώνης του δημόσιου υπολογιστή** — η ετυμηγορία του browser + η χειροκίνητη τιμή (ADR-898 Φ2).
 * @related `lib/objective-value/objective-value-zone.ts` (ο κοινός κανόνας ζώνης/μετώπου, και του server) ·
 *   `hooks/market/useValueZoneAt.ts`
 * @module components/objective-value/objective-value-zone
 *
 * 🔑 **Η χειροκίνητη τιμή μετρά μόνο όταν ΔΕΝ βρέθηκε ζώνη** (καμία θέση ακόμη · κατά προσέγγιση · εκτός ζωνών ·
 * αποτυχία). Με έτοιμη ζώνη αγνοείται — αλλιώς ένα ξεχασμένο πεδίο θα υπερίσχυε σιωπηλά του χάρτη.
 *
 * 🔑 **Ο ΣΕ έρχεται με την τιμή** (ADR-898 Φ5): η ζώνη ή το δηλωμένο μέτωπο φέρνουν τον δικό τους· η χειροκίνητη τιμή
 * δεν ξέρει ΣΕ ⇒ `unknown`, και ο άνθρωπος ρωτιέται.
 */

import type { ValueZoneLookup } from '@/hooks/market/useValueZoneAt';
import { UNKNOWN_COMMERCIALITY } from '@/lib/market/value-zone-file';
import { zoneCandidateOf, type ZoneCandidate } from '@/lib/objective-value/objective-value-zone';

export function chosenZone(lookup: ValueZoneLookup, frontKey: string | null, manualPrice: number | null): ZoneCandidate | null {
  if (lookup.kind !== 'answered' || lookup.verdict.kind !== 'ready') {
    return manualPrice === null ? null : { price: manualPrice, commerciality: UNKNOWN_COMMERCIALITY };
  }
  return zoneCandidateOf(lookup.verdict, frontKey);
}
