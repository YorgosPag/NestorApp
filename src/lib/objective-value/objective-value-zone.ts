/**
 * @fileoverview **Ποια τιμή ζώνης μπαίνει στον υπολογισμό** — καθαρές συναρτήσεις πάνω στην ετυμηγορία ζώνης, κοινές
 * σε browser (δημόσιος υπολογιστής, ADR-898 Φ2) και server (αγγελία, ADR-898 Φ3).
 * @related `lib/market/value-zone-at-point.ts` (η ετυμηγορία, με τα μέτωπα υπό όρο) ·
 *   `components/objective-value/objective-value-zone.ts` (η χειροκίνητη τιμή του υπολογιστή) · `objective-value-bounds.ts`
 * @module lib/objective-value/objective-value-zone
 *
 * 🔑 **Το μέτωπο ισχύει μόνο αν ΔΗΛΩΘΕΙ** («έχει πρόσοψη στην οδό …»): η θέση δεν αποδεικνύει πρόσοψη (ADR-889 §10).
 * Χωρίς δήλωση ⇒ η τιμή της ζώνης που περικλείει το σημείο.
 */

import type { ValueZoneFrontCandidate, ValueZoneVerdict } from '@/lib/market/value-zone-at-point';

import type { ZoneFrontDeclaration } from './objective-value-declarations';

/** Σταθερή ταυτότητα μετώπου — η ίδια ζώνη μετώπου μπορεί να καλύπτει περισσότερους δρόμους. */
export function frontKeyOf(front: ValueZoneFrontCandidate): string {
  return `${front.id}|${front.street}`;
}

/** Η τιμή για το δηλωμένο μέτωπο, ή της ζώνης· `null` όταν η ετυμηγορία δεν είναι έτοιμη. */
export function zonePriceOf(verdict: ValueZoneVerdict, frontKey: string | null): number | null {
  if (verdict.kind !== 'ready') return null;
  const front = frontKey === null ? undefined : verdict.fronts.find((candidate) => frontKeyOf(candidate) === frontKey);
  return front === undefined ? verdict.zone.price : front.price;
}

/**
 * **Όλες οι τιμές που μπορεί να ισχύουν** όσο η πρόσοψη στα μέτωπα δεν έχει δηλωθεί: η ζώνη, και κάθε μέτωπο υπό όρο
 * (ADR-889 §10.2: εμφανίζονται μόνο τα **ακριβότερα** της ζώνης). Πρώτη πάντα η ζώνη. Κενό όταν δεν υπάρχει ζώνη.
 */
export function zonePriceCandidates(verdict: ValueZoneVerdict): readonly number[] {
  if (verdict.kind !== 'ready') return [];
  return [...new Set([verdict.zone.price, ...verdict.fronts.map((front) => front.price)])];
}

/**
 * Οι τιμές των μετώπων του δηλωμένου δρόμου σε αυτή την ετυμηγορία (ADR-898 Φ3β). Κενό ⇒ ο δρόμος δεν είναι (πια)
 * υποψήφιο μέτωπο. Περισσότερες από μία ⇒ ο ίδιος δρόμος έχει τμήματα με διαφορετική τιμή, και η δήλωση δεν τα ξεχωρίζει.
 */
export function streetFrontPrices(verdict: ValueZoneVerdict, street: string): readonly number[] {
  if (verdict.kind !== 'ready') return [];
  return [...new Set(verdict.fronts.filter((front) => front.street === street).map((front) => front.price))];
}

/**
 * **Οι πιθανές απαντήσεις στο «έχει πρόσοψη σε μέτωπο;»** (ADR-898 Φ3β-2): «κανένα», και κάθε υποψήφιος δρόμος μία
 * φορά, πλησιέστερος πρώτος. Η μία λίστα για την επιλογή της οθόνης **και** για το κέρδος κάθε ερώτησης.
 */
export function zoneFrontAnswers(verdict: ValueZoneVerdict): readonly ZoneFrontDeclaration[] {
  if (verdict.kind !== 'ready') return [];
  const streets = [...new Set(verdict.fronts.map((front) => front.street))];
  return [{ kind: 'none' }, ...streets.map((street) => ({ kind: 'street' as const, street }))];
}

/**
 * **Οι τιμές που μπορεί να ισχύουν, με τη δήλωση του αγγελιοδότη** (ADR-898 Φ3β): «καμία πρόσοψη σε μέτωπο» ⇒ η ζώνη ·
 * δρόμος που είναι ακόμη υποψήφιο μέτωπο ⇒ η τιμή του. Χωρίς δήλωση, ή με δρόμο που μια αναθεώρηση ζωνών έβγαλε από
 * τα μέτωπα ⇒ **όλες** οι υποψήφιες (ανοιχτό ⇒ όρια) — ποτέ μαντεψιά.
 */
export function declaredZonePriceCandidates(verdict: ValueZoneVerdict, zoneFront: ZoneFrontDeclaration | null): readonly number[] {
  if (verdict.kind !== 'ready' || zoneFront === null) return zonePriceCandidates(verdict);
  if (zoneFront.kind === 'none') return [verdict.zone.price];
  const prices = streetFrontPrices(verdict, zoneFront.street);
  return prices.length === 0 ? zonePriceCandidates(verdict) : prices;
}
