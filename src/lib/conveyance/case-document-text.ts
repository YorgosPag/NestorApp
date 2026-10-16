/**
 * @fileoverview «Ανάγνωση από το έγγραφο» στον διάλογο ελέγχου — το λεξιλόγιο της απάντησης (ADR-915 §20).
 * @module lib/conveyance/case-document-text
 *
 * Κοινό για server (`conveyance-document-text.server`) και client (διάλογος): ο άνθρωπος βλέπει **την έκβαση** με
 * όνομα — ποτέ ένα γενικό «απέτυχε».
 *
 * **Layering**: leaf — μόνο τύποι και σταθερές.
 */

import type { DocumentTextOutcome } from '@/lib/document-validity/document-text-facts';

/** Γιατί η γραμμή **δεν** διαβάζεται από τον διάλογο — πριν κατέβει οτιδήποτε. */
export const CASE_DOCUMENT_TEXT_REFUSALS = ['not-text-readable', 'no-file', 'stale', 'contributed-file'] as const;
export type CaseDocumentTextRefusal = (typeof CASE_DOCUMENT_TEXT_REFUSALS)[number];

export type CaseDocumentTextResult =
  | { readonly kind: 'refused'; readonly reason: CaseDocumentTextRefusal }
  | DocumentTextOutcome;
