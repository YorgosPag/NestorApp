/**
 * @fileoverview **ΟΙ ΔΥΟ ΡΙΖΕΣ ΕΝΟΣ ΑΚΙΝΗΤΟΥ** — από ποια πλευρά ήρθε: ιδιώτης ή εταιρεία.
 * @related ADR-777 §7 · ADR-841 Α22 · ADR-884 Φ0.1 · CHECK 3.73
 * @module constants/place-sources
 *
 * Η δημόσια αγγελία έχει **δύο** ρίζες: `owner_properties` (ιδιώτης/μεσίτης, κάτοχος παράγεται από
 * τη θεματοφυλακή) και `properties` (εταιρεία). Κάθε σύστημα που δένεται σε «ακίνητο» δένεται σε
 * **ρίζα με είδος**, ποτέ σε σκέτο id — ίδιο id σε άλλη ρίζα είναι **άλλο** ακίνητο.
 *
 * 🔑 **Μετακόμισε εδώ από το `services/demand/place-interest.service.ts`** (ADR-884 Κ1): η χωρική
 * περιήγηση χρειάζεται το **ίδιο** λεξιλόγιο, και ένας τύπος/φύλλο δεν εισάγει από υπηρεσία. Η υπηρεσία
 * το επανεξάγει, ώστε κανένας από τους υπάρχοντες καταναλωτές να μην αλλάξει.
 *
 * **Layering**: leaf — καμία εξάρτηση. Ασφαλές για server, client, tests.
 */

/** Από ποια πλευρά ήρθε το ακίνητο. **Ονομασμένο**, ώστε η αναφορά να μη μαντεύει. */
export const PLACE_SOURCES = ['owner-property', 'company-property'] as const;

export type PlaceSource = (typeof PLACE_SOURCES)[number];

/** Η τιμή είναι ρίζα του λεξιλογίου; */
export function isPlaceSource(value: unknown): value is PlaceSource {
  return typeof value === 'string' && (PLACE_SOURCES as readonly string[]).includes(value);
}
