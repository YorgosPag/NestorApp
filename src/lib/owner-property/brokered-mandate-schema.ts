/**
 * @fileoverview **Η ΕΝΤΟΛΗ ΟΠΩΣ ΦΤΑΝΕΙ ΑΠΟ ΤΟ ΔΙΚΤΥΟ** — τι επιτρέπεται να δηλώσει ο μεσίτης.
 * @related ADR-777 §8.33 · services/mandate/brokered-listing.service.ts
 * @module lib/owner-property/brokered-mandate-schema
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΡΙΑ ΠΕΔΙΑ ΔΕΝ ΕΙΝΑΙ ΕΔΩ, ΚΑΙ Η ΑΠΟΥΣΙΑ ΤΟΥΣ ΕΙΝΑΙ Ο ΦΡΟΥΡΟΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * | Δεν γίνεται δεκτό | Γιατί |
 * |---|---|
 * | `confirmation` | Θα σήμαινε ότι ο μεσίτης γράφει «εγκεκριμένο» για λογαριασμό του πελάτη. Παράγεται από τον **δρόμο απόδειξης** (`initialConfirmationFor`) |
 * | `consentNonce` · `decidedAt` · `notifiedAt` | Είναι **γεγονότα του συστήματος**, όχι δηλώσεις. Ένα `decidedAt` από το δίκτυο θα έλεγε «μίλησε στις…» για συνομιλία που δεν έγινε |
 * | `attestedByUserId` | Έρχεται από το `ctx.uid`, **ποτέ** από το σώμα: αλλιώς κάθε υπάλληλος μπορεί να βεβαιώσει στο όνομα συναδέλφου |
 *
 * 🔑 **Ό,τι δεν είναι στο σχήμα δεν μπορεί να σταλεί** — η ίδια άμυνα που κάνει το
 * `OwnerPropertyDraft` αδύνατο να κουβαλήσει `authorUserId`.
 */

import { z } from 'zod';

import { LISTING_AGREEMENTS, type ListingAgreement } from '@/types/listing-agreement';
import {
  AGENCY_ATTESTATION,
  OWNER_CONSENT,
  type MandateCompensation,
  type MandateProofVia,
} from '@/types/owner-property-mandate';

/**
 * **Οι όροι αμοιβής, όπως φτάνουν από το δίκτυο** (ADR-827 Α5).
 *
 * 🔑 `discriminatedUnion` **και εδώ**, όχι μόνο στον τύπο: ο τύπος δεν φυλά τίποτα σε
 * χρόνο εκτέλεσης, και ένα σώμα `{ type: 'fixed', percentage: 2 }` θα περνούσε αθόρυβα
 * σε αφελές σχήμα. Η ίδια άμυνα με το `decisionFrom` της `api/mandate/[token]`.
 *
 * ⚠️ **Θετικοί αριθμοί, και το ποσοστό ≤ 100.** Αρνητική αμοιβή δεν είναι όρος που
 * κάποιος συμφώνησε — είναι πληκτρολόγηση ή επίθεση.
 */
const compensationSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('percentage'),
    percentage: z.number().positive().max(100),
    vatIncluded: z.boolean(),
  }),
  z.object({
    type: z.literal('fixed'),
    amountEUR: z.number().positive(),
    vatIncluded: z.boolean(),
  }),
]);

/** Το αίτημα εντολής, όπως φτάνει από το δίκτυο. */
export const brokeredMandateSchema = z.object({
  clientContactId: z.string().min(1),
  /** ISO ημερομηνία λήξης — η **συμφωνία**, όχι ρολόι. */
  expiresAt: z.string().min(1),
  via: z.enum([OWNER_CONSENT, AGENCY_ATTESTATION]),
  /**
   * **Τι είδους εντολή** (ADR-827 §3.1). Χωρίς προεπιλογή **στο σχήμα**: η προεπιλογή
   * είναι απόφαση της **φόρμας** (`DEFAULT_LISTING_AGREEMENT`), και ένα `.default()`
   * εδώ θα σήμαινε ότι αίτημα **χωρίς** τον όρο δεσμεύει τον ιδιοκτήτη σε όρο που
   * κανείς δεν του έδειξε.
   */
  agreement: z.enum(LISTING_AGREEMENTS),
  compensation: compensationSchema,
  /**
   * Μονοπάτι του σαρωμένου εγγράφου εντολής. **Προαιρετικό** — η βεβαίωση στέκει με
   * όνομα και ώρα, όπως ακριβώς στο MLS, όπου το χαρτί δεν ανεβαίνει καν.
   */
  documentPath: z.string().nullable().optional(),
});

export interface BrokeredMandateInput {
  readonly clientContactId: string;
  readonly expiresAt: string;
  readonly via: MandateProofVia;
  readonly documentPath: string | null;
  readonly agreement: ListingAgreement;
  readonly compensation: MandateCompensation;
}

/**
 * Το σώμα → {@link BrokeredMandateInput}, ή **ποια μονοπάτια** δεν διαβάστηκαν.
 *
 * ⚠️ **Δεν κρίνει αν η λήξη είναι στο μέλλον** — αυτό είναι invariant του **μοντέλου**
 * (`mandate-expiry-past`) και τρέχει από την **ίδια** συνάρτηση που θα κρίνει και η
 * φόρμα. Ένας δεύτερος έλεγχος εδώ θα ήταν δεύτερος κριτής για το ίδιο ερώτημα, και
 * θα απέκλινε στην πρώτη αλλαγή πολιτικής.
 */
export function brokeredMandateFromRequest(value: unknown):
  | { readonly ok: true; readonly mandate: BrokeredMandateInput }
  | { readonly ok: false; readonly malformed: readonly string[] } {
  const parsed = brokeredMandateSchema.safeParse(value);

  if (!parsed.success) {
    return {
      ok: false,
      malformed: [
        ...new Set(parsed.error.issues.map((issue) => `mandate.${issue.path.join('.')}`)),
      ],
    };
  }

  return {
    ok: true,
    mandate: {
      clientContactId: parsed.data.clientContactId,
      expiresAt: parsed.data.expiresAt,
      via: parsed.data.via,
      documentPath: parsed.data.documentPath ?? null,
      agreement: parsed.data.agreement,
      compensation: parsed.data.compensation,
    },
  };
}
