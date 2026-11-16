/**
 * =============================================================================
 * «Ζήτησε έγγραφο» στη μεταβίβαση — ο ΠΡΟΣΑΡΜΟΓΕΑΣ της κοινής ροής (ADR-901 §5.8 γρ.3 · Φ4.5 · ADR-942 Φ0)
 * =============================================================================
 *
 * Τα βήματα που ξέρει **μόνο** η μεταβίβαση — τα υπόλοιπα (συναλλαγή · ιδεμποτία · ειδοποίηση ανά ρόλο · `notifiedAt`)
 * ζουν **μία** φορά στο `server/document-requests/request-pipeline.server.ts`:
 *
 * 1. **Ο κατάλογος του αιτούντος**, ξαναπαραγμένος στον server (`checklistForRole`): γραμμή που δεν βλέπει ⇒
 *    `not-found` — ίδιο με το ανύπαρκτο (ο δικηγόρος του αγοραστή δεν μαθαίνει ούτε ότι υπάρχει γραμμή του πωλητή)
 * 2. **Ο κριτής** (`judgeDocumentRequest`) — ο ίδιος με τον client: παραλήπτης από τον πάροχο, ενεργός, που βλέπει
 * + ό,τι χρειάζεται η ροή: σήμα όψης · ίχνος (`conveyance_case` / `document_requested`) · παραλήπτες ανά ρόλο ·
 *   ειδοποίηση.
 *
 * ⛔ Ο παραλήπτης **δεν** έρχεται ποτέ από το αίτημα (Α29). ⛔ Το ίχνος **δεν** φέρει όνομα εγγράφου — μόνο το id της
 *    γραμμής και τους ρόλους (το βιβλίο το διαβάζει ο οικοδεσπότης).
 *
 * @module services/conveyance/conveyance-document-request.service
 */

import 'server-only';

import type { Firestore } from 'firebase-admin/firestore';

import { encodeCaseRequest, CASE_REQUEST_FIELD } from '@/lib/conveyance/case-activity';
import { acceptsEngagements, effectiveCaseState } from '@/lib/conveyance/case-state';
import { conveyanceToday } from '@/lib/conveyance/conveyance-calendar';
import { judgeDocumentRequest, type RequestParty } from '@/lib/conveyance/document-request-policy';
import { parseDocumentRequest } from '@/lib/document-requests/document-request-schema';
import { runDocumentRequests, type JudgedRequest, type RequestPipelineAdapter } from '@/server/document-requests/request-pipeline.server';
import { EntityAuditService } from '@/services/entity-audit.service';
import type { CaseActorRole, ChecklistRow, ConveyanceCase } from '@/types/conveyance-case';
import type { ConveyanceDocumentRequest, DocumentRequestItemOutcome } from '@/types/conveyance-document-request';
import type { ConveyanceEngagement } from '@/types/engagement';
import { announceDocumentRequest, type DocumentRequestRecipient } from './conveyance-document-request-notifier';
import { checklistForRole, engagementChecklistViewer, HOST_CHECKLIST_VIEWER } from './conveyance-engagement-access.service';
import { activeCaseEngagements, caseHostRecipients } from './conveyance-engagement-support';
import type { ConveyanceSubjectContext } from './conveyance-subject.server';
import { caseViewersOf, signalCaseChangeInTx } from './conveyance-view-signal.server';

/** Ποιος ζητά: ο οικοδεσπότης (ως χώρος, με τον άνθρωπο που πάτησε) ή ένας επαγγελματίας μέσω της συμμετοχής του. */
export type DocumentRequester =
  | { readonly kind: 'host'; readonly uid: string; readonly name: string | null }
  | { readonly kind: 'engaged'; readonly engagement: ConveyanceEngagement };

export interface RequestDocumentsInput {
  readonly requester: DocumentRequester;
  readonly record: ConveyanceCase;
  readonly context: ConveyanceSubjectContext;
  readonly itemIds: readonly string[];
  readonly nowMs: number;
}

export type RequestDocumentsOutcome =
  | { readonly ok: true; readonly items: readonly DocumentRequestItemOutcome[] }
  | { readonly ok: false; readonly rejection: 'case-closed' };

function partyOf(requester: DocumentRequester): RequestParty {
  return requester.kind === 'host' ? { role: 'host', uid: requester.uid } : { role: requester.engagement.role, uid: requester.engagement.uid };
}

function rowsFor(db: Firestore, input: RequestDocumentsInput): Promise<{ readonly rows: readonly ChecklistRow[] }> {
  const viewer = input.requester.kind === 'host' ? HOST_CHECKLIST_VIEWER : engagementChecklistViewer(input.requester.engagement);
  return checklistForRole(db, input.record, input.context, viewer);
}

