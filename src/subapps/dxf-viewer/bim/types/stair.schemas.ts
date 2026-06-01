/**
 * Stair Zod Schemas (ADR-401 Phase G) — Attach-to-structural binding.
 *
 * Mirror του `column.schemas.ts` attach refinement. Η σκάλα ΔΕΝ έχει (ακόμη)
 * πλήρες `StairParams` Zod schema — η δομική εγκυρότητα ανά variant ζει στους
 * geometry computers + `stair-validator.ts` (building-code engine). ΑΥΤΟ το αρχείο
 * προσθέτει **strict runtime validation** ΜΟΝΟ για τα ADR-401 attach πεδία
 * (`topBinding`/`baseBinding`/`attachTopToIds`/`attachBaseToIds`), ώστε η
 * αναλλοίωτη «attached ⇔ ≥1 host FK» να επιβάλλεται με τον ΙΔΙΟ τρόπο όπως
 * τοίχος/κολώνα (full SSoT, Giorgio: «όπως η Revit, full enterprise»).
 *
 * Refinements (mirror column.schemas.ts §130-159):
 *   - topBinding='attached'  ⇒ attachTopToIds μη-κενό· αλλιώς attachTopToIds undefined.
 *   - baseBinding='attached' ⇒ attachBaseToIds μη-κενό· αλλιώς attachBaseToIds undefined.
 *
 * Το `refineStairAttachBinding(data, ctx)` εξάγεται ώστε ένα μελλοντικό πλήρες
 * `StairParamsSchema` να το συνθέσει (`.superRefine`) χωρίς διπλότυπο.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-401-bim-wall-top-base-constraints-attach-to-structural.md §5 (Phase G)
 * @see bim/types/column.schemas.ts — ο δίδυμος refinement της κολώνας
 */

import { z } from 'zod';
import { StairBaseBindingSchema, StairTopBindingSchema } from './bim-binding';

/** Δομικό υποσύνολο των StairParams attach πεδίων (StairParams assignable). */
export const StairAttachBindingSchema = z
  .object({
    topBinding: StairTopBindingSchema.optional(),
    baseBinding: StairBaseBindingSchema.optional(),
    attachTopToIds: z.array(z.string().min(1)).optional(),
    attachBaseToIds: z.array(z.string().min(1)).optional(),
  })
  .strict();

export type StairAttachBindingParsed = z.infer<typeof StairAttachBindingSchema>;

/**
 * Reusable superRefine body — η αναλλοίωτη «attached ⇔ ≥1 host FK» για top + base.
 * Καλείται είτε standalone (`StairAttachBindingSchema.superRefine`) είτε από ένα
 * μελλοντικό πλήρες `StairParamsSchema`.
 */
export function refineStairAttachBinding(
  data: StairAttachBindingParsed,
  ctx: z.RefinementCtx,
): void {
  // ─── top ──────────────────────────────────────────────────────────────────
  if (
    data.topBinding === 'attached' &&
    (data.attachTopToIds === undefined || data.attachTopToIds.length === 0)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['attachTopToIds'],
      message: "StairParams: topBinding='attached' απαιτεί ≥1 attachTopToIds (host FK).",
    });
  }
  if (data.topBinding !== 'attached' && data.attachTopToIds !== undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['attachTopToIds'],
      message: "StairParams: attachTopToIds επιτρέπεται μόνο όταν topBinding='attached'.",
    });
  }
  // ─── base ─────────────────────────────────────────────────────────────────
  if (
    data.baseBinding === 'attached' &&
    (data.attachBaseToIds === undefined || data.attachBaseToIds.length === 0)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['attachBaseToIds'],
      message: "StairParams: baseBinding='attached' απαιτεί ≥1 attachBaseToIds (host FK).",
    });
  }
  if (data.baseBinding !== 'attached' && data.attachBaseToIds !== undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['attachBaseToIds'],
      message: "StairParams: attachBaseToIds επιτρέπεται μόνο όταν baseBinding='attached'.",
    });
  }
}

/** Strict standalone validator για τα attach πεδία (με τον refinement δεμένο). */
export const StairAttachBindingValidatedSchema =
  StairAttachBindingSchema.superRefine(refineStairAttachBinding);
