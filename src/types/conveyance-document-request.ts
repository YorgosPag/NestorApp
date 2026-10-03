/**
 * ADR-901 Φ4.5 — «Ζήτησε έγγραφο»: το αίτημα ως **αμετάβλητο γεγονός** + η όψη του ανά θεατή.
 *
 * 🔑 **Καμία αποθηκευμένη κατάσταση «ανοιχτό/κλειστό»** (σε αντίθεση με το RFI του Procore, που κάποιος πρέπει να
 * κλείσει με το χέρι): το «εκκρεμεί» **παράγεται** — αίτημα που υπάρχει **και** γραμμή που είναι ακόμη αιτήσιμη, μετά το
 * νεότερο τεκμήριό της. Μόλις φτάσει το έγγραφο, το αίτημα «κλείνει» μόνο του· δεν μπορεί να ξεχαστεί ανοιχτό (Α31).
 *
 * @module types/conveyance-document-request
 */

/** Αιτών και παραλήπτης είναι `CaseActorRole`: όποιος έχει **λογαριασμό** στην υπόθεση (ποτέ πωλητής/αγοραστής ως τη Φ5). */
import type { CaseActorRole } from '@/types/conveyance-case';


/**
 * Γιατί μια γραμμή **δεν** ζητείται από αυτόν τον θεατή — κάθε λόγος λέει στον άνθρωπο κάτι διαφορετικό:
 * - `not-requestable` — η γραμμή δεν λείπει (ή δεν τη βλέπει ο αιτών)
 * - `self-provider`   — την οφείλει ο ίδιος ο αιτών
 * - `no-recipient`    — δεν υπάρχει **τώρα** λογαριασμός που να την οφείλει και να τη βλέπει (π.χ. αγοραστής χωρίς δικηγόρο)
 * - `case-closed`     — η υπόθεση έκλεισε / ακυρώθηκε
 */
export type DocumentRequestRefusal = 'not-requestable' | 'self-provider' | 'no-recipient' | 'case-closed';

export type DocumentRequestTarget =
  | { readonly ok: true; readonly recipient: CaseActorRole }
  | { readonly ok: false; readonly refusal: DocumentRequestRefusal };

/** Το αποθηκευμένο γεγονός (`conveyance_document_requests`, deny-all, μόνο ο server). Ένα ανά (γραμμή, αιτών, ημέρα). */
export interface ConveyanceDocumentRequest {
  readonly id: string;
  readonly companyId: string;
  readonly caseId: string;
  readonly projectId: string | null;
  readonly checklistItemId: string;
  readonly requesterRole: CaseActorRole;
  readonly requesterUid: string;
  readonly recipient: CaseActorRole;
  /** Η ημέρα Ελλάδας (YYYY-MM-DD) — μέρος της ταυτότητας: το ίδιο αίτημα την ίδια μέρα **δεν** ξαναστέλνεται. */
  readonly dayKey: string;
  readonly requestedAt: string;
  /** Πότε ειδοποιήθηκαν όλοι οι παραλήπτες — `null` ⇒ η επανάληψη ξαναστέλνει (συγκλίνει, ιδεμποτικά). */
  readonly notifiedAt: string | null;
}

/** Ένα αίτημα όπως το βλέπει **αυτός** ο θεατής — μόνο αν είναι ο αιτών ή ο παραλήπτης (καμία πληροφορία για τρίτους). */
export interface DocumentRequestView {
  readonly itemId: string;
  readonly recipient: CaseActorRole;
  readonly requestedAt: string;
  readonly dayKey: string;
  /** Το ζήτησε ο ίδιος ο θεατής. */
  readonly byViewer: boolean;
}

/** Η ενότητα αιτημάτων της όψης — τη δίνει ο server· το «εκκρεμεί» το παράγει ο κοινός καθαρός πυρήνας. */
export interface CaseDocumentRequests {
  /** Η σημερινή ημέρα Ελλάδας κατά τον server — το «ζητήθηκε σήμερα» κρίνεται με το **ίδιο** ρολόι με την ταυτότητα. */
  readonly today: string;
  /** Ανά γραμμή που βλέπει ο θεατής: σε ποιον θα πήγαινε το αίτημα, ή γιατί όχι (ανεξάρτητο από την κατάσταση της γραμμής). */
  readonly targets: Readonly<Record<string, DocumentRequestTarget>>;
  readonly log: readonly DocumentRequestView[];
}

/** «Εκκρεμεί από: …» — παράγεται, ποτέ αποθηκεύεται. */
export interface PendingDocumentRequest {
  readonly recipient: CaseActorRole;
  readonly lastRequestedAt: string;
  readonly requestedTodayByViewer: boolean;
}

/** Το αποτέλεσμα ανά γραμμή ενός αιτήματος («Ζήτησε» · «Ζήτησε όλα»). */
export type DocumentRequestItemOutcome =
  | { readonly itemId: string; readonly kind: 'requested' | 'already-requested'; readonly recipient: CaseActorRole }
  | { readonly itemId: string; readonly kind: 'refused'; readonly refusal: DocumentRequestRefusal | 'not-found' };
