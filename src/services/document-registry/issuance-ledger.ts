/**
 * @fileoverview ADR-945 Δ1 — **σε ποιο βιβλίο ζει μια ανάθεση έκδοσης**, και άρα σε ποια διεύθυνση.
 * @related issuance-assignments.server.ts (ο γραφέας) · issuance-assignment-audit.server.ts (το ιστορικό) ·
 *   issuance-assignment-schema.ts (`issuanceAssignmentIdOf`)
 * @module services/document-registry/issuance-ledger
 *
 * 🔑 Η απευθείας ανάθεση γραφείου (§27) βρίσκεται από το **αμετάβλητο** seed· κάθε άλλη ταυτότητα (π.χ. προσφορά
 *    αιτήματος) τη φέρνει ο καλών **ρητά** — ποτέ δεύτερος υπολογισμός ταυτότητας στον γραφέα.
 *
 * **Layering**: καθαρό (χωρίς `server-only`) — το εισάγουν γραφέας, ιστορικό και τεστ.
 */

import type { DocumentKind } from '@/config/document-validity/document-validity';
import type { CustodyScope } from '@/lib/workspace/custody-scope';
import { issuanceAssignmentIdOf } from './issuance-assignment-schema';

export type IssuanceLedger =
  | { readonly kind: 'office'; readonly companyId: string }
  /** ADR-945 §7.2 — προσφορά αιτήματος: το id (`bidIdOf`) και ο κύκλος του αιτήματος τα φέρνει ο καλών. */
  | { readonly kind: 'owned'; readonly owner: CustodyScope; readonly assignmentId: string; readonly requestId: string; readonly cycle: number };

/** Σε ποιο αίτημα ανήκει η ανάθεση — `null` = απευθείας ανάθεση γραφείου (διαδρομή TaskRabbit, §27). */
export function ledgerRequestOf(ledger: IssuanceLedger): { readonly requestId: string | null; readonly cycle: number | null } {
  return ledger.kind === 'office' ? { requestId: null, cycle: null } : { requestId: ledger.requestId, cycle: ledger.cycle };
}

/** Η απευθείας ανάθεση ενός γραφείου — ό,τι ίσχυε πάντα. */
export function officeLedger(companyId: string): IssuanceLedger {
  return { kind: 'office', companyId };
}

/** Ο κάτοχος του βιβλίου — εκεί γράφονται η ανάθεση **και** το ιστορικό της. */
export function ledgerOwnerOf(ledger: IssuanceLedger): CustodyScope {
  return ledger.kind === 'office' ? { companyId: ledger.companyId } : ledger.owner;
}

/** Η διεύθυνση της ανάθεσης στο βιβλίο. */
export function ledgerAssignmentIdOf(ledger: IssuanceLedger, propertyId: string, kind: DocumentKind): string {
  return ledger.kind === 'office' ? issuanceAssignmentIdOf(ledger.companyId, propertyId, kind) : ledger.assignmentId;
}
