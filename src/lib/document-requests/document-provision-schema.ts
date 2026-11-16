/**
 * Το σχήμα του αποθηκευμένου δοσίματος (ADR-942 Φ2) — **η μία μετάφραση** δίσκου → τύπου, και η **μία** ταυτότητα.
 *
 * Fail-closed, όπως το `document-request-schema.ts`: έγγραφο που δεν περνά ⇒ `null` ⇒ **καμία** πρόσβαση. ⛔ Ποτέ
 * `as StoredDocumentProvision`: ένα χαλασμένο `fileId` που «μαντεύεται» θα άνοιγε σε τρίτο ξένο αρχείο.
 *
 * @module lib/document-requests/document-provision-schema
 */

import { z } from 'zod';

import { DOCUMENT_PROVISION_ROUTES, type DocumentRequestSubject, type StoredDocumentProvision } from '@/types/document-request';
import { ENGAGEMENT_SUBJECT_KINDS } from '@/types/engagement';

const nonEmpty = z.string().min(1);

const provisionSchema = z.object({
  id: nonEmpty,
  companyId: nonEmpty,
  subject: z.object({ kind: z.enum(ENGAGEMENT_SUBJECT_KINDS), id: nonEmpty }),
  itemId: nonEmpty,
  fileId: nonEmpty,
  via: z.enum(DOCUMENT_PROVISION_ROUTES),
  givenBy: nonEmpty,
  givenAt: nonEmpty,
  revokedAt: z.string().nullable(),
  revokedBy: z.string().nullable(),
});

/** Ωμό έγγραφο → δόσιμο, ή `null` αν δεν είναι δόσιμο που καταλαβαίνουμε. */
export function parseDocumentProvision(raw: unknown): StoredDocumentProvision | null {
  const parsed = provisionSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/** Η ταυτότητα: (είδος, υπόθεση, στοιχείο, αρχείο) — το ίδιο αρχείο για το ίδιο στοιχείο δίνεται **μία** φορά. */
export function documentProvisionSeed(subject: DocumentRequestSubject, itemId: string, fileId: string): string {
  return `${subject.kind}|${subject.id}|${itemId}|${fileId}`;
}

/** Ζωντανό δόσιμο = δεν ανακλήθηκε. Η υπόλοιπη κρίση (αρχείο · συμμετοχή · παράθυρο) ανήκει στον προσαρμογέα του είδους. */
export function isLiveProvision(provision: StoredDocumentProvision): boolean {
  return provision.revokedAt === null;
}
