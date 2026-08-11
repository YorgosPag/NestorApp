/**
 * @fileoverview **ΤΟ ΣΥΝΟΡΟ ΤΟΥ ΔΙΑΚΟΜΙΣΤΗ** — ό,τι φτάνει από το δίκτυο είναι `unknown`.
 * @related ADR-777 §7 (Α14 · Α20) · types/owner-property.ts · CLAUDE.md N.2
 * @module lib/owner-property/owner-property-draft-schema
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΔΕΥΤΕΡΟ ΣΧΗΜΑ, ΕΝΩ ΥΠΑΡΧΕΙ ΤΟ `ownerPropertyFormSchema`
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Δεν είναι διπλότυπο — είναι **δύο σύνορα με διαφορετικό σχήμα εισόδου**, και η
 * διαφορά ζει ήδη γραμμένη στο `owner-property-form-values.ts`: η **φόρμα** είναι
 * **επίπεδη** (τρία ποσά δίπλα-δίπλα, ώστε ο άνθρωπος να μη χάνει ό,τι έγραψε), το
 * **έγγραφο** είναι **διακριτές ενώσεις** (ένα `percentage` πάνω σε πώληση είναι
 * αδύνατο). Το πρώτο σχήμα κρίνει *ό,τι πληκτρολογεί άνθρωπος*· αυτό κρίνει *ό,τι
 * φτάνει από το δίκτυο*.
 *
 * 🔑 **Και οι δύο τροφοδοτούν τον ΙΔΙΟ κριτή κανόνων**
 * ({@link ownerPropertyInvariantViolations}). Το σχήμα απαντά *«είναι αριθμός;»*· οι
 * κανόνες *«είναι έγκυρη αγγελία;»* — και ο δεύτερος γράφεται **μία** φορά, στην
 * οντότητα.
 *
 * ⚠️ **ΔΕΝ δέχεται `ownerUserId`, `lifecycle`, `createdAt`.** Δεν είναι παράλειψη: αν
 * τα δεχόταν, ένας πελάτης θα μπορούσε να **χαρίσει** αγγελία σε άλλον ή να την
 * γεννήσει ήδη «δημοσιευμένη πριν από έναν χρόνο». Ό,τι δεν είναι στο σχήμα **δεν
 * μπορεί να σταλεί** — η άμυνα είναι ο τύπος, όχι έλεγχος που κάποιος πρέπει να
 * θυμηθεί.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ `id` **ΔΕΧΕΤΑΙ**, ΚΑΙ Ο ΛΟΓΟΣ ΕΙΝΑΙ ΤΑ ΑΡΧΕΙΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο πειρασμός ήταν να το γεννά ο διακομιστής. Μετρήθηκε η συνέπεια: τα αρχεία του
 * κατόχου ζουν στο `owner_properties/{userId}/{ownerPropertyId}/…` — δηλαδή **η
 * διαδρομή αποθήκευσης χρειάζεται την ταυτότητα ΠΡΙΝ υπάρξει το έγγραφο**. Με
 * ταυτότητα διακομιστή, η ροή θα ήταν *«υπόβαλε → πάρε id → ανέβασε → ξανα-υπόβαλε»*:
 * **τρεις** κλήσεις, ένα παράθυρο όπου η αγγελία υπάρχει χωρίς τα αρχεία της, και ο
 * χρήστης να βλέπει ροδέλα **μετά** το «αποθηκεύτηκε».
 *
 * 🔑 **Δεν είναι χαλάρωση του N.6 — είναι η ΙΔΙΑ επιλογή με την Α9.** Το
 * `generatePropertyDemandId` το γράφει ρητά: οι ταυτότητες του **επιπέδου Β** *«ΔΕΝ
 * περιορίζονται στον διακομιστή»*, γιατί ένα λάθος αφορά **έναν** χρήστη. Ο πελάτης
 * καλεί την **ίδια** γεννήτρια (`enterpriseIdService.generateOwnerPropertyId()`).
 *
 * ⚠️ **Και ο διακομιστής ΔΕΝ την εμπιστεύεται**: {@link ownerPropertyIdFromRequest}
 * απαιτεί **σωστό πρόθεμα από το μητρώο** (όχι regex γραμμένο εδώ), και η δημιουργία
 * χρησιμοποιεί `.create()` — που **πετά** αν η ταυτότητα υπάρχει ήδη. Άρα ούτε
 * αυθαίρετο κλειδί μπαίνει, ούτε ξένη αγγελία γράφεται από πάνω.
 *
 * **Layering**: leaf — σχήμα zod, καμία εξάρτηση από Firestore ή React.
 */

