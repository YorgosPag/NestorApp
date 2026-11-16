/**
 * ADR-942 Φ0 — «Ζήτησε έγγραφο» για **κάθε** είδος υπόθεσης: το αίτημα ως **αμετάβλητο γεγονός** + η όψη του ανά θεατή.
 *
 * Γενικό ως προς τον **ρόλο** (`Role`): η μεταβίβαση στενεύει σε `CaseActorRole` (`types/conveyance-document-request.ts`),
 * η έκδοση (Φ1) στους δικούς της. Η υπόθεση είναι πολυμορφική (`subject: {kind, id}`) — **ένα** πεδίο ερωτήματος για
 * όλα τα είδη, σε αντίθεση με το `EngagementSubject`, που ονομάζει το κλειδί του αλλιώς ανά είδος (`caseId` · `assignmentId`).
 *
 * 🔑 **Καμία αποθηκευμένη κατάσταση «ανοιχτό/κλειστό»**: το «εκκρεμεί» **παράγεται** (ADR-901 Α31).
 *
 * @module types/document-request
 */

import type { EngagementSubjectKind } from '@/types/engagement';

/** Η υπόθεση του αιτήματος — ίδιο σχήμα για κάθε είδος (`document_requests`, ADR-942 απόφαση «Α»). */
export interface DocumentRequestSubject {
  readonly kind: EngagementSubjectKind;
  readonly id: string;
}

/**
 * Γιατί μια γραμμή **δεν** ζητείται από αυτόν τον θεατή — κάθε λόγος λέει στον άνθρωπο κάτι διαφορετικό:
 * - `not-requestable` — η γραμμή δεν λείπει (ή δεν τη βλέπει ο αιτών)
 * - `self-provider`   — την οφείλει ο ίδιος ο αιτών
 * - `no-recipient`    — δεν υπάρχει **τώρα** λογαριασμός που να την οφείλει και να τη βλέπει
 * - `case-closed`     — η υπόθεση έκλεισε / ακυρώθηκε
 */
export type DocumentRequestRefusal = 'not-requestable' | 'self-provider' | 'no-recipient' | 'case-closed';

export type DocumentRequestTarget<Role extends string> =
  | { readonly ok: true; readonly recipient: Role }
  | { readonly ok: false; readonly refusal: DocumentRequestRefusal };

/** Το αποθηκευμένο γεγονός (`document_requests`, deny-all, μόνο ο server). Ένα ανά (υπόθεση, γραμμή, αιτών, ημέρα). */
export interface StoredDocumentRequest<Role extends string> {
  readonly id: string;
  readonly companyId: string;
  readonly subject: DocumentRequestSubject;
  readonly projectId: string | null;
  /** Η γραμμή του καταλόγου της υπόθεσης που ζητείται. */
  readonly itemId: string;
  readonly requesterRole: Role;
  readonly requesterUid: string;
  readonly recipient: Role;
  /** Η ημέρα Ελλάδας (YYYY-MM-DD) — μέρος της ταυτότητας: το ίδιο αίτημα την ίδια μέρα **δεν** ξαναστέλνεται. */
  readonly dayKey: string;
  readonly requestedAt: string;
  /** Πότε ειδοποιήθηκαν όλοι οι παραλήπτες — `null` ⇒ η επανάληψη ξαναστέλνει (συγκλίνει, ιδεμποτικά). */
  readonly notifiedAt: string | null;
}

/**
 * Ένα αίτημα όπως το βλέπει **αυτός** ο θεατής — μόνο αν είναι ο αιτών ή ο παραλήπτης (καμία πληροφορία για τρίτους).
 * «Όχι από εμένα» ≡ «**προς** εμένα» (Π1): μόνο τότε ταξιδεύει ο αιτών — «Σας ζητήθηκε από: X».
 */
export type DocumentRequestView<Role extends string> = {
  readonly itemId: string;
  readonly recipient: Role;
  readonly requestedAt: string;
  readonly dayKey: string;
} & (
  /** Το ζήτησε ο ίδιος ο θεατής. */
  | { readonly byViewer: true }
  /** Ζητήθηκε **από** τον θεατή — ο ρόλος του αιτούντος (ποτέ uid/όνομα). */
  | { readonly byViewer: false; readonly requester: Role }
);

/** Η ενότητα αιτημάτων της όψης — τη δίνει ο server· το «εκκρεμεί» το παράγει ο κοινός καθαρός πυρήνας. */
export interface DocumentRequestPanel<Role extends string> {
  /** Η σημερινή ημέρα Ελλάδας κατά τον server — το «ζητήθηκε σήμερα» κρίνεται με το **ίδιο** ρολόι με την ταυτότητα. */
  readonly today: string;
  /** Ανά γραμμή που βλέπει ο θεατής: σε ποιον θα πήγαινε το αίτημα, ή γιατί όχι. */
  readonly targets: Readonly<Record<string, DocumentRequestTarget<Role>>>;
  readonly log: readonly DocumentRequestView<Role>[];
}

/** «Εκκρεμεί από: …» — παράγεται, ποτέ αποθηκεύεται. */
export interface PendingDocumentRequest<Role extends string> {
  readonly recipient: Role;
  readonly lastRequestedAt: string;
  readonly requestedTodayByViewer: boolean;
  /** Π1 — το νεότερο ανοιχτό αίτημα ζητήθηκε **από εμένα**: ποιος ρόλος το ζήτησε. `null` ⇒ εκκρεμεί από κάποιον άλλο. */
  readonly askedOfViewerBy: Role | null;
}

/** Το αποτέλεσμα ανά γραμμή ενός αιτήματος («Ζήτησε» · «Ζήτησε όλα»). */
export type DocumentRequestItemOutcome<Role extends string> =
  | { readonly itemId: string; readonly kind: 'requested' | 'already-requested'; readonly recipient: Role }
  | { readonly itemId: string; readonly kind: 'refused'; readonly refusal: DocumentRequestRefusal | 'not-found' };
