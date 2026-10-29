/**
 * =============================================================================
 * Conveyance — εντολές πάνω στην υπόθεση (ADR-901 §5.1) — σχήμα + κλειστό σύνολο
 * =============================================================================
 *
 * Κάθε αλλαγή της υπόθεσης είναι **μία** από αυτές τις εντολές (AIP-136 custom methods,
 * εδώ ως discriminated union). Το σχήμα zod είναι η ΜΙΑ επικύρωση: τη χρησιμοποιεί το
 * API route και ο client την παράγει από τον ίδιο τύπο.
 *
 * 🔑 Ο client ΔΕΝ στέλνει αποτύπωμα αρχείου — το υπολογίζει ο server από τα αρχεία που
 *    βρήκε ο ίδιος. Αλλιώς ο έλεγχος θα μπορούσε να «δεθεί» σε έκδοση που δεν υπάρχει.
 *
 * @module lib/conveyance/conveyance-commands
 */

import { z } from 'zod';
import { CONVEYANCE_FACT_IDS } from '@/config/conveyance-checklist/types';
import { REVIEW_VERDICTS } from '@/types/conveyance-case';
import { calendarDaySchema } from '@/lib/date/calendar-day-schema';
import { MAX_CASE_SELLERS } from './case-parties';

const MAX_REASON_LENGTH = 1000;
const MAX_ID_LENGTH = 200;

const reasonSchema = z.string().trim().min(1).max(MAX_REASON_LENGTH);
const itemIdSchema = z.string().min(1).max(MAX_ID_LENGTH);
/** Υπαρκτή ημέρα (ADR-919): η `2027-02-30` ως ημερομηνία υπογραφής/έκδοσης απορρίπτεται (400), δεν αποθηκεύεται. */
const dateKeySchema = calendarDaySchema;

const conveyanceCommandSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('answer_fact'),
    factId: z.enum(CONVEYANCE_FACT_IDS),
    /** `null` = απόσυρση απάντησης (επιστροφή στο παραγόμενο). */
    value: z.boolean().nullable(),
    /**
     * ADR-915 §22 — **ποιου** προσώπου, για γεγονός προσώπου (`isPartyFact`): υποχρεωτικό εκεί, απαγορευμένο αλλού
     * (`party_required` / `party_not_applicable`). Το `ConveyanceSellerParty.key`.
     */
    partyKey: z.string().min(1).max(MAX_ID_LENGTH).optional(),
  }),
  z.object({ type: z.literal('mark_not_applicable'), itemId: itemIdSchema, reason: reasonSchema }),
  z.object({
    type: z.literal('review'),
    itemId: itemIdSchema,
    verdict: z.enum(REVIEW_VERDICTS),
    /** `null` = επιβεβαίωση παραλαβής εκτός πλατφόρμας (γραμμές χωρίς αρχεία). */
    fileId: z.string().min(1).max(MAX_ID_LENGTH).nullable(),
    issuedOn: dateKeySchema.nullable(),
    /**
     * ADR-915 §14 — η λήξη **όπως είναι τυπωμένη** στο έγγραφο (`YYYY-MM-DD`). Προαιρετική: παλιοί clients δεν τη
     * στέλνουν, και τα είδη με κανόνα από τη διάρκεια (ΠΕΑ) δεν τη χρειάζονται.
     */
    validUntil: dateKeySchema.nullable().optional(),
    reason: reasonSchema.nullable(),
  }),
  z.object({ type: z.literal('clear_override'), itemId: itemIdSchema }),
  z.object({ type: z.literal('set_target_signing_date'), date: dateKeySchema.nullable() }),
  /**
   * ADR-915 §23 — συμμεταβιβάζοντες: **μόνο** επαφές. Φυσικό/νομικό πρόσωπο και ιδιότητα τα παράγει ο server από την
   * επαφή και το έργο (`sellerCandidateOf`) — ο client δεν τα δηλώνει. Πολλές μαζί = **μία** πράξη (μία έκδοση, ένα
   * ίχνος): «Πρόσθεσε τους οικοπεδούχους» δεν είναι τρεις διαδοχικές συγκρούσεις CAS.
   */
  z.object({
    type: z.literal('add_sellers'),
    contactIds: z.array(z.string().min(1).max(MAX_ID_LENGTH)).min(1).max(MAX_CASE_SELLERS)
      .refine((ids) => new Set(ids).size === ids.length, { message: 'duplicate contactIds' }),
  }),
  /** ADR-915 §23 — αφαίρεση συμμεταβιβάζοντος (`ConveyanceSellerParty.key`). Τα δεδομένα του **μένουν** (επαναφορά). */
  z.object({ type: z.literal('remove_seller'), partyKey: z.string().min(1).max(MAX_ID_LENGTH) }),
  z.object({ type: z.literal('cancel'), reason: reasonSchema }),
]);

export type ConveyanceCommand = z.infer<typeof conveyanceCommandSchema>;

/** Σώμα του PATCH: η εντολή + η έκδοση που είδε ο client (CAS). */
export const conveyanceCommandRequestSchema = z.object({
  expectedVersion: z.number().int().nonnegative(),
  command: conveyanceCommandSchema,
});

export type ConveyanceCommandRequest = z.infer<typeof conveyanceCommandRequestSchema>;

/** Γιατί απορρίφθηκε μια εντολή — κλειστό σύνολο, ο route το μεταφράζει σε HTTP. */
const COMMAND_REJECTIONS = [
  'not_editable',
  /** Άγνωστη γραμμή — ή γραμμή προσώπου που δεν είναι (πια) μέρος της υπόθεσης (ADR-915 §22). */
  'unknown_item',
  /** ADR-915 §22 — γεγονός προσώπου χωρίς πρόσωπο, ή με πρόσωπο που δεν είναι μέρος της υπόθεσης. */
  'party_required',
  /** ADR-915 §22 — γεγονός της υπόθεσης με πρόσωπο: η απάντηση δεν θα μετρούσε πουθενά. */
  'party_not_applicable',
  /**
   * ADR-915 §23 — η επαφή δεν μπορεί να γίνει πωλητής: άγνωστη, **ξένη** (ADR-742 — ξένη ≡ ανύπαρκτη, καμία μαρτυρία
   * ύπαρξης), υπηρεσία, αρχειοθετημένη/διαγραμμένη.
   */
  'seller_not_eligible',
  /** ADR-915 §23 — η επαφή είναι ήδη **αγοραστής** της ίδιας υπόθεσης: κανείς δεν μεταβιβάζει στον εαυτό του. */
  'seller_is_buyer',
  /** ADR-915 §23 — η εταιρεία του έργου (`principal`) δεν αφαιρείται: χωρίς αυτήν δεν υπάρχει πώληση του έργου. */
  'principal_not_removable',
  /** ADR-915 §23 — πάνω από `MAX_CASE_SELLERS` μεταβιβάζοντες. */
  'too_many_sellers',
  'file_not_evidence',
  'reason_required',
  'invalid_date',
  'future_issue_date',
  /** ADR-915 Φ3β — η ημερομηνία αντιλέγει στην ανάγνωση του ίδιου του εγγράφου (`document-text`). */
  'issued_on_contradicts_document',
  /** ADR-915 §14 — τυπωμένη λήξη **πριν** από την έκδοση: αδύνατη, ποτέ μαντεψιά για το ποια είναι λάθος. */
  'validity_before_issue',
] as const;
export type CommandRejection = (typeof COMMAND_REJECTIONS)[number];
