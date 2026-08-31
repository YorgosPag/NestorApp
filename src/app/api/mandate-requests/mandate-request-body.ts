/**
 * @fileoverview **ΤΟ ΣΩΜΑ ΠΟΥ ΔΕΧΕΤΑΙ Η ΠΟΡΤΑ ΤΟΥ Σ1** — το σύνορο, εκτελέσιμο.
 * @related app/api/mandate-requests/route.ts · types/mandate-request.ts · ADR-832
 * @module app/api/mandate-requests/mandate-request-body
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΒΓΗΚΕ ΑΠΟ ΤΟ `route.ts` — ΓΙΑ ΝΑ ΜΠΟΡΕΙ ΝΑ ΚΟΚΚΙΝΙΣΕΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το σχήμα ζούσε **μέσα** στη διαδρομή, δίπλα σε `server-only`, Firebase Admin και
 * middleware — δηλαδή **καμία άγκυρα δεν μπορούσε να το εκτελέσει** χωρίς να σύρει
 * μισή εφαρμογή. Και επειδή δεν εκτελούνταν ποτέ, **έμεινε πίσω από τον τύπο για
 * μήνες** *(ADR-832: δύο πεδία προστέθηκαν στους όρους και εδώ δεν έφτασαν ποτέ)*.
 *
 * 🔑 **Το σύνορο είναι ο ΜΟΝΟΣ τόπος όπου ο μεταγλωττιστής δεν βοηθά.** Μέσα στο
 * TypeScript, `ProposedMandateTerms` σημαίνει πέντε πεδία και τελείωσε. Στο σύρμα
 * σημαίνει ό,τι δηλώσει **αυτό** το αρχείο — και ό,τι δεν δηλωθεί, το zod το
 * **αφαιρεί σιωπηλά**. Δύο αλήθειες, καμία σύγκρουση, μηδέν κόκκινο.
 *
 * **Layering**: leaf — μόνο zod και κλειστά σύνολα· **κανένα** `server-only`, καμία
 * ανάγνωση, κανένα ρολόι.
 */

import { z } from 'zod';

import { LISTING_AGREEMENTS } from '@/types/listing-agreement';
import { OFFER_KINDS } from '@/types/property-offers';

/**
 * **Οι όροι, όπως τους προτείνει ο ΙΔΙΩΤΗΣ** (Δ5).
 *
 * ⚠️ **Διακριτή ένωση για την αμοιβή, ποτέ πεδία με `null`** — ίδιο σχήμα με τον τύπο
 * {@link MandateCompensation}. Ένα «ποσοστό χωρίς ποσοστό» πρέπει να είναι **αδύνατο
 * να εκφραστεί**, όχι να απορρίπτεται από έλεγχο που κάποιος θα ξεχάσει.
 *
 * ⚠️ **Το `expiresAt` ΔΕΝ ελέγχεται εδώ ως προς τον νόμο.** Ο κριτής είναι το
 * `exceedsStatutoryTerm`, μέσω των αμετάβλητων του αιτήματος — ο **ίδιος** που κρίνει
 * τη φόρμα. Δεύτερο όριο γραμμένο εδώ θα ήταν ο **τρίτος** αριθμός για το ίδιο ερώτημα.
 *
 * 🔴 **ΤΟ `scope` ΔΕΝ ΕΧΕΙ `.min(1)`, ΚΑΙ ΕΙΝΑΙ Ο ΙΔΙΟΣ ΚΑΝΟΝΑΣ ΜΕ ΤΟ `ownerPropertyId`**
 * *(δες την κεφαλίδα του `route.ts`, §5.16)*: το *«για ποιες πράξεις;»* το απαντά ο
 * **γραφέας**, με **όνομα** (`request-scope-unset`), που γίνεται κλειδί i18n. Ένα
 * `min(1)` εδώ θα το απαντούσε **πρώτο**, ως `MALFORMED_BODY`, και θα έκανε τον
 * ονομαστικό λόγο **ανεκτέλεστο** — κάλυψη σε **νεκρό** κλάδο.
 *
 * ⚠️ Το `max` **μένει**: είναι **μορφή**, φρουρός πόρου — όχι κρίση.
 */
export const mandateRequestTermsSchema = z.object({
  agreement: z.enum(LISTING_AGREEMENTS),
  expiresAt: z.string().max(64),
  /**
   * 🔴 **ADR-832, ΚΑΙ ΕΛΕΙΠΕ ΑΠΟ ΤΗΝ ΠΟΡΤΑ** — δες
   * {@link PROPOSED_MANDATE_TERM_FIELDS} για το περιστατικό.
   */
  startsAt: z.string().max(64),
  scope: z.array(z.enum(OFFER_KINDS)).max(OFFER_KINDS.length),
  compensation: z.discriminatedUnion('type', [
    z.object({
      type: z.literal('percentage'),
      percentage: z.number().nonnegative().max(100),
      vatIncluded: z.boolean(),
    }),
    z.object({
      type: z.literal('fixed'),
      amountEUR: z.number().nonnegative(),
      vatIncluded: z.boolean(),
    }),
  ]),
});

export const mandateRequestBodySchema = z.object({
  ownerPropertyId: z.string().max(128),
  agencyCompanyId: z.string().max(128),
  terms: mandateRequestTermsSchema,
});
