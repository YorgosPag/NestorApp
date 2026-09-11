/**
 * @fileoverview **ΤΟ ΑΙΤΗΜΑ ΕΝΤΑΞΗΣ ΣΕ ΧΩΡΟ ΕΡΓΑΣΙΑΣ** — οντότητα, όχι τιμή του `users/{uid}.status` (ADR-660 §6).
 * @module types/workspace-access-request
 *
 * 🔴 **ΓΙΑΤΙ ΟΝΤΟΤΗΤΑ**: ένα πεδίο (`users.status`) απαντούσε **δύο** ερωτήματα — «τι
 * ταυτότητα έχει;» και «περιμένει έγκριση για γραφείο;». Όταν ένας αυτο-εγγεγραμμένος σε
 * αναμονή απέδειξε το email του από δημόσια αγγελία (ADR-844), η ταυτότητα έγινε `citizen`
 * και **το αίτημα εξαφανίστηκε σιωπηλά** από τη λίστα του διαχειριστή (ADR-844 §13.6 #2).
 * Η κλάση του ADR-749: δύο ερωτήματα, μία τιμή.
 *
 * 🏆 Ίδιο σχήμα με GitHub (organization membership request) · Slack (`invite_request`) ·
 * Microsoft Entra (access package request) · Atlassian (product access request) — και
 * Google AIP-216: **κάθε πόρος έχει τη δική του κατάσταση**.
 */

/** Ο κύκλος ζωής — **κλειστός**, και μόνο `pending →` επιτρέπεται (δες την υπηρεσία). */
export const WORKSPACE_ACCESS_REQUEST_STATUSES = ['pending', 'approved', 'denied', 'withdrawn'] as const;
export type WorkspaceAccessRequestStatus = (typeof WORKSPACE_ACCESS_REQUEST_STATUSES)[number];

/** Οι αποφάσεις του διαχειριστή — **υποσύνολο** των καταστάσεων, ποτέ `pending`/`withdrawn`. */
export type WorkspaceAccessDecision = Extract<WorkspaceAccessRequestStatus, 'approved' | 'denied'>;

export function isWorkspaceAccessRequestStatus(value: unknown): value is WorkspaceAccessRequestStatus {
  return typeof value === 'string' && (WORKSPACE_ACCESS_REQUEST_STATUSES as readonly string[]).includes(value);
}

/** Η μορφή που ταξιδεύει προς οθόνες — ημερομηνίες ως ISO, ποτέ `Timestamp` της Firestore. */
export interface WorkspaceAccessRequestView {
  readonly id: string;
  readonly companyId: string;
  readonly requesterUid: string;
  readonly requesterEmail: string;
  readonly requesterName: string | null;
  readonly authProvider: string | null;
  readonly status: WorkspaceAccessRequestStatus;
  readonly requestedAt: string | null;
  readonly decidedAt: string | null;
  readonly decidedBy: string | null;
}

/** Τι βλέπει ο **ίδιος** ο αιτών για το αίτημά του — `none` αν δεν ζήτησε ποτέ. */
export type OwnWorkspaceAccessState = WorkspaceAccessRequestStatus | 'none';
