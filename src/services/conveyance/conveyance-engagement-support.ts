/**
 * ADR-901 Φ2 — τα κοινά των δύο πλευρών της συμμετοχής σε υπόθεση μεταβίβασης (οικοδεσπότης ·
 * επαγγελματίας): η ταυτότητα της υπόθεσης ως «subject», το κλειδί, η προβολή και το ίχνος.
 * **Ένα** σημείο, ώστε οι δύο υπηρεσίες να μη διαφωνήσουν για το τι είναι «η υπόθεση».
 *
 * @module services/conveyance/conveyance-engagement-support
 */

import 'server-only';

import { EntityAuditService } from '@/services/entity-audit.service';
import type { AuditAction, AuditFieldChange } from '@/types/audit-trail';
import type { CaseEngagementSummary, ConveyanceCase, ConveyanceCaseState } from '@/types/conveyance-case';
import type { Engagement, EngagementKey, EngagementSubject } from '@/types/engagement';

/** Η υπόθεση ως αντικείμενο συμμετοχής. */
export function caseSubject(caseId: string): EngagementSubject {
  return { kind: 'conveyance_case', caseId };
}

/** Το έργο της υπόθεσης — **το** σημείο όπου ζουν οι συμμετοχές της (ADR-862 §5.3.1). */
export function caseProjectId(record: ConveyanceCase): string | null {
  return record.subject.projectId;
}

/** Το κλειδί μιας συμμετοχής **από την ίδια** — ποτέ από το αίτημα. */
export function engagementKeyOf(engagement: Engagement): EngagementKey {
  return { hostCompanyId: engagement.hostCompanyId, projectId: engagement.projectId, engagementId: engagement.id };
}

/**
 * Δέχεται η υπόθεση **νέες** προτάσεις; Μετά την υπογραφή **ναι** — ο συμβολαιογράφος δουλεύει ως τη
 * μεταγραφή· μετά το κλείσιμο/ακύρωση **όχι** (οι συμμετοχές έχουν ήδη τελειώσει).
 */
export function acceptsEngagements(state: ConveyanceCaseState): boolean {
  return state !== 'closed' && state !== 'cancelled';
}

/** Η προβολή για τον οικοδεσπότη — ρητά πεδία, ποτέ spread του εγγράφου. */
export function toEngagementSummary(engagement: Engagement): CaseEngagementSummary {
  return {
    engagementId: engagement.id,
    role: engagement.role,
    state: engagement.state,
    email: engagement.email,
    offeredAt: engagement.offeredAt,
    respondedAt: engagement.respondedAt,
    closedAt: engagement.closedAt,
    expiresAt: engagement.expiresAt,
    consents: engagement.consents,
  };
}

/**
 * Ίχνος στο βιβλίο του **οικοδεσπότη** (ADR-195 · ADR-862 §5.7): ποιος μπήκε, ποιος αποδέχτηκε, ποιος
 * ανακλήθηκε — με τον **δρώντα** (οικοδεσπότης ή επαγγελματίας) ως `performedBy`.
 */
export async function recordEngagementAudit(params: {
  readonly engagement: Engagement;
  readonly action: AuditAction;
  readonly changes: readonly AuditFieldChange[];
  readonly performedBy: string;
  readonly performedByName: string | null;
  readonly entityName: string | null;
}): Promise<void> {
  await EntityAuditService.recordChange({
    entityType: 'engagement',
    entityId: params.engagement.id,
    entityName: params.entityName,
    action: params.action,
    changes: [...params.changes],
    performedBy: params.performedBy,
    performedByName: params.performedByName,
    companyId: params.engagement.hostCompanyId,
  });
}

/** Η αλλαγή κατάστασης ως πεδίο ίχνους. */
export function stateChange(before: Engagement | null, after: Engagement): AuditFieldChange {
  return { field: 'state', oldValue: before?.state ?? null, newValue: after.state };
}
