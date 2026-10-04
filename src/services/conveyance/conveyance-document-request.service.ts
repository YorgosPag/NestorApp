/**
 * =============================================================================
 * «Ζήτησε έγγραφο» — ο ΕΝΑΣ γραφέας (ADR-901 §5.8 γρ.3 · Φ4.5 · άγκυρες Α29 · Α30)
 * =============================================================================
 *
 * 1. **Ο κατάλογος του αιτούντος**, ξαναπαραγμένος στον server (`checklistForRole`): γραμμή που δεν βλέπει ⇒
 *    `not-found` — ίδιο με το ανύπαρκτο (ο δικηγόρος του αγοραστή δεν μαθαίνει ούτε ότι υπάρχει γραμμή του πωλητή)
 * 2. **Ο κριτής** (`judgeDocumentRequest`) — ο ίδιος με τον client: παραλήπτης από τον πάροχο, ενεργός, που βλέπει
 * 3. **Συναλλαγή**: ένα έγγραφο ανά (υπόθεση, γραμμή, αιτών, ημέρα) με **ντετερμινιστική** ταυτότητα —
 *    υπάρχει ήδη ⇒ `already-requested` (anti-spam χωρίς race· δεύτερο πάτημα δεν ξαναειδοποιεί)
 * 4. **Ίχνος** — μία εγγραφή `document_requested` ανά πάτημα, **μόνο** για τα νέα αιτήματα
 * 5. **Ειδοποίηση** — **μία** ανά παραλήπτη για όσα δεν ειδοποιήθηκαν ακόμη (`notifiedAt === null`)· μετά σημαδεύονται.
 *    Αίτημα που έσκασε ανάμεσα σε 3 και 5 **συγκλίνει** στην επανάληψη: ίδιο σύνολο ⇒ ίδιο `eventId` ⇒ ο orchestrator
 *    απορρίπτει το διπλότυπο (το «ειδοποίησε πρώτα, σημάδεψε μετά» της υπενθύμισης πρόσκλησης)
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
import { documentRequestSeed, judgeDocumentRequest, type RequestParty } from '@/lib/conveyance/document-request-policy';
import { parseDocumentRequest } from '@/lib/conveyance/document-request-schema';
import { EntityAuditService } from '@/services/entity-audit.service';
import { generateDeterministicConveyanceDocumentRequestId } from '@/services/enterprise-id.service';
import type { CaseActorRole, ChecklistRow, ConveyanceCase } from '@/types/conveyance-case';
import type { ConveyanceDocumentRequest, DocumentRequestItemOutcome } from '@/types/conveyance-document-request';
import type { Engagement } from '@/types/engagement';
import { announceDocumentRequest, type DocumentRequestRecipient } from './conveyance-document-request-notifier';
import { documentRequestsCollection } from './conveyance-document-request-store.server';
import { checklistForRole, engagementChecklistViewer, HOST_CHECKLIST_VIEWER } from './conveyance-engagement-access.service';
import { activeCaseEngagements, caseHostRecipients } from './conveyance-engagement-support';
import type { ConveyanceSubjectContext } from './conveyance-subject.server';
import { caseViewersOf, signalCaseChangeInTx } from './conveyance-view-signal.server';

/** Ποιος ζητά: ο οικοδεσπότης (ως χώρος, με τον άνθρωπο που πάτησε) ή ένας επαγγελματίας μέσω της συμμετοχής του. */
export type DocumentRequester =
  | { readonly kind: 'host'; readonly uid: string; readonly name: string | null }
  | { readonly kind: 'engaged'; readonly engagement: Engagement };

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

interface Accepted {
  readonly itemId: string;
  readonly recipient: CaseActorRole;
}

interface Planned extends Accepted {
  readonly id: string;
}

function partyOf(requester: DocumentRequester): RequestParty {
  return requester.kind === 'host' ? { role: 'host', uid: requester.uid } : { role: requester.engagement.role, uid: requester.engagement.uid };
}

function rowsFor(db: Firestore, input: RequestDocumentsInput): Promise<{ readonly rows: readonly ChecklistRow[] }> {
  const viewer = input.requester.kind === 'host' ? HOST_CHECKLIST_VIEWER : engagementChecklistViewer(input.requester.engagement);
  return checklistForRole(db, input.record, input.context, viewer);
}

function newRequest(input: RequestDocumentsInput, party: RequestParty, planned: Planned, dayKey: string): ConveyanceDocumentRequest {
  return {
    id: planned.id,
    companyId: input.record.companyId,
    caseId: input.record.id,
    projectId: input.record.subject.projectId,
    checklistItemId: planned.itemId,
    requesterRole: party.role,
    requesterUid: party.uid,
    recipient: planned.recipient,
    dayKey,
    requestedAt: new Date(input.nowMs).toISOString(),
    notifiedAt: null,
  };
}

