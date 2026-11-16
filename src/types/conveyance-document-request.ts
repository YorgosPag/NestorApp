/**
 * ADR-901 Φ4.5 — «Ζήτησε έγγραφο» στη μεταβίβαση: οι γενικοί τύποι του ADR-942 στενεμένοι στους ρόλους της υπόθεσης.
 *
 * Αιτών και παραλήπτης είναι `CaseActorRole`: όποιος έχει **λογαριασμό** στην υπόθεση (ποτέ πωλητής/αγοραστής ως τη Φ5).
 * Το σχήμα και τα σχόλιά του ζουν **μία** φορά, στο `types/document-request.ts`.
 *
 * @module types/conveyance-document-request
 */

import type { CaseActorRole } from '@/types/conveyance-case';
import type {
  DocumentRequestItemOutcome as GenericItemOutcome,
  DocumentRequestPanel,
  DocumentRequestTarget as GenericTarget,
  DocumentRequestView as GenericView,
  PendingDocumentRequest as GenericPending,
  StoredDocumentRequest,
} from '@/types/document-request';

export type { DocumentRequestRefusal } from '@/types/document-request';

export type DocumentRequestTarget = GenericTarget<CaseActorRole>;
export type ConveyanceDocumentRequest = StoredDocumentRequest<CaseActorRole>;
export type DocumentRequestView = GenericView<CaseActorRole>;
export type CaseDocumentRequests = DocumentRequestPanel<CaseActorRole>;
export type PendingDocumentRequest = GenericPending<CaseActorRole>;
export type DocumentRequestItemOutcome = GenericItemOutcome<CaseActorRole>;