import { z } from 'zod';

import { GEOCODING_ACCURACIES, type GeocodingAccuracy } from '@/lib/geocoding/geocoding-types';
import { ENTERPRISE_ID_PREFIXES } from '@/services/enterprise-id-prefixes';
import { enterpriseIdType, isValidEnterpriseId } from '@/services/enterprise-id-parse';
import { OFFER_LIFECYCLES, type OfferLifecycle } from '@/types/property-offers';
import type { OwnerPropertyDraft } from '@/types/owner-property';

/** Αριθμός ή ρητή απουσία. **Ποτέ `0` για το κενό** — δες `owner-property-form-values.ts`. */
const nullableNumber = z.number().finite().nullable();

const lifecycle = z.enum(
  OFFER_LIFECYCLES as unknown as [OfferLifecycle, ...OfferLifecycle[]],
);

/**
 * Η διάθεση, ως **διακριτή ένωση στο `kind`** — ίδιο σχήμα με τον τύπο.
 *
 * 🔑 **`discriminatedUnion` και όχι `union`**: το πρώτο διαλέγει κλάδο **από το
 * `kind`** και αναφέρει σφάλμα **του σωστού κλάδου**· το δεύτερο δοκιμάζει όλους και
 * αναφέρει τρία άσχετα σφάλματα για ένα πεδίο. Η διαφορά φαίνεται μόνο όταν κάτι
 * σπάσει — δηλαδή ακριβώς όταν μετράει.
 *
 * ⚠️ **Η ταυτότητα (`offr_*`) έρχεται από τον πελάτη, και ο λόγος είναι η Α20 σημείο
 * 4**: σε **επεξεργασία** η υπάρχουσα διάθεση οφείλει να **κρατήσει** την ταυτότητά
 * της, αλλιώς «το κλείσιμο μιας διάθεσης αποσύρει τις άλλες» χάνει το υποκείμενό του.
 * Ο πελάτης τη γεννά μέσω του **ίδιου** `enterprise-id.service` (N.6) — δεν είναι
 * ελεύθερο κείμενο, είναι SSoT που τυχαίνει να τρέχει στον περιηγητή, όπως ακριβώς
 * και το `dmnd_*` της Α9.
 */
const offer = z.discriminatedUnion('kind', [
  z.object({
    id: z.string().min(1),
    kind: z.literal('sell'),
    lifecycle,
    askingPrice: nullableNumber,
    finalPrice: nullableNumber.optional(),
  }),
  z.object({
    id: z.string().min(1),
    kind: z.literal('leaseOut'),
    lifecycle,
    rentPrice: nullableNumber,
  }),
  z.object({
    id: z.string().min(1),
    kind: z.literal('exchange'),
    lifecycle,
    percentage: nullableNumber,
  }),
]);

/** Η θέση — η ίδια διακριτή ένωση με τον τύπο (Α5 §3). */
const place = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('declared'),
    point: z.object({ lat: z.number().finite(), lng: z.number().finite() }),
    label: z.string(),
    accuracy: z
      .enum(GEOCODING_ACCURACIES as unknown as [GeocodingAccuracy, ...GeocodingAccuracy[]])
      .nullable(),
  }),
  z.object({ kind: z.literal('declined') }),
]);

