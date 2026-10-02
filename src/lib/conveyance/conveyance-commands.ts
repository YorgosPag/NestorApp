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

const MAX_REASON_LENGTH = 1000;
const MAX_ID_LENGTH = 200;

const reasonSchema = z.string().trim().min(1).max(MAX_REASON_LENGTH);
const itemIdSchema = z.string().min(1).max(MAX_ID_LENGTH);
const dateKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const conveyanceCommandSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('answer_fact'),
    factId: z.enum(CONVEYANCE_FACT_IDS),
    /** `null` = απόσυρση απάντησης (επιστροφή στο παραγόμενο). */
    value: z.boolean().nullable(),
  }),
  z.object({ type: z.literal('mark_not_applicable'), itemId: itemIdSchema, reason: reasonSchema }),
  z.object({
    type: z.literal('review'),
    itemId: itemIdSchema,
    verdict: z.enum(REVIEW_VERDICTS),
    /** `null` = επιβεβαίωση παραλαβής εκτός πλατφόρμας (γραμμές χωρίς αρχεία). */
    fileId: z.string().min(1).max(MAX_ID_LENGTH).nullable(),
    issuedOn: dateKeySchema.nullable(),
    reason: reasonSchema.nullable(),
  }),
  z.object({ type: z.literal('clear_override'), itemId: itemIdSchema }),
  z.object({ type: z.literal('set_target_signing_date'), date: dateKeySchema.nullable() }),
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
  'unknown_item',
  'file_not_evidence',
  'reason_required',
  'invalid_date',
  'future_issue_date',
] as const;
export type CommandRejection = (typeof COMMAND_REJECTIONS)[number];
