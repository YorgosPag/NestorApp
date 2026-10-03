/**
 * Το σχήμα του αποθηκευμένου αιτήματος εγγράφου (ADR-901 Φ4.5) — **η μία μετάφραση** δίσκου → τύπου.
 *
 * Fail-closed, όπως το `contribution-schema.ts`: έγγραφο που δεν περνά ⇒ `null` ⇒ ο αναγνώστης το αγνοεί και το
 * αναφέρει. ⛔ Ποτέ `as ConveyanceDocumentRequest`: ένας χαλασμένος `recipient` που «μαντεύεται» θα έδειχνε το αίτημα
 * σε λάθος θεατή (Α31).
 *
 * @module lib/conveyance/document-request-schema
 */

import { z } from 'zod';

import { LEGAL_ENGAGEMENT_ROLES } from '@/types/engagement';
import type { ConveyanceDocumentRequest } from '@/types/conveyance-document-request';

const nonEmpty = z.string().min(1);
const accountRole = z.enum([...LEGAL_ENGAGEMENT_ROLES, 'host'] as const);

const documentRequestSchema = z.object({
  id: nonEmpty,
  companyId: nonEmpty,
  caseId: nonEmpty,
  projectId: z.string().nullable(),
  checklistItemId: nonEmpty,
  requesterRole: accountRole,
  requesterUid: nonEmpty,
  recipient: accountRole,
  dayKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  requestedAt: nonEmpty,
  notifiedAt: z.string().nullable(),
});

/** Ωμό έγγραφο → `ConveyanceDocumentRequest`, ή `null` αν δεν είναι αίτημα που καταλαβαίνουμε. */
export function parseDocumentRequest(raw: unknown): ConveyanceDocumentRequest | null {
  const parsed = documentRequestSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