/**
 * Ένα ανεβασμένο αρχείο.
 *
 * ⚠️ **Το `storagePath` δεν επικυρώνεται εδώ ως προς την ΙΔΙΟΚΤΗΣΙΑ**, και δηλώνεται
 * ρητά αντί να υπονοηθεί: το κάνει ο **κανόνας του Storage**
 * (`owner_properties/{userId}/…` → `isOwner(userId)`), που είναι ο μόνος που μπορεί.
 * Ένα μονοπάτι ξένου χρήστη γραμμένο εδώ θα ήταν **δείκτης χωρίς πρόσβαση**: το
 * κατέβασμα θα αποτύγχανε για τον ίδιο τον κάτοχο της αγγελίας.
 */
const media = z.object({
  storagePath: z.string().min(1),
  fileName: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  uploadedAt: z.string(),
});

/** Το προσχέδιο, όπως φτάνει από το δίκτυο. */
export const ownerPropertyDraftSchema = z.object({
  title: z.string(),
  type: z.string(),
  areaSqm: nullableNumber,
  floor: nullableNumber,
  bedrooms: nullableNumber,
  offers: z.array(offer),
  place,
  media: z.array(media),
});

/**
 * Ό,τι δέχεται ο διακομιστής → {@link OwnerPropertyDraft}.
 *
 * ⚠️ **Ρητή δήλωση τύπου επιστροφής, ώστε μια απόκλιση σχήματος ⇄ οντότητας να είναι
 * σφάλμα μεταγλώττισης** και όχι κάτι που ανακαλύπτεται στην παραγωγή. Χωρίς αυτήν, ο
 * τύπος θα ήταν «ό,τι τυχαίνει να λέει το zod», και το σχήμα θα μπορούσε να αποκλίνει
 * σιωπηλά — το ίδιο σχήμα με τις δύο λίστες namespace του CHECK 3.34.
 */
export function ownerPropertyDraftFromRequest(value: unknown):
  | { readonly ok: true; readonly draft: OwnerPropertyDraft }
  | { readonly ok: false; readonly malformed: readonly string[] } {
  const parsed = ownerPropertyDraftSchema.safeParse(value);

  if (!parsed.success) {
    return {
      ok: false,
      malformed: [...new Set(parsed.error.issues.map((issue) => issue.path.join('.')))],
    };
  }

  const draft: OwnerPropertyDraft = parsed.data as OwnerPropertyDraft;
  return { ok: true, draft };
}

/**
 * Η ταυτότητα που έστειλε ο πελάτης — **επαληθευμένη από το μητρώο προθεμάτων**.
 *
 * 🔑 **Ρωτά το `enterprise-id.service`, ΔΕΝ γράφει regex.** Ένα `/^ownp_/` εδώ θα
 * ήταν **δεύτερη αυθεντία** για το τι είναι έγκυρη ταυτότητα, και θα απέκλινε την
 * ημέρα που θα άλλαζε η μορφή (μήκος, checksum, τμήματα). Το `enterpriseIdType`
 * απαντά από το **ίδιο** μητρώο που παρήγαγε την ταυτότητα.
 *
 * ⚠️ **Ελέγχει και τον ΤΥΠΟ, όχι μόνο την εγκυρότητα**: ένα έγκυρο `dmnd_*` δεν είναι
 * αγγελία. Χωρίς αυτό, ο πελάτης θα μπορούσε να δώσει στην αγγελία του ταυτότητα
 * ζήτησης — και τα δύο έγγραφα θα δείχνανε στο ίδιο `public_listings/{id}`.
 */
export function ownerPropertyIdFromRequest(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const id = value.trim();
  if (id === '') return null;
  // ⚠️ `isValidEnterpriseId` **και** έλεγχος τύπου: το πρώτο απαιτεί πραγματικό
  // uuid v4 στο δεύτερο μισό (γνωστό πρόθεμα **δεν αρκεί**), το δεύτερο ότι είναι
  // αγγελία και όχι ζήτηση.
  if (!isValidEnterpriseId(id)) return null;
  return enterpriseIdType(id) === ENTERPRISE_ID_PREFIXES.OWNER_PROPERTY ? id : null;
}
