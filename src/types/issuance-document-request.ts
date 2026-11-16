/**
 * ADR-942 Φ1 — «Ζήτησε έγγραφο» στην ανάθεση έκδοσης: οι γενικοί τύποι του ADR-942 στενεμένοι στους ρόλους της έκδοσης.
 *
 * Αιτών = ο μηχανικός (`document_issuer`, μέσω της συμμετοχής του)· παραλήπτης = ο **οικοδεσπότης** (το γραφείο που
 * κατέχει την ανάθεση — ως χώρος, όχι ως άνθρωπος). Το σχήμα και τα σχόλιά του ζουν **μία** φορά, στο
 * `types/document-request.ts`.
 *
 * @module types/issuance-document-request
 */

import type { IssuanceRequestItemId, IssuanceRequestTier, IssuanceRetentionBasis } from '@/config/document-requests/issuance-request-catalog';
import type { ENTITY_TYPES } from '@/config/domain-constants';
import type { IssuanceFileAccessWindow } from '@/lib/document-requests/issuance-file-access-window';
import type { HOST_REQUEST_ROLE } from '@/lib/document-requests/request-core';
import type {
  DocumentProvisionRoute,
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

/** Ένα ζωντανό αρχείο του φακέλου του κατόχου που απαντά σε στοιχείο (ADR-942 Φ2). */
export interface IssuanceFolderFile {
  readonly fileId: string;
  readonly fileName: string;
  readonly createdAt: string;
}

/** Ένα αρχείο που **δόθηκε** στον μηχανικό για ένα στοιχείο — ζωντανό δόσιμο **και** ζωντανό αρχείο στο σημερινό δοχείο. */
export interface IssuanceGivenFile {
  readonly provisionId: string;
  readonly fileId: string;
  readonly fileName: string;
  readonly givenAt: string;
  readonly via: DocumentProvisionRoute;
}

/** Ένα στοιχείο του καταλόγου όπως το βλέπει ο θεατής: βαθμίδα + αν ο φάκελος του κατόχου το έχει **τώρα**. */
export interface IssuanceRequestItemView {
  readonly itemId: IssuanceRequestItemId;
  readonly tier: IssuanceRequestTier;
  /** Το νεότερο ζωντανό αρχείο αυτού του είδους στον φάκελο του κατόχου — `null` ⇒ λείπει. */
  readonly providedAt: string | null;
  /**
   * Φ2 — ό,τι δόθηκε για το στοιχείο. Μηχανικός: **μόνο** όσο το παράθυρο πρόσβασης είναι ανοιχτό (αλλιώς κενό).
   * Γραφείο: πάντα, για να ανακαλεί.
   */
  readonly given: readonly IssuanceGivenFile[];
  /** Φ2 — **μόνο για το γραφείο**: αρχεία του είδους στον φάκελο που **δεν** δόθηκαν ακόμη («Δώσε υπάρχον»). Μηχανικός: κενό. */
  readonly candidates: readonly IssuanceFolderFile[];
}

/**
 * Η ενότητα «Έγγραφα για την έκδοση» — ίδια για μηχανικό και γραφείο· διαφέρει μόνο το `log` (Α31: ο καθένας βλέπει
 * όσα ζήτησε ή του ζητήθηκαν) και τα `targets` (μόνο ο αιτών έχει «σε ποιον θα πήγαινε»).
 */
export interface IssuanceDocumentRequests extends DocumentRequestPanel<IssuanceRequestRole> {
  readonly items: readonly IssuanceRequestItemView[];
  /** Ε5 — η απόδοση σε βαθμίδα δεν έχει επιβεβαιωθεί από επιθεωρητή· η οθόνη το λέει. */
  readonly tiersVerified: boolean;
  /**
   * Φ2 (Ε4) — πότε ανοίγει ο μηχανικός τα δοσμένα. `null` ⇒ δεν χρειάστηκε κρίση (κανένα ζωντανό δόσιμο) ή θεατής το γραφείο·
   * `'unknown'` ⇒ το μητρώο δεν διαβάστηκε (τα δοσμένα **δεν** δείχνονται — «δεν ξέρω» ≠ «ανοιχτό»).
   */
  readonly access: IssuanceFileAccessWindow | 'unknown' | null;
  /** Φ2 — η δήλωση σκοπού που βλέπει το γραφείο πριν δώσει αρχείο (ΓΚΠΔ άρθρο 13)· `null` ⇒ καμία βάση τήρησης. */
  readonly retentionBasis: IssuanceRetentionBasis | null;
}
