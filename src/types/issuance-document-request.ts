/**
 * ADR-942 Φ1 — «Ζήτησε έγγραφο» στην ανάθεση έκδοσης: οι γενικοί τύποι του ADR-942 στενεμένοι στους ρόλους της έκδοσης.
 *
 * Αιτών = ο μηχανικός (`document_issuer`, μέσω της συμμετοχής του)· παραλήπτης = ο **οικοδεσπότης** (το γραφείο που
 * κατέχει την ανάθεση — ως χώρος, όχι ως άνθρωπος). Το σχήμα και τα σχόλιά του ζουν **μία** φορά, στο
 * `types/document-request.ts`.
 *
 * @module types/issuance-document-request
 */

import type { IssuanceRequestItemId, IssuanceRequestTier } from '@/config/document-requests/issuance-request-catalog';
import type { ENTITY_TYPES } from '@/config/domain-constants';
import type { HOST_REQUEST_ROLE } from '@/lib/document-requests/request-core';
import type {
  DocumentRequestItemOutcome,
  DocumentRequestPanel,
  DocumentRequestTarget,
  DocumentRequestView,
  PendingDocumentRequest,
  StoredDocumentRequest,
} from '@/types/document-request';
import type { IssuanceEngagementRole } from '@/types/engagement';

export type IssuanceRequestRole = IssuanceEngagementRole | typeof HOST_REQUEST_ROLE;

/** Η οντότητα που κρατά τα έγγραφα του κατόχου (ADR-942 Ε2): ακίνητο εταιρείας ή ιδιωτικό ακίνητο σε θεματοφυλακή γραφείου. */
export type IssuanceRequestEntityType = typeof ENTITY_TYPES.PROPERTY | typeof ENTITY_TYPES.OWNER_PROPERTY;

export type IssuanceDocumentRequest = StoredDocumentRequest<IssuanceRequestRole>;
export type IssuanceRequestTarget = DocumentRequestTarget<IssuanceRequestRole>;
export type IssuanceRequestView = DocumentRequestView<IssuanceRequestRole>;
export type IssuancePendingRequest = PendingDocumentRequest<IssuanceRequestRole>;
export type IssuanceRequestOutcome = DocumentRequestItemOutcome<IssuanceRequestRole>;

/** Ένα στοιχείο του καταλόγου όπως το βλέπει ο θεατής: βαθμίδα + αν ο φάκελος του κατόχου το έχει **τώρα**. */
export interface IssuanceRequestItemView {
  readonly itemId: IssuanceRequestItemId;
  readonly tier: IssuanceRequestTier;
  /** Το νεότερο ζωντανό αρχείο αυτού του είδους στον φάκελο του κατόχου — `null` ⇒ λείπει. */
  readonly providedAt: string | null;
}

/**
 * Η ενότητα «Έγγραφα για την έκδοση» — ίδια για μηχανικό και γραφείο· διαφέρει μόνο το `log` (Α31: ο καθένας βλέπει
 * όσα ζήτησε ή του ζητήθηκαν) και τα `targets` (μόνο ο αιτών έχει «σε ποιον θα πήγαινε»).
 */
export interface IssuanceDocumentRequests extends DocumentRequestPanel<IssuanceRequestRole> {
  readonly items: readonly IssuanceRequestItemView[];
  /** Ε5 — η απόδοση σε βαθμίδα δεν έχει επιβεβαιωθεί από επιθεωρητή· η οθόνη το λέει. */
  readonly tiersVerified: boolean;
}
