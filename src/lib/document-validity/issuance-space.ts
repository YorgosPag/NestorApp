/**
 * @fileoverview ADR-915 §39 — **ο χώρος της ανάθεσης, όπως τον βλέπει το γραφείο**: στάλθηκε · ανοίχτηκε · έληξε ·
 *   αρνήθηκε · μπήκε. **Παράγεται** από την πιο πρόσφατη πρόσκληση σε λογαριασμό — τίποτα δεν αποθηκεύεται στην ανάθεση
 *   (μία αλήθεια: η πρόσκληση· «μπήκε» ⇔ η πρόσκληση εξαργυρώθηκε, που γράφει τη συμμετοχή **στην ίδια** συναλλαγή).
 * @module lib/document-validity/issuance-space
 *
 * Καθαρό — το καλούν το μητρώο λήξεων (server) και η κάρτα του γραφείου (client).
 */

import type { InvitationState } from '@/types/invitation-core';

/** Ό,τι χρειάζεται η παραγωγή από την πρόσκληση — η **παρουσιαζόμενη** κατάσταση (ληγμένη `pending` ⇒ `expired`). */
export interface IssuanceSpaceInvitationFacts {
  readonly state: InvitationState;
  readonly sentAt: string;
  readonly openedAt: string | null;
  readonly expiresAt: string;
  readonly resolvedAt: string | null;
}

/**
 * - `none`     — καμία πρόσκληση (π.χ. η ανάληψη καταγράφηκε από το γραφείο τηλεφωνικά, ή το ακίνητο δεν είχε έργο)
 * - `invited`  — στάλθηκε, περιμένει είσοδο· `openedAt` = άνοιξε τη σελίδα (πάνω από Procore: ο αποστολέας το βλέπει)
 * - `expired`  — έληξε ή αντικαταστάθηκε χωρίς είσοδο
 * - `declined` — ο επαγγελματίας αρνήθηκε τον χώρο (η ανάθεση μένει αναληφθείσα)
 * - `entered`  — μπήκε με λογαριασμό· η συνεργασία συνεχίζεται μέσα στην εφαρμογή
 */
export type IssuanceSpaceStatus =
  | { readonly kind: 'none' }
  | { readonly kind: 'invited'; readonly sentAt: string; readonly openedAt: string | null; readonly expiresAt: string }
  | { readonly kind: 'expired'; readonly sentAt: string }
  | { readonly kind: 'declined'; readonly at: string }
  | { readonly kind: 'entered'; readonly at: string };

export function issuanceSpaceStatusOf(latest: IssuanceSpaceInvitationFacts | null): IssuanceSpaceStatus {
  if (latest === null) return { kind: 'none' };
  switch (latest.state) {
    case 'pending':
      return { kind: 'invited', sentAt: latest.sentAt, openedAt: latest.openedAt, expiresAt: latest.expiresAt };
    case 'accepted':
      return { kind: 'entered', at: latest.resolvedAt ?? latest.sentAt };
    case 'declined':
      return { kind: 'declined', at: latest.resolvedAt ?? latest.sentAt };
    case 'expired':
    case 'revoked':
      return { kind: 'expired', sentAt: latest.sentAt };
  }
}

/** Το γραφείο μπορεί να στείλει **νέο** σύνδεσμο εισόδου — όσο ο επαγγελματίας δεν έχει μπει (Procore «Re-invite»). */
export function canResendSpaceInvitation(status: IssuanceSpaceStatus): boolean {
  return status.kind !== 'entered';
}
