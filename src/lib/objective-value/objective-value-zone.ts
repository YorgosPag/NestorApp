/**
 * @fileoverview **Ποια τιμή ζώνης μπαίνει στον υπολογισμό** — καθαρές συναρτήσεις πάνω στην ετυμηγορία ζώνης, κοινές
 * σε browser (δημόσιος υπολογιστής, ADR-898 Φ2) και server (αγγελία, ADR-898 Φ3).
 * @related `lib/market/value-zone-at-point.ts` (η ετυμηγορία, με τα μέτωπα υπό όρο) ·
 *   `components/objective-value/objective-value-zone.ts` (η χειροκίνητη τιμή του υπολογιστή) · `objective-value-bounds.ts`
 * @module lib/objective-value/objective-value-zone
 *
 * 🔑 **Το μέτωπο ισχύει μόνο αν ΔΗΛΩΘΕΙ** («έχει πρόσοψη στην οδό …»): η θέση δεν αποδεικνύει πρόσοψη (ADR-889 §10).
 * Χωρίς δήλωση ⇒ η τιμή της ζώνης που περικλείει το σημείο.
 *
 * 🔑 **Υποψήφια ΖΕΥΓΗ, όχι τιμές** (ADR-898 Φ5): ο ΣΕ της πηγής ανήκει στην τιμή του — η ζώνη έχει τον δικό της, κάθε
 * μέτωπο τον δικό του. Ένα σημείο αλήθειας που ρέει ως τη μηχανή (`objectiveValueBounds`).
 */

import type { ValueZoneFigure, ValueZoneFrontCandidate, ValueZoneVerdict } from '@/lib/market/value-zone-at-point';
import { formatNumber } from '@/lib/intl-formatting';
import type { CommercialityFact } from '@/lib/market/value-zone-file';

import type { ZoneFrontDeclaration } from './objective-value-declarations';

/** Σταθερή ταυτότητα μετώπου — η ίδια ζώνη μετώπου μπορεί να καλύπτει περισσότερους δρόμους. */
export function frontKeyOf(front: ValueZoneFrontCandidate): string {
  return `${front.id}|${front.street}`;
}

/** Μια τιμή ζώνης που μπορεί να ισχύει, **μαζί με τον ΣΕ της πηγής** για αυτήν. */
export interface ZoneCandidate {
  /** €/τ.μ. */
  readonly price: number;
  readonly commerciality: CommercialityFact;
}

function candidateOf(figure: ValueZoneFigure): ZoneCandidate {
  return { price: figure.price, commerciality: figure.commerciality };
}

function candidateKey({ price, commerciality }: ZoneCandidate): string {
  if (commerciality.kind === 'factor') return `${price}|f${commerciality.value}`;
  return commerciality.kind === 'document' ? `${price}|d${commerciality.url}` : `${price}|?`;
}

/** Ίδια τιμή **και** ίδιος ΣΕ ⇒ ένα ζεύγος (η μηχανή θα έδινε το ίδιο ποσό)· η σειρά της εισόδου μένει. */
function uniqueCandidates(candidates: readonly ZoneCandidate[]): readonly ZoneCandidate[] {
  const byKey = new Map<string, ZoneCandidate>();
  for (const candidate of candidates) if (!byKey.has(candidateKey(candidate))) byKey.set(candidateKey(candidate), candidate);
  return [...byKey.values()];
}

/** Ο ΣΕ όπως τον γράφει η πηγή («1,0», «1,4») — η ΙΔΙΑ μορφή στη σύνοψη ζώνης και στο αποτέλεσμα του υπολογιστή. */
export function formatCommercialityFactor(factor: number): string {
  return formatNumber(factor, { minimumFractionDigits: 1, maximumFractionDigits: 2 });
}

/** Η τιμή που ισχύει: του δηλωμένου μετώπου, αλλιώς της ζώνης· `null` όταν η ετυμηγορία δεν είναι έτοιμη. */
export function chosenFigureOf(verdict: ValueZoneVerdict, frontKey: string | null): ValueZoneFigure | null {
  if (verdict.kind !== 'ready') return null;
  const front = frontKey === null ? undefined : verdict.fronts.find((candidate) => frontKeyOf(candidate) === frontKey);
  return front ?? verdict.zone;
}

