/**
 * ADR-449 — **ΤΟ** κεντρικό zod schema του finish skin spec (`StructuralFinishSpec`).
 *
 * Γιατί υπάρχει (N.0.2 / N.12): το `StructuralFinishSpec` ζει σε **4** entity params
 * (`WallParams` / `ColumnParams` / `BeamParams` / `SlabParams`) αλλά μέχρι το ADR-534 Φ5
 * **κανένα** από τα `*.schemas.ts` δεν το επικύρωνε — άρα ο πρώτος που θα το χρειαζόταν θα
 * το έγραφε inline, και οι επόμενοι τρεις θα το αντέγραφαν. Το `slab.schemas.ts:120`
 * (`soffitFinish` inline) είναι ήδη ακριβώς αυτό το μοτίβο. Ένα σημείο αλήθειας εδώ →
 * τα 4 params schemas κάνουν `import`, μηδέν αντιγραφή.
 *
 * **Mirror-κανόνας:** το schema καθρεφτίζει το TS interface του `structural-finish-types.ts`
 * **γραμμή προς γραμμή**. Αλλάζεις το ένα → αλλάζεις το άλλο (το `slab.schemas.ts` είναι
 * `.strict()`, άρα άγνωστο πεδίο = runtime reject → τα υπάρχοντα tests το πιάνουν).
 *
 * @see ./structural-finish-types.ts — το TS SSoT που καθρεφτίζεται εδώ
 * @see docs/centralized-systems/reference/adrs/ADR-449-structural-finish-skin.md
 */

import { z } from 'zod';

/**
 * ADR-449 PART B — per-face override. Όλα optional (partial override πάνω στο
 * interior/exterior spec). Mirror του {@link FinishFaceOverride}.
 */
export const FinishFaceOverrideSchema = z
  .object({
    materialId: z.string().min(1).optional(),
    colorOverride: z.string().min(1).optional(),
    thickness: z.number().positive().optional(),
  })
  .strict();

/**
 * Mirror του {@link StructuralFinishSpec} (stored per-element πρόθεση σοβατίσματος).
 *
 * `enabled:false` ή `thickness:0` = ανενεργός σοβάς — **έγκυρο** state (το data model
 * κρατά την παλέτα· η ορατότητα ελέγχεται από το `isFinishActive` guard, όχι από reject).
 * Γι' αυτό το `thickness` είναι `nonnegative`, ΟΧΙ `positive`.
 */
export const StructuralFinishSpecSchema = z
  .object({
    enabled: z.boolean(),
    interiorMaterialId: z.string().min(1),
    exteriorMaterialId: z.string().min(1),
    thickness: z.number().nonnegative(),
    exteriorThickness: z.number().positive().optional(),
    faceOverrides: z.record(z.string().min(1), FinishFaceOverrideSchema).optional(),
  })
  .strict();

export type StructuralFinishSpecParsed = z.infer<typeof StructuralFinishSpecSchema>;
