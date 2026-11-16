import 'server-only';

/**
 * =============================================================================
 * «Ζήτησε έγγραφο» στην ανάθεση έκδοσης — ο ΠΡΟΣΑΡΜΟΓΕΑΣ της κοινής ροής (ADR-942 Φ1)
 * =============================================================================
 *
 * Δομικά ίδιος με τον προσαρμογέα μεταβίβασης (`conveyance-document-request.service.ts`)· τα κοινά βήματα (συναλλαγή ·
 * ιδεμποτία · ειδοποίηση ανά ρόλο · `notifiedAt`) ζουν **μία** φορά στο `request-pipeline.server.ts`.
 *
 * 1. **Η συμμετοχή**: δική του, ενεργή **τώρα** (ο ΕΝΑΣ κριτής `judgeIssuanceEngagement`)· ξένη ≡ ανύπαρκτη.
 * 2. **Ο κριτής** (`issuanceRequestTargetOf`) — ο ίδιος με τον client: στοιχείο εκτός καταλόγου ⇒ `not-found`.
 * + σήμα όψης (ρητά κανένα — ADR-915 §39) · ίχνος στο **ακίνητο** με λέξεις (§45.21) · ειδοποίηση στο γραφείο.
 *
 * ⛔ Ο παραλήπτης **δεν** έρχεται ποτέ από το αίτημα (Α29): είναι **πάντα** το γραφείο που κατέχει την ανάθεση.
 *
 * @module services/document-registry/issuance-document-request.service
 */

import type { Firestore } from 'firebase-admin/firestore';

import { asIssuanceRequestItemId } from '@/config/document-requests/issuance-request-catalog';
import { isEngaged } from '@/lib/auth/engagement-judge';
import { conveyanceToday } from '@/lib/conveyance/conveyance-calendar';
import { parseDocumentRequest } from '@/lib/document-requests/document-request-schema';
import { ISSUANCE_REQUEST_OPEN_STAGE, issuanceRequestTargetOf } from '@/lib/document-requests/issuance-request-policy';
import type { RequestParty } from '@/lib/document-requests/request-core';
import { ISSUANCE_AUDIT_FIELDS } from '@/lib/document-validity/issuance-audit-fields';
import { runDocumentRequests, type JudgedRequest, type RequestPipelineAdapter } from '@/server/document-requests/request-pipeline.server';
import { announceDocumentsRequested } from '@/server/issuance-invitations/issuance-document-request-notifier';
import { EntityAuditService } from '@/services/entity-audit.service';
import type { EngagementVerdict, IssuanceEngagement } from '@/types/engagement';
import type { IssuanceDocumentRequest, IssuanceRequestOutcome, IssuanceRequestRole } from '@/types/issuance-document-request';
import type { DocumentIssuanceAssignment } from './issuance-assignment-schema';
import { issuanceRequestContextOf, type IssuanceRequestContext } from './issuance-document-request-panel.server';
import { issuancePropertyNameOf, judgeIssuanceEngagement, readHostedIssuanceAssignment } from './issuance-engagement-host-adapter';

/** Ό,τι μπορεί να απαντήσει η πόρτα του μηχανικού — το ίδιο λεξιλόγιο με τη μεταβίβαση (ίδιοι κωδικοί HTTP). */
export type IssuanceRequestResult =
  | { readonly ok: true; readonly items: readonly IssuanceRequestOutcome[] }
  | { readonly ok: false; readonly rejection: 'case-closed' | 'not-found' | 'unknown' }
  | { readonly ok: false; readonly rejection: 'denied'; readonly verdict: EngagementVerdict };

interface RequestScope {
  readonly assignment: DocumentIssuanceAssignment;
  readonly engagement: IssuanceEngagement;
  readonly party: RequestParty<IssuanceRequestRole>;
  readonly propertyName: string | null;
  readonly nowMs: number;
}