/** (3) Η συναλλαγή: νέα έγγραφα για όσα δεν ζητήθηκαν σήμερα· τα υπάρχοντα επιστρέφονται ως έχουν. */
async function writeRequests(db: Firestore, input: RequestDocumentsInput, party: RequestParty, accepted: readonly Accepted[], engagements: readonly Engagement[]) {
  const dayKey = conveyanceToday(new Date(input.nowMs));
  const planned: Planned[] = accepted.map((a) => ({
    ...a,
    id: generateDeterministicConveyanceDocumentRequestId(documentRequestSeed(input.record.id, a.itemId, party, dayKey)),
  }));
  return db.runTransaction(async (tx) => {
    const snapshots = await tx.getAll(...planned.map((p) => documentRequestsCollection(db).doc(p.id)));
    const written = planned.map((p, index) => {
      const existing = parseDocumentRequest(snapshots[index]?.data());
      if (existing) return { request: existing, fresh: false };
      const request = newRequest(input, party, p, dayKey);
      tx.create(documentRequestsCollection(db).doc(request.id), request);
      return { request, fresh: true };
    });
    // §14.8 — το αίτημα το βλέπουν ΜΟΝΟ αιτών και παραλήπτης (Α31)· ό,τι ήδη ζητήθηκε σήμερα δεν αλλάζει καμία όψη.
    const parties = [party.role, ...written.filter((w) => w.fresh).map((w) => w.request.recipient)];
    if (parties.length > 1) signalCaseChangeInTx(tx, db, { kind: 'request', parties }, caseViewersOf(input.record, engagements));
    return written;
  });
}

/** (4) Μία εγγραφή βιβλίου ανά πάτημα — ρόλοι και id γραμμών, ποτέ ονόματα εγγράφων. */
async function recordRequests(input: RequestDocumentsInput, party: RequestParty, fresh: readonly ConveyanceDocumentRequest[]): Promise<void> {
  if (fresh.length === 0) return;
  await EntityAuditService.recordChange({
    entityType: 'conveyance_case',
    entityId: input.record.id,
    entityName: input.context.propertyName,
    action: 'document_requested',
    changes: fresh.map((r) => ({ field: CASE_REQUEST_FIELD, oldValue: null, newValue: r.checklistItemId, label: encodeCaseRequest(party.role, r.recipient) })),
    performedBy: party.uid,
    performedByName: input.requester.kind === 'host' ? input.requester.name : null,
    companyId: input.record.companyId,
  });
}

/** Οι λογαριασμοί ενός ρόλου-παραλήπτη τώρα — ποτέ ο ίδιος ο αιτών. */
async function recipientsOf(db: Firestore, input: RequestDocumentsInput, role: CaseActorRole, engagements: readonly Engagement[], requesterUid: string): Promise<DocumentRequestRecipient[]> {
  if (role === 'host') return (await caseHostRecipients(db, input.record)).filter((uid) => uid !== requesterUid).map((uid) => ({ kind: 'host', uid }));
  return engagements.filter((e) => e.role === role && e.uid !== requesterUid).map((engagement) => ({ kind: 'engaged', engagement }));
}

/** (5) Μία ειδοποίηση ανά παραλήπτη για τα μη ειδοποιημένα· σημάδεμα **μόνο** αν καμία αποστολή δεν απέτυχε. */
async function notifyPending(
  db: Firestore,
  input: RequestDocumentsInput,
  party: RequestParty,
  requests: readonly ConveyanceDocumentRequest[],
  engagements: readonly Engagement[],
): Promise<void> {
  const pending = requests.filter((r) => r.notifiedAt === null);
  for (const role of new Set(pending.map((r) => r.recipient))) {
    const group = pending.filter((r) => r.recipient === role);
    const recipients = await recipientsOf(db, input, role, engagements, party.uid);
    const notice = { record: input.record, propertyName: input.context.propertyName, requesterRole: party.role, requestIds: group.map((r) => r.id) };
    const deliveries = await Promise.all(recipients.map((recipient) => announceDocumentRequest({ ...notice, recipient })));
    if (deliveries.includes('failed')) continue;
    const notifiedAt = new Date(input.nowMs).toISOString();
    await Promise.all(group.map((r) => documentRequestsCollection(db).doc(r.id).update({ notifiedAt })));
  }
}

function judgeAll(input: RequestDocumentsInput, party: RequestParty, rows: readonly ChecklistRow[], activeRoles: ReadonlySet<Engagement['role']>) {
  const byId = new Map(rows.map((row) => [row.itemId, row]));
  const state = effectiveCaseState(input.record.storedState, input.context.legalPhase);
  return [...new Set(input.itemIds)].map((itemId): DocumentRequestItemOutcome | Accepted => {
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
  const accepted = judged.filter((j): j is Accepted => !('kind' in j));
  const written = accepted.length > 0 ? await writeRequests(db, input, party, accepted, engagements) : [];
  await recordRequests(input, party, written.filter((w) => w.fresh).map((w) => w.request));
  await notifyPending(db, input, party, written.map((w) => w.request), engagements);
  const outcomes = new Map(written.map((w) => [w.request.checklistItemId, w]));
  return {
    ok: true,
    items: judged.map((j): DocumentRequestItemOutcome => {
      if ('kind' in j) return j;
      const w = outcomes.get(j.itemId);
      return { itemId: j.itemId, kind: w?.fresh ? 'requested' : 'already-requested', recipient: j.recipient };
    }),
  };
}
