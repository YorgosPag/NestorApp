/**
 * Guide Binding Zod Schema (ADR-441, Slice 0).
 *
 * Runtime validation για το associative grid hosting (`GuideBinding`).
 * Mirror του `bim/hosting/guide-binding-types.ts` (χειροκίνητος mirror — pattern
 * όλων των BIM schemas σε αυτό το project).
 *
 * @see ../hosting/guide-binding-types.ts
 */

import { z } from 'zod';

export const GuideBindingSlotSchema = z.enum([
  'start-x',
  'start-y',
  'end-x',
  'end-y',
  'center-x',
  'center-y',
]);

export const GuideBindingSchema = z
  .object({
    guideId: z.string().min(1),
    slot: GuideBindingSlotSchema,
  })
  .strict();

/** Optional array — χρησιμοποιείται από entity schemas που υποστηρίζουν hosting. */
export const GuideBindingsSchema = z.array(GuideBindingSchema).optional();

export type GuideBindingParsed = z.infer<typeof GuideBindingSchema>;
