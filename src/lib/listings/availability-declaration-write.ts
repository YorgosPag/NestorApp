/**
 * @fileoverview **Η ΠΟΡΤΑ ΕΓΓΡΑΦΗΣ ΤΗΣ ΔΗΛΩΣΗΣ ΔΙΑΘΕΣΙΜΟΤΗΤΑΣ** — πρόθεση πελάτη → `SourcedAttribute` (ADR-919 §11).
 * @related ADR-919 §7 (Α7) · lib/listings/listing-availability.ts (`readAvailabilityDeclaration`) · ADR-842 Α7
 * @module lib/listings/availability-declaration-write
 *
 * 🔴 **Γιατί υπάρχει**: και οι δύο γραφείς (`PATCH /api/buildings` · `PATCH /api/properties/[id]`) έχουν σχήμα
 * `.passthrough()`. Χωρίς αυτή την πόρτα ένα `completionDeclaration` οποιουδήποτε σχήματος — ή ένα `inferred` με
 * πλαστό `confirmedAt` — θα γραφόταν αυτούσιο, και από εκεί θα δημοσιευόταν ως υπόσχεση.
 *
 * 🔑 **Ο πελάτης στέλνει ΠΡΟΘΕΣΗ, όχι γεγονός.** «Δηλώνω» ή «αποδέχομαι την πρόταση του χρονοδιαγράμματος». Το
 * αποθηκευμένο γεγονός — προέλευση, `at`, `confirmedAt` — το γράφει **ο διακομιστής** με τη **δική του** ώρα: η έγκριση
 * είναι πράξη του ανθρώπου που κάνει αυτό το αίτημα, άρα η ώρα της είναι η ώρα του αιτήματος, όχι ό,τι ισχυρίζεται ο
 * browser. Η πρόταση **δεν αποθηκεύεται ποτέ ανεπιβεβαίωτη**: υπολογίζεται ζωντανά στην οθόνη (Δ1).
 *
 * ⚠️ `null` = ανάκληση της υπόσχεσης (ο επιλυτής πέφτει στο επόμενο σκαλί).
 */

import { z } from 'zod';

import { isDateKey } from '@/lib/calendar/date-key';
import { canonicalJson } from '@/lib/legal/canonical-json';
import type { SourcedAttribute } from '@/lib/property/attribute-provenance';
import { AVAILABILITY_PRECISIONS, type AvailabilityDeclaration } from '@/types/listing-availability';

/** Από πού ήρθε η τιμή που εγκρίνει ο άνθρωπος. */
export const AVAILABILITY_DECLARATION_ORIGINS = ['declared', 'schedule-proposal'] as const;

export type AvailabilityDeclarationOrigin = (typeof AVAILABILITY_DECLARATION_ORIGINS)[number];

/**
 * Η βεβαιότητα της πρότασης του χρονοδιαγράμματος.
 *
 * ⚠️ **Δεν αποφασίζει τίποτα**: τη δημοσίευση την κρίνει μόνο το `confirmedAt` (Α7). Καταγράφει **πόσο** στέκει η
 * πρόβλεψη τη στιγμή της έγκρισης: εκτίμηση με τον κανόνα ημερομηνίας κατάστασης, ή μόνο κάτω όριο επειδή κάτι
 * ανοιχτό είναι μπλοκαρισμένο (`isLowerBound`, ADR-919 §6). Δύο τιμές, όχι συνεχής κλίμακα: δεν έχουμε μοντέλο που
 * να δικαιολογεί περισσότερη ακρίβεια.
 */
export const SCHEDULE_PROPOSAL_CONFIDENCE = { estimate: 0.75, lowerBound: 0.4 } as const;

export const availabilityDeclarationIntentSchema = z
  .object({
    precision: z.enum(AVAILABILITY_PRECISIONS),
    anchor: z.string().refine(isDateKey, { message: 'anchor must be a real calendar day' }),
    origin: z.enum(AVAILABILITY_DECLARATION_ORIGINS),
    /** Μόνο για `schedule-proposal`: η πρόβλεψη ήταν κάτω όριο. */
    isLowerBound: z.boolean().optional(),
  })
  .strict()
  .nullable();

export type AvailabilityDeclarationIntent = z.infer<typeof availabilityDeclarationIntentSchema>;

/** Πρόθεση → το γεγονός που αποθηκεύεται. `nowIso` = η ώρα του **διακομιστή**. */
export function availabilityDeclarationFromIntent(
  intent: AvailabilityDeclarationIntent,
  nowIso: string,
): SourcedAttribute<AvailabilityDeclaration> | null {
  if (intent === null) return null;
  const value: AvailabilityDeclaration = { precision: intent.precision, anchor: intent.anchor };
  if (intent.origin === 'declared') return { provenance: 'declared', value, at: nowIso };
  const confidence = intent.isLowerBound ? SCHEDULE_PROPOSAL_CONFIDENCE.lowerBound : SCHEDULE_PROPOSAL_CONFIDENCE.estimate;
  return { provenance: 'inferred', value, at: nowIso, confidence, confirmedAt: nowIso };
}

/**
 * Το πεδίο `field` του σώματος ως ενημέρωση εγγράφου: απόν ⇒ `{}` (δεν αγγίζεται) · άκυρο ⇒ `invalid` (400) ·
 * αλλιώς `{ [field]: γεγονός | null }`. Ένα σημείο για τους δύο γραφείς.
 *
 * 🔑 **Idempotent απέναντι στην αμετάβλητη επαναποστολή**: η αυτόματη αποθήκευση που ξαναστέλνει **ολόκληρο** το
 * έγγραφο φέρνει πίσω το **αποθηκευμένο** γεγονός. Όταν είναι ταυτόσημο με το `stored` (`canonicalJson`), δεν γράφεται
 * τίποτα — ούτε 400, ούτε νέα σφραγίδα ώρας (που θα έγραφε ψεύτικη «αλλαγή» στο ίχνος και θα ξαναπροέβαλλε). Ό,τι
 * **διαφέρει** από το αποθηκευμένο πρέπει να είναι πρόθεση· ένα αλλαγμένο «γεγονός» είναι πλαστογραφία ⇒ `invalid`.
 */
export function availabilityDeclarationPatch<F extends 'completionDeclaration' | 'availabilityDeclaration'>(
  body: { readonly [K in F]?: unknown },
  field: F,
  nowIso: string,
  stored: unknown,
): { readonly kind: 'ok'; readonly patch: Readonly<Record<string, unknown>> } | { readonly kind: 'invalid' } {
  const raw: unknown = body[field];
  if (raw === undefined || canonicalJson(raw) === canonicalJson(stored ?? null)) return { kind: 'ok', patch: {} };
  const parsed = availabilityDeclarationIntentSchema.safeParse(raw);
  if (!parsed.success) return { kind: 'invalid' };
  return { kind: 'ok', patch: { [field]: availabilityDeclarationFromIntent(parsed.data, nowIso) } };
}