function judgeAll(context: IssuanceRequestContext, party: RequestParty<IssuanceRequestRole>, itemIds: readonly string[]): JudgedRequest<IssuanceRequestRole>[] {
  const byId = new Map(context.items.map((item) => [item.itemId, item]));
  const hasOfficeRecipient = context.officeRecipients.some((uid) => uid !== party.uid);
  return [...new Set(itemIds)].map((itemId): JudgedRequest<IssuanceRequestRole> => {
    const known = asIssuanceRequestItemId(itemId);
    const item = known === null ? undefined : byId.get(known);
    if (!item || context.container === null) return { itemId, kind: 'refused', refusal: 'not-found' };
    const target = issuanceRequestTargetOf({ stage: context.stage, item, hasOfficeRecipient });
    return target.ok ? { itemId, recipient: target.recipient } : { itemId, kind: 'refused', refusal: target.refusal };
  });
}

/** Μία εγγραφή βιβλίου ανά πάτημα, στο **ακίνητο** — `— → <είδος εγγράφου>` (λέξεις από τον κατάλογο, §45.21). */
async function recordRequests(scope: RequestScope, fresh: readonly IssuanceDocumentRequest[]): Promise<void> {
  const fields = ISSUANCE_AUDIT_FIELDS[scope.assignment.documentKind];
  if (fields === null) return;
  await EntityAuditService.recordChange({
    entityType: scope.assignment.scope === 'property' ? 'property' : 'owner_property',
    entityId: scope.assignment.propertyId,
    entityName: scope.propertyName,
    action: 'document_requested',
    changes: fresh.map((r) => ({ field: fields.documentRequest, oldValue: null, newValue: r.itemId })),
    performedBy: scope.party.uid,
    performedByName: null,
    companyId: scope.assignment.companyId,
  });
}

function adapterFor(db: Firestore, scope: RequestScope, context: IssuanceRequestContext): RequestPipelineAdapter<IssuanceRequestRole> {
  return {
    companyId: scope.assignment.companyId,
    subject: { kind: 'document_issuance', id: scope.assignment.id },
    projectId: scope.engagement.projectId,
    party: scope.party,
    dayKey: conveyanceToday(new Date(scope.nowMs)),
    nowIso: new Date(scope.nowMs).toISOString(),
    parse: (raw) => parseDocumentRequest('document_issuance', raw),
    // ADR-915 §39 — ο χώρος της ανάθεσης δεν έχει ζωντανή όψη: ρητά κανένα σήμα (η όψη ξαναδιαβάζεται μετά την αποστολή).
    signalInTx: () => undefined,
    audit: (fresh) => recordRequests(scope, fresh),
    notifyRole: (_role, group) => announceDocumentsRequested({
      assignment: scope.assignment,
      propertyName: scope.propertyName,
      requestIds: group.map((r) => r.id),
      recipientUids: context.officeRecipients.filter((uid) => uid !== scope.party.uid),
    }),
  };
}

export interface IssuanceRequestInput {
  readonly engagement: IssuanceEngagement;
  readonly uid: string;
  readonly itemIds: readonly string[];
  readonly nowMs: number;
}

/** Ο μηχανικός ζητά ένα ή περισσότερα στοιχεία του καταλόγου από το γραφείο που κατέχει την ανάθεση. */
export async function requestIssuanceDocuments(db: Firestore, input: IssuanceRequestInput): Promise<IssuanceRequestResult> {
  const { engagement, uid, nowMs } = input;
  const decision = judgeIssuanceEngagement(engagement, uid, nowMs);
  if (!isEngaged(decision.verdict)) return { ok: false, rejection: 'denied', verdict: decision.verdict };
  const assignment = await readHostedIssuanceAssignment(db, engagement.hostCompanyId, engagement.subject.assignmentId);
  if (!assignment) return { ok: false, rejection: 'not-found' };
  const [context, propertyName] = await Promise.all([
    issuanceRequestContextOf(db, assignment),
    issuancePropertyNameOf(db, assignment.companyId, assignment.propertyId),
  ]);
  if (context === 'unknown') return { ok: false, rejection: 'unknown' };
  if (context.stage !== ISSUANCE_REQUEST_OPEN_STAGE) return { ok: false, rejection: 'case-closed' };
  const scope: RequestScope = { assignment, engagement, party: { role: engagement.role, uid }, propertyName, nowMs };
  const judged = judgeAll(context, scope.party, input.itemIds);
  return { ok: true, items: await runDocumentRequests(db, adapterFor(db, scope, context), judged) };
}
