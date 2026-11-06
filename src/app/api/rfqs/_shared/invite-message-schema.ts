/**
 * Τα πεδία του **μηνύματος** μιας πρόσκλησης — ΕΝΑ σχήμα για τη δημιουργία (`POST invites`) και την
 * προεπισκόπηση (`POST invites/preview`), ώστε η οθόνη να μη δείχνει ποτέ κάτι που ο server θα αρνιόταν
 * (ADR-327 §7.5).
 *
 * Το σχήμα ελέγχει **μορφή** και **μήκος**· τα **όρια** της ημέρας λήξης (σήμερα+1 … +90) τα κρίνει η ΜΙΑ
 * `judgeInviteExpiryDay`, γιατί εξαρτώνται από το «τώρα» στη ζώνη του φορέα.
 *
 * @module app/api/rfqs/_shared/invite-message-schema
 */

import { z } from 'zod';

import {
  VENDOR_INVITE_MAX_LIFETIME_DAYS,
  VENDOR_INVITE_MIN_LIFETIME_DAYS,
  VENDOR_INVITE_NOTE_MAX_LENGTH,
} from '@/subapps/procurement/config/vendor-invite-policy';

/** Απλό κείμενο, trim, κενό ⇒ `null`. */
export const BuyerNoteSchema = z
  .string()
  .max(VENDOR_INVITE_NOTE_MAX_LENGTH)
  .nullable()
  .optional()
  .transform((note) => {
    const trimmed = note?.trim() ?? '';
    return trimmed === '' ? null : trimmed;
  });

/** `YYYY-MM-DD` — η ημέρα ως την οποία ισχύει ο σύνδεσμος. */
export const ExpiresOnSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional();

export const InviteMessageFields = {
  expiresOn: ExpiresOnSchema,
  buyerNote: BuyerNoteSchema,
  locale: z.enum(['el', 'en']).optional(),
} as const;

/** Το σώμα του `POST /api/rfqs/[id]/invites` — επαφή **ή** χειροκίνητο email (με προαιρετικό όνομα). */
export const CreateInviteSchema = z
  .object({
    vendorContactId: z.string().min(1).optional(),
    manualEmail: z.string().email().optional(),
    // ADR-327 §7.5 (Ε3) — προαιρετικό: χωρίς όνομα ο χαιρετισμός είναι ουδέτερος, ποτέ το email στη θέση του.
    manualName: z.string().optional(),
    deliveryChannel: z.enum(['email', 'copy_link']),
    expiresInDays: z.number().int().min(VENDOR_INVITE_MIN_LIFETIME_DAYS).max(VENDOR_INVITE_MAX_LIFETIME_DAYS).optional(),
    ...InviteMessageFields,
  })
  .refine(
    (val) => (val.vendorContactId !== undefined) !== (val.manualEmail !== undefined),
    { message: 'Provide either vendorContactId or manualEmail' },
  );