/** Μία εγγραφή βιβλίου ανά πάτημα — ρόλοι και id γραμμών, ποτέ ονόματα εγγράφων. */
async function recordRequests(input: RequestDocumentsInput, party: RequestParty, fresh: readonly ConveyanceDocumentRequest[]): Promise<void> {
  await EntityAuditService.recordChange({
    entityType: 'conveyance_case',
    entityId: input.record.id,
    entityName: input.context.propertyName,
    action: 'document_requested',
    changes: fresh.map((r) => ({ field: CASE_REQUEST_FIELD, oldValue: null, newValue: r.itemId, label: encodeCaseRequest(party.role, r.recipient) })),
    performedBy: party.uid,
    performedByName: input.requester.kind === 'host' ? input.requester.name : null,
    companyId: input.record.companyId,
  });
}

/** Οι λογαριασμοί ενός ρόλου-παραλήπτη τώρα — ποτέ ο ίδιος ο αιτών. */
async function recipientsOf(db: Firestore, input: RequestDocumentsInput, role: CaseActorRole, engagements: readonly ConveyanceEngagement[], requesterUid: string): Promise<DocumentRequestRecipient[]> {
  if (role === 'host') return (await caseHostRecipients(db, input.record)).filter((uid) => uid !== requesterUid).map((uid) => ({ kind: 'host', uid }));
  return engagements.filter((e) => e.role === role && e.uid !== requesterUid).map((engagement) => ({ kind: 'engaged', engagement }));
}

/** Μία ειδοποίηση σε κάθε λογαριασμό του ρόλου· αποτυχία έστω μίας ⇒ `failed` (καμία σήμανση). */
async function notifyRole(db: Firestore, input: RequestDocumentsInput, party: RequestParty, engagements: readonly ConveyanceEngagement[], role: CaseActorRole, group: readonly ConveyanceDocumentRequest[]): Promise<'delivered' | 'failed'> {
  const recipients = await recipientsOf(db, input, role, engagements, party.uid);
  const notice = { record: input.record, propertyName: input.context.propertyName, requesterRole: party.role, requestIds: group.map((r) => r.id) };
  const deliveries = await Promise.all(recipients.map((recipient) => announceDocumentRequest({ ...notice, recipient })));
  return deliveries.includes('failed') ? 'failed' : 'delivered';
}

function adapterFor(db: Firestore, input: RequestDocumentsInput, party: RequestParty, engagements: readonly ConveyanceEngagement[]): RequestPipelineAdapter<CaseActorRole> {
  return {
    companyId: input.record.companyId,
    subject: { kind: 'conveyance_case', id: input.record.id },
    projectId: input.record.subject.projectId,
    party,
    dayKey: conveyanceToday(new Date(input.nowMs)),
    nowIso: new Date(input.nowMs).toISOString(),
    parse: (raw) => parseDocumentRequest('conveyance_case', raw),
    signalInTx: (tx, parties) => signalCaseChangeInTx(tx, db, { kind: 'request', parties }, caseViewersOf(input.record, engagements)),
    audit: (fresh) => recordRequests(input, party, fresh),
    notifyRole: (role, group) => notifyRole(db, input, party, engagements, role, group),
  };
}

function judgeAll(input: RequestDocumentsInput, party: RequestParty, rows: readonly ChecklistRow[], activeRoles: ReadonlySet<ConveyanceEngagement['role']>) {
  const byId = new Map(rows.map((row) => [row.itemId, row]));
  const state = effectiveCaseState(input.record.storedState, input.context.legalPhase);
  return [...new Set(input.itemIds)].map((itemId): JudgedRequest<CaseActorRole> => {
    const row = byId.get(itemId);
    if (!row) return { itemId, kind: 'refused', refusal: 'not-found' };
    const verdict = judgeDocumentRequest({ row, requester: party.role, state, activeRoles });
    return verdict.ok ? { itemId, recipient: verdict.recipient } : { itemId, kind: 'refused', refusal: verdict.refusal };
  });
}

/** Ο αιτών ζητά μία ή περισσότερες γραμμές του καταλόγου από όποιον τις οφείλει. */
export async function requestCaseDocuments(db: Firestore, input: RequestDocumentsInput): Promise<RequestDocumentsOutcome> {
  if (!acceptsEngagements(effectiveCaseState(input.record.storedState, input.context.legalPhase))) return { ok: false, rejection: 'case-closed' };
  const party = partyOf(input.requester);
  const [{ rows }, engagements] = await Promise.all([rowsFor(db, input), activeCaseEngagements(db, input.record, input.nowMs)]);
  const judged = judgeAll(input, party, rows, new Set(engagements.map((e) => e.role)));
  return { ok: true, items: await runDocumentRequests(db, adapterFor(db, input, party, engagements), judged) };
}