/**
 * ADR-947 Δ3 — **είναι αυτό το μέτωπο ακόμη υποψήφιο σε αυτή την ετυμηγορία;** Το στιγμιότυπο **δεν** δέχεται μέτωπο που
 * δεν υπάρχει (το `chosenFigureOf` θα έπεφτε σιωπηλά στη ζώνη — σωστό για την οθόνη, λάθος για ό,τι παγώνει).
 */
export function isCandidateFront(verdict: ValueZoneVerdict, frontKey: string): boolean {
  return verdict.kind === 'ready' && verdict.fronts.some((front) => frontKeyOf(front) === frontKey);
}

/** Το ζεύγος για το δηλωμένο μέτωπο, ή της ζώνης· `null` όταν η ετυμηγορία δεν είναι έτοιμη. */
export function zoneCandidateOf(verdict: ValueZoneVerdict, frontKey: string | null): ZoneCandidate | null {
  const figure = chosenFigureOf(verdict, frontKey);
  return figure === null ? null : candidateOf(figure);
}

/**
 * ADR-949 Α-3 — **η τιμή του χάρτη με την ημερομηνία ισχύος της**, για τη διασταύρωση με την τιμή ζώνης ενός εγγράφου
 * (πράξη ΕΝΦΙΑ). Μόνο από τα δεδομένα ζωνών: η χειροκίνητη τιμή είναι δήλωση του ανθρώπου, όχι μητρώο.
 */
export interface ObjectiveValueMapZone {
  /** €/τ.μ. */
  readonly price: number;
  /** `YYYY-MM-DD` — έναρξη ισχύος της τιμής. */
  readonly validFrom: string;
}

export function mapZoneOf(verdict: ValueZoneVerdict, frontKey: string | null): ObjectiveValueMapZone | null {
  const figure = chosenFigureOf(verdict, frontKey);
  return figure === null ? null : { price: figure.price, validFrom: figure.validFrom };
}

/**
 * **Όλα τα ζεύγη που μπορεί να ισχύουν** όσο η πρόσοψη στα μέτωπα δεν έχει δηλωθεί: η ζώνη, και κάθε μέτωπο υπό όρο
 * (ADR-889 §10.2: εμφανίζονται μόνο τα **ακριβότερα** της ζώνης). Πρώτη πάντα η ζώνη. Κενό όταν δεν υπάρχει ζώνη.
 */
export function zoneCandidates(verdict: ValueZoneVerdict): readonly ZoneCandidate[] {
  if (verdict.kind !== 'ready') return [];
  return uniqueCandidates([verdict.zone, ...verdict.fronts].map(candidateOf));
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
 * **Τα ζεύγη που μπορεί να ισχύουν, με τη δήλωση του αγγελιοδότη** (ADR-898 Φ3β): «καμία πρόσοψη σε μέτωπο» ⇒ η ζώνη ·
 * δρόμος που είναι ακόμη υποψήφιο μέτωπο ⇒ η τιμή του. Χωρίς δήλωση, ή με δρόμο που μια αναθεώρηση ζωνών έβγαλε από
 * τα μέτωπα ⇒ **όλες** οι υποψήφιες (ανοιχτό ⇒ όρια) — ποτέ μαντεψιά.
 */
export function declaredZoneCandidates(verdict: ValueZoneVerdict, zoneFront: ZoneFrontDeclaration | null): readonly ZoneCandidate[] {
  if (verdict.kind !== 'ready' || zoneFront === null) return zoneCandidates(verdict);
  if (zoneFront.kind === 'none') return [candidateOf(verdict.zone)];
  const street = uniqueCandidates(verdict.fronts.filter((front) => front.street === zoneFront.street).map(candidateOf));
  return street.length === 0 ? zoneCandidates(verdict) : street;
}
