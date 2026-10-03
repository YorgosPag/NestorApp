/**
 * Το σχήμα του αποθηκευμένου transmittal (ADR-901 Φ4.4) — **η μία μετάφραση** δίσκου → τύπου.
 *
 * Fail-closed, όπως το `engagement-schema.ts`: έγγραφο που δεν περνά ⇒ `null` ⇒ ο αναγνώστης το αγνοεί και το
 * αναφέρει. ⛔ Ποτέ `as ConveyanceContribution` σε δεδομένα δίσκου: ένας χαλασμένος `authorRole` που «μαντεύεται»
 * είναι ακροατήριο που κανείς δεν όρισε (Α23).
 *
 * Καθαρό — το καλούν αναγνώστης, γραφέας (μέσα στη συναλλαγή) και άγκυρες.
 *
 * @module lib/conveyance/contribution-schema
 */

import { z } from 'zod';

import { LEGAL_ENGAGEMENT_ROLES } from '@/types/engagement';
import type { ConveyanceContribution } from '@/types/conveyance-contribution';

const nonEmpty = z.string().min(1);

const contributionSchema = z.object({
  id: nonEmpty,
  companyId: nonEmpty,
  caseId: nonEmpty,
  projectId: z.string().nullable(),
  authorUid: nonEmpty,
  authorRole: z.enum(LEGAL_ENGAGEMENT_ROLES),
  authorEngagementId: nonEmpty,
  checklistItemId: nonEmpty,
  entryPointId: nonEmpty,
  file: z.object({
    fileId: nonEmpty,
    fingerprint: nonEmpty,
    displayName: nonEmpty,
    contentType: nonEmpty,
  }),
  supersedes: z.string().nullable(),
  issuedAt: nonEmpty,
  withdrawnAt: z.string().nullable(),
  withdrawnBy: z.string().nullable(),
});

/** Ωμό έγγραφο → `ConveyanceContribution`, ή `null` αν δεν είναι transmittal που καταλαβαίνουμε. */
export function parseContribution(raw: unknown): ConveyanceContribution | null {
  const parsed = contributionSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
