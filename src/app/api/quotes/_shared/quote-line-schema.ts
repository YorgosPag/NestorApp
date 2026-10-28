/**
 * Το ΕΝΑ σχήμα γραμμής προσφοράς για τα PM routes (`POST /api/quotes`, `PATCH /api/quotes/[id]`).
 *
 * Ήταν δύο αντίγραφα. Το zod **πετά** κάθε άγνωστο κλειδί ⇒ όταν το `QuoteLine` απέκτησε `rfqLineId`
 * (ADR-327 §8.5), μια επεξεργασία του PM θα έσβηνε σιωπηλά το δέσιμο κάθε γραμμής με τη γραμμή RFQ.
 *
 * @module api/quotes/_shared/quote-line-schema
 * @enterprise ADR-327 §8.5
 */

import 'server-only';

import { z } from 'zod';

/**
 * quantity μπορεί να είναι 0 στην επεξεργασία — η AI εξαγωγή πινάκων πολλών επιπέδων δίνει γραμμές-γονείς /
 * υποσύνολα / περιγραφικές γραμμές με κενή ποσότητα· ο χρήστης τις αφαιρεί στον έλεγχο (X).
 */
export const QuoteLineSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1).max(500),
  categoryCode: z.string().max(30).nullable().default(null),
  quantity: z.number().min(0),
  unit: z.string().min(1).max(20),
  unitPrice: z.number().min(0),
  vatRate: z.union([z.literal(0), z.literal(6), z.literal(13), z.literal(24)]),
  lineTotal: z.number().min(0),
  notes: z.string().max(500).nullable().default(null),
  rfqLineId: z.string().min(1).max(128).nullable().optional(),
});

/** Νέα προσφορά: κάθε γραμμή έχει πραγματική ποσότητα. */
export const QuoteLineCreateSchema = QuoteLineSchema.extend({
  quantity: z.number().positive(),
});
