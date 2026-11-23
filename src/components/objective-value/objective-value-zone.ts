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
import { chosenFigureOf, zoneCandidateOf, type ZoneCandidate } from '@/lib/objective-value/objective-value-zone';

export function chosenZone(lookup: ValueZoneLookup, frontKey: string | null, manualPrice: number | null): ZoneCandidate | null {
  if (lookup.kind !== 'answered' || lookup.verdict.kind !== 'ready') {
    return manualPrice === null ? null : { price: manualPrice, commerciality: UNKNOWN_COMMERCIALITY };
  }
  return zoneCandidateOf(lookup.verdict, frontKey);
}

/**
 * **Από πού ήρθε η τιμή ζώνης του υπολογισμού** — για το PDF της συσκευής (ADR-947 Φ2β). Ίδιος κανόνας με το
 * {@link chosenZone}: όταν οι ζώνες απάντησαν, μετρά η ζώνη ή το δηλωμένο μέτωπο· αλλιώς η χειροκίνητη τιμή.
 */
export function chosenZoneOrigin(lookup: ValueZoneLookup, frontKey: string | null): { readonly fromSource: boolean; readonly validFrom: string | null } {
  if (lookup.kind !== 'answered' || lookup.verdict.kind !== 'ready') return { fromSource: false, validFrom: null };
  return { fromSource: true, validFrom: chosenFigureOf(lookup.verdict, frontKey)?.validFrom ?? null };
}
