/**
 * =============================================================================
 * «Ζήτησε έγγραφο» — ο ΚΑΘΑΡΟΣ πυρήνας, κοινός για κάθε είδος υπόθεσης (ADR-942 Φ0 · ADR-901 Α31)
 * =============================================================================
 *
 * Ό,τι **δεν** εξαρτάται από τον κατάλογο της υπόθεσης: ποιος είναι ο αιτών στην ταυτότητα, ο σπόρος της
 * ντετερμινιστικής ταυτότητας ανά ημέρα, ποια αιτήματα δικαιούται να δει ο θεατής, και το «εκκρεμεί» πάνω στο ιστορικό.
 * Ο κριτής «οφείλεται κάτι; σε ποιον;» ανήκει στον **προσαρμογέα** κάθε είδους (μεταβίβαση: `lib/conveyance/document-request-policy.ts`).
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, χωρίς I/O.
 *
 * @module lib/document-requests/request-core
 */

import type { DocumentRequestView, PendingDocumentRequest } from '@/types/document-request';

/** Ο ρόλος του οικοδεσπότη — **χώρος** (δημιουργός + διαχειριστές), όχι άνθρωπος. */
export const HOST_REQUEST_ROLE = 'host';

/**
 * **Ποιος** ζητά/κοιτά: ο λογαριασμός με τον ρόλο του. Ο οικοδεσπότης είναι **χώρος**: ό,τι ζήτησε ένας, το ζήτησε η
 * πλευρά — ένα αίτημα ανά γραμμή/ημέρα για όλο τον χώρο, όχι ένα ανά διαχειριστή.
 */
export interface RequestParty<Role extends string = string> {
  readonly role: Role;
  readonly uid: string;
}

/** Το κλειδί του αιτούντος στην ταυτότητα του αιτήματος — η πλευρά για τον οικοδεσπότη, ο άνθρωπος για τον επαγγελματία. */
export function requesterKeyOf(party: RequestParty): string {
  return party.role === HOST_REQUEST_ROLE ? HOST_REQUEST_ROLE : party.uid;
}

/**
 * Ο σπόρος της ντετερμινιστικής ταυτότητας: ΕΝΑ αίτημα ανά (υπόθεση, γραμμή, αιτών, ημέρα).
 * ⚠️ **Αμετάβλητη συμβολοσειρά**: τα ids της μεταβίβασης γεννήθηκαν με αυτήν πριν το ADR-942 — ίδια συμβολοσειρά ⇒ ίδιο
 *    id ⇒ η μετάπτωση της `conveyance_document_requests` κρατά το anti-spam «ένα ανά ημέρα». Τα ids υποθέσεων φέρουν
 *    πρόθεμα ανά είδος (`cvc_` …), άρα δύο είδη δεν συγκρούονται.
 */
export function documentRequestSeed(subjectId: string, itemId: string, party: RequestParty, dayKey: string): string {
  return `${subjectId}|${itemId}|${requesterKeyOf(party)}|${dayKey}`;
}

/** Τα πεδία του αποθηκευμένου αιτήματος που χρειάζεται η όψη. */
export interface StoredRequestFields<Role extends string> {
  readonly itemId: string;
  readonly requesterRole: Role;
  readonly requesterUid: string;
  readonly recipient: Role;
  readonly requestedAt: string;
  readonly dayKey: string;
}

function isRequester<Role extends string>(entry: StoredRequestFields<Role>, viewer: RequestParty<Role>): boolean {
  return viewer.role === HOST_REQUEST_ROLE ? entry.requesterRole === HOST_REQUEST_ROLE : entry.requesterUid === viewer.uid;
}

/**
 * Α31 — τα αιτήματα που **αυτός** ο θεατής δικαιούται να δει: μόνο όσα ζήτησε ή όσα του ζητήθηκαν. Κανένα αίτημα
 * ανάμεσα σε τρίτους.
 */
export function documentRequestViewsFor<Role extends string>(
  requests: readonly StoredRequestFields<Role>[],
  viewer: RequestParty<Role>,
): readonly DocumentRequestView<Role>[] {
  return requests
    .filter((entry) => isRequester(entry, viewer) || entry.recipient === viewer.role)
    .map((entry): DocumentRequestView<Role> => {
      const base = { itemId: entry.itemId, recipient: entry.recipient, requestedAt: entry.requestedAt, dayKey: entry.dayKey };
      return isRequester(entry, viewer) ? { ...base, byViewer: true } : { ...base, byViewer: false, requester: entry.requesterRole };
    });
}

/** Το ζήτησε ήδη σήμερα ο θεατής; — η ίδια ημέρα που κάνει ταυτότητα το αίτημα. */
export function requestedTodayByViewer<Role extends string>(log: readonly DocumentRequestView<Role>[], itemId: string, today: string): boolean {
  return log.some((entry) => entry.itemId === itemId && entry.byViewer && entry.dayKey === today);
}

/**
 * «Εκκρεμεί από: …» (Α31) — **παράγεται**: το νεότερο αίτημα της γραμμής **μετά** το νεότερο τεκμήριό της (`since`).
 * Το «η γραμμή είναι ακόμη αιτήσιμη;» το ρωτά ο προσαρμογέας **πριν** καλέσει.
 */
export function pendingFromLog<Role extends string>(
  log: readonly DocumentRequestView<Role>[],
  itemId: string,
  since: string,
  today: string,
): PendingDocumentRequest<Role> | null {
  const open = log.filter((entry) => entry.itemId === itemId && entry.requestedAt > since);
  if (open.length === 0) return null;
  const latest = open.reduce((a, b) => (b.requestedAt > a.requestedAt ? b : a));
  return {
    recipient: latest.recipient,
    lastRequestedAt: latest.requestedAt,
    requestedTodayByViewer: requestedTodayByViewer(log, itemId, today),
    askedOfViewerBy: latest.byViewer ? null : latest.requester,
  };
}
