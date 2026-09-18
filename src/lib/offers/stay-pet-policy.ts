/**
 * @fileoverview **Η ΠΟΛΙΤΙΚΗ ΚΑΤΟΙΚΙΔΙΩΝ — ΕΝΑ ΣΧΗΜΑ, ΕΝΑΣ ΑΝΑΓΝΩΣΤΗΣ.**
 * @related ADR-777 §8.60.21 · types/property-offers.ts (`StayPetPolicy`) ·
 *   lib/offers/offer-amount.ts (όρια) · lib/stay/stay-availability.ts (`petsVerdict`)
 * @module lib/offers/stay-pet-policy
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ ΕΝΑ ΣΧΗΜΑ ΓΙΑ ΤΡΕΙΣ ΠΟΡΤΕΣ
 * ────────────────────────────────────────────────────────────────────────────
 * Η πολιτική μπαίνει από **τρεις** πόρτες: το σώμα του αιτήματος (σύνορο δικτύου,
 * `owner-property-draft-schema.ts`), το έγγραφο του κατόχου στην προβολή
 * (`derive-stay-terms.ts`), και το αποθηκευμένο δημόσιο έγγραφο (κρίκος 13,
 * `public-listing-schema.ts`). Τρεις γραπτοί αναλυτές θα διαφωνούσαν την πρώτη φορά που
 * προστίθεται πεδίο — το σχήμα του ADR-749. Εδώ ζει **ο ένας**.
 *
 * ⚠️ **Το σχήμα κρίνει ΜΟΡΦΗ, όχι εύρος.** «5,5 κατοικίδια» ή «χρέωση 900 € σε κατάλυμα
 * των 60 €» **διαβάζονται** — και τα ονομάζει ο κριτής των κενών (`offerMaxPetsInvalid` ·
 * `offerPetFeeInvalid`), ώστε η οθόνη να πει **ποιο** πεδίο, αντί για `400 MALFORMED_BODY`.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, μηδέν I/O.
 */

import { z } from 'zod';

import {
  PET_FEE_BASES,
  type PetFeeBasis,
  type StayPetPolicy,
} from '@/types/property-offers';

const petFeeSchema = z.object({
  amount: z.number().finite(),
  per: z.enum(PET_FEE_BASES as unknown as [PetFeeBasis, ...PetFeeBasis[]]),
});

/** Τα πεδία του «ναι»/«κατόπιν συνεννόησης» — **κοινά**, γραμμένα μία φορά. */
const acceptingShape = {
  maxPets: z.number().finite().nullable(),
  fee: petFeeSchema.nullable(),
};

/**
 * **Το σχήμα της πολιτικής**, ως διακριτή ένωση στο `accepts` — ίδιο με τον τύπο.
 *
 * 🔑 Το «όχι» είναι `strict` **επίτηδες**: ένα `{ accepts: 'no', fee }` δεν είναι «όχι με
 * σημείωση», είναι αντίφαση — και ο τύπος ήδη λέει ότι δεν εκφράζεται.
 */
export const stayPetPolicySchema: z.ZodType<StayPetPolicy> = z.discriminatedUnion('accepts', [
  z.object({ accepts: z.literal('no') }).strict(),
  z.object({ accepts: z.literal('yes'), ...acceptingShape }),
  z.object({ accepts: z.literal('onRequest'), ...acceptingShape }),
]);

/**
 * **Αποθηκευμένη τιμή → πολιτική, ή `null` («δεν δηλώθηκε»).**
 *
 * 🔴 **Χαλασμένη τιμή ⇒ `null`, ποτέ «όχι»**: ένα έγγραφο που δεν διαβάζεται δεν λέει τίποτα
 * για τα κατοικίδια, και το «δεν ξέρουμε» έχει ήδη όνομα (`pets-unknown`). Ένα σιωπηλό
 * «όχι» θα έδιωχνε επισκέπτες από κατάλυμα που ίσως τους δέχεται.
 */
export function readStayPetPolicy(raw: unknown): StayPetPolicy | null {
  if (raw === null || raw === undefined) return null;
  const parsed = stayPetPolicySchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
