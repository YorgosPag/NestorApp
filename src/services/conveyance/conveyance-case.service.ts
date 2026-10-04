/**
 * =============================================================================
 * Conveyance Case Service — ο ΕΝΑΣ γραφέας της `conveyance_cases` (ADR-901 §5.1)
 * =============================================================================
 *
 * - `getConveyanceCaseView` — η πιο πρόσφατη υπόθεση του ακινήτου + ο παραγόμενος κατάλογος
 * - `openConveyanceCase`    — **ιδεμποτής**: transaction «υπάρχει ανοιχτή; → αυτή · αλλιώς νέα»
 *                             (N.7.2 #3 — δύο πατήματα / δύο καρτέλες = ΜΙΑ υπόθεση)
 * - `applyConveyanceCaseCommand` — CAS στο `version` (409 σε σύγκρουση, Google Docs-style),
 *                             πάγωμα μετά την υπογραφή (Ε-6), ίχνος σε κάθε πράξη (ADR-195)
 *
 * Ο κατάλογος ΔΕΝ αποθηκεύεται: κάθε ανάγνωση τον παράγει από τα τρέχοντα αρχεία, άρα
 * ένα νέο ανέβασμα φαίνεται αμέσως χωρίς κανέναν συγχρονισμό.
 *
 * @module services/conveyance/conveyance-case.service
 */

import 'server-only';

import type { Firestore } from 'firebase-admin/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';
import { ownedOrNull } from '@/lib/auth/tenant-ownership';
import { CONVEYANCE_CATALOG_VERSION } from '@/config/conveyance-checklist/catalog';
import { generateConveyanceCaseId } from '@/services/enterprise-id.service';
import { EntityAuditService } from '@/services/entity-audit.service';
import { nowISO } from '@/lib/date-local';
import { conveyanceToday, nextConveyanceDayStart } from '@/lib/conveyance/conveyance-calendar';
import { applyConveyanceCommand } from '@/lib/conveyance/apply-command';
import { effectiveCaseState, isCaseEditable } from '@/lib/conveyance/case-state';
import type { ConveyanceCommandRequest, CommandRejection } from '@/lib/conveyance/conveyance-commands';
import { parseConveyanceCase } from '@/lib/conveyance/conveyance-case-schema';
import { deriveCaseChecklist } from '@/lib/conveyance/case-checklist';
import { deriveFacts } from '@/lib/conveyance/derive-facts';
import type { AuditAction, AuditFieldChange } from '@/types/audit-trail';
import type { ConveyanceCase, ConveyanceCaseView, EvidenceFile } from '@/types/conveyance-case';
import { collectCaseEvidence, HOST_EVIDENCE_VIEWER } from './conveyance-case-evidence.server';
import { documentRequestPanel } from './conveyance-document-request-panel.server';
import { loadConveyanceSubject, type ConveyanceSubjectContext } from './conveyance-subject.server';
import { closeCaseEngagements } from './conveyance-engagement-host.service';
import { readCaseViewers, readViewRevision, readViewRevisionInTx, signalCaseChangeInTx, signalViewsInTx } from './conveyance-view-signal.server';
import { changeOfCommand, type CaseViewers } from '@/lib/conveyance/view-signal-audience';

export interface ConveyanceActor {
  readonly uid: string;
  readonly email: string | null;
  readonly companyId: string;
}

export type ConveyanceFailure =
  | { readonly kind: 'property_not_found' }
  | { readonly kind: 'case_not_found' }
  | { readonly kind: 'corrupt_case' }
  | { readonly kind: 'version_conflict' }
  | { readonly kind: 'rejected'; readonly rejection: CommandRejection };

type ConveyanceOutcome<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly failure: ConveyanceFailure };

const fail = <T>(failure: ConveyanceFailure): ConveyanceOutcome<T> => ({ ok: false, failure });

/**
 * Ο κατάλογος όπως τον βλέπει ο οικοδεσπότης — ο ΙΔΙΟΣ υπολογισμός με τον client. Φ4.5: μαζί η ενότητα «Ζήτησε
 * έγγραφο» (παραλήπτες ανά γραμμή + τα αιτήματα της πλευράς του οικοδεσπότη), για **αυτόν** τον άνθρωπο του χώρου.
 */
async function buildView(db: Firestore, record: ConveyanceCase, context: ConveyanceSubjectContext, actor: ConveyanceActor, revision: number): Promise<ConveyanceCaseView> {
  const { files: evidence, sealed: sealedDeliveries } = await collectCaseEvidence(db, record, HOST_EVIDENCE_VIEWER);
  const derivedFacts = deriveFacts(context.factSources);
  const checklist = deriveCaseChecklist({ record, derivedFacts, evidence, sealed: sealedDeliveries, today: conveyanceToday(), viewer: 'host' });
  const state = effectiveCaseState(record.storedState, context.legalPhase);
  const party = { role: 'host', uid: actor.uid } as const;
  const documentRequests = await documentRequestPanel(db, { record, state, party, rows: checklist.rows, nowMs: Date.now() });
  const freshness = { revision, freshUntil: nextConveyanceDayStart().toISOString() };
  return { conveyanceCase: record, state, derivedFacts, evidence, sealedDeliveries, checklist, documentRequests, freshness };
}

async function recordAudit(actor: ConveyanceActor, record: ConveyanceCase, action: AuditAction, changes: readonly AuditFieldChange[], name: string | null): Promise<void> {
  await EntityAuditService.recordChange({
    entityType: 'conveyance_case',
    entityId: record.id,
    entityName: name,
    action,
    changes: [...changes],
    performedBy: actor.uid,
    performedByName: actor.email,
    companyId: actor.companyId,
  });
}

/** Η πιο πρόσφατη υπόθεση του ακινήτου (ανοιχτή ή όχι) — `null` αν δεν άνοιξε ποτέ. */
export async function getConveyanceCaseView(
  db: Firestore,
  actor: ConveyanceActor,
  propertyId: string,
): Promise<ConveyanceOutcome<ConveyanceCaseView | null>> {
  const context = await loadConveyanceSubject(db, actor.companyId, propertyId);
  if (!context) return fail({ kind: 'property_not_found' });
  // §14.8 — η αναθεώρηση ΠΡΙΝ από την υπόθεση: η όψη είναι πάντα τουλάχιστον τόσο φρέσκια όσο ο αριθμός της.
  const revision = await readViewRevision(db, { kind: 'host', propertyId, companyId: actor.companyId });
  const snap = await db.collection(COLLECTIONS.CONVEYANCE_CASES)
    .where('companyId', '==', actor.companyId)
    .where('subject.propertyId', '==', propertyId)
    .get();
  const parsed = snap.docs.map((doc) => parseConveyanceCase(doc.data()));
  const records = parsed.filter((record): record is ConveyanceCase => record !== null);
  if (records.length !== parsed.length) return fail({ kind: 'corrupt_case' });
  const latest = records.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  return { ok: true, value: latest ? await buildView(db, latest, context, actor, revision) : null };
}

function newCase(actor: ConveyanceActor, context: ConveyanceSubjectContext, now: string): ConveyanceCase {
  return {
    id: generateConveyanceCaseId(),
    companyId: actor.companyId,
    subject: context.subject,
    profile: context.factSources.profile,
    parties: context.parties,
    facts: {},
    overrides: {},
    storedState: 'open',
    targetSigningDate: null,
    catalogVersion: CONVEYANCE_CATALOG_VERSION,
    version: 0,
    createdBy: actor.uid,
    createdAt: now,
    updatedAt: now,
    cancellation: null,
  };
}

/** Ιδεμποτής: αν υπάρχει ανοιχτή υπόθεση για το ακίνητο, επιστρέφεται αυτή (`created: false`). */
export async function openConveyanceCase(
  db: Firestore,
  actor: ConveyanceActor,
  propertyId: string,
): Promise<ConveyanceOutcome<{ readonly view: ConveyanceCaseView; readonly created: boolean }>> {
  const context = await loadConveyanceSubject(db, actor.companyId, propertyId);
  if (!context) return fail({ kind: 'property_not_found' });
  const openQuery = db.collection(COLLECTIONS.CONVEYANCE_CASES)
    .where('companyId', '==', actor.companyId)
    .where('subject.propertyId', '==', propertyId)
    .where('storedState', '==', 'open');
  const hostView = { kind: 'host', propertyId, companyId: actor.companyId } as const;
  const outcome = await db.runTransaction(async (tx) => {
    const existing = await tx.get(openQuery);
    const revision = await readViewRevisionInTx(tx, db, hostView);
    const found = existing.docs.map((doc) => parseConveyanceCase(doc.data())).find((c): c is ConveyanceCase => c !== null);
    if (found) return { record: found, created: false, revision };
    const record = newCase(actor, context, nowISO());
    tx.create(db.collection(COLLECTIONS.CONVEYANCE_CASES).doc(record.id), record);
    // §14.8 — νέα υπόθεση: καμία συμμετοχή ακόμη ⇒ μόνο ο χώρος που κοιτά το ακίνητο.
    signalViewsInTx(tx, db, [hostView]);
    return { record, created: true, revision: revision + 1 };
  });
  if (outcome.created) {
    await recordAudit(actor, outcome.record, 'created', [{ field: 'state', oldValue: null, newValue: 'open' }], context.propertyName);
  }
  return { ok: true, value: { view: await buildView(db, outcome.record, context, actor, outcome.revision), created: outcome.created } };
}

/** Μία ανάγνωση υπόθεσης με σχήμα + ιδιοκτησία — ξένη ≡ ανύπαρκτη (ADR-742, καμία μαρτυρία ύπαρξης). */
function ownedCase(data: unknown, actor: ConveyanceActor, caseId: string): ConveyanceCase | null {
  return ownedOrNull(parseConveyanceCase(data), actor.companyId, { resource: 'conveyance case', resourceId: caseId, path: 'conveyance' });
}

/** Η υπόθεση, αν υπάρχει **και** ανήκει στον μισθωτή του δρώντα — αλλιώς `null`. */
export async function readOwnedConveyanceCase(db: Firestore, actor: ConveyanceActor, caseId: string): Promise<ConveyanceCase | null> {
  return ownedCase((await db.collection(COLLECTIONS.CONVEYANCE_CASES).doc(caseId).get()).data(), actor, caseId);
}

interface CommandCommit {
  readonly actor: ConveyanceActor;
  readonly initial: ConveyanceCase;
  readonly request: ConveyanceCommandRequest;
  readonly context: ConveyanceSubjectContext;
  readonly evidence: readonly EvidenceFile[];
  readonly viewers: CaseViewers;
}

/** Η συναλλαγή της εντολής: CAS → κρίση → εγγραφή **και** σήμα των όψεων που τη βλέπουν (§14.8), μαζί. */
function commitCommand(db: Firestore, input: CommandCommit): Promise<ConveyanceOutcome<{ next: ConveyanceCase; changes: readonly AuditFieldChange[]; revision: number }>> {
  const { actor, initial, request, context } = input;
  const ref = db.collection(COLLECTIONS.CONVEYANCE_CASES).doc(initial.id);
  return db.runTransaction(async (tx) => {
    const current = ownedCase((await tx.get(ref)).data(), actor, initial.id);
    const revision = await readViewRevisionInTx(tx, db, input.viewers.host);
    if (!current) return fail({ kind: 'case_not_found' });
    if (current.version !== request.expectedVersion) return fail({ kind: 'version_conflict' });
    if (!isCaseEditable(effectiveCaseState(current.storedState, context.legalPhase))) {
      return fail({ kind: 'rejected', rejection: 'not_editable' });
    }
    const now = nowISO();
    const applied = applyConveyanceCommand(current, request.command, { actorUid: actor.uid, now, today: conveyanceToday(), evidence: input.evidence });
    if (!applied.ok) return fail({ kind: 'rejected', rejection: applied.rejection });
    const next: ConveyanceCase = { ...applied.next, version: current.version + 1, updatedAt: now };
    tx.set(ref, next);
    // Κάθε εντολή αλλάζει την όψη του οικοδεσπότη (τη βλέπει ολόκληρη) ⇒ η δική του όψη είναι η αναθεώρηση + 1.
    signalCaseChangeInTx(tx, db, changeOfCommand(request.command), input.viewers);
    return { ok: true, value: { next, changes: applied.changes, revision: revision + 1 } };
  });
}

/**
 * Εφαρμογή εντολής με CAS: η εντολή δηλώνει την έκδοση που είδε· διαφορά ⇒ `version_conflict`.
 * `initial` = η υπόθεση όπως τη διάβασε ο καλών (`readOwnedConveyanceCase`) — η απόφαση
 * παίρνεται πάντα πάνω στην ξαναδιαβασμένη μέσα στο transaction.
 */
export async function applyConveyanceCaseCommand(
  db: Firestore,
  actor: ConveyanceActor,
  initial: ConveyanceCase,
  request: ConveyanceCommandRequest,
): Promise<ConveyanceOutcome<ConveyanceCaseView>> {
  const context = await loadConveyanceSubject(db, actor.companyId, initial.subject.propertyId);
  if (!context) return fail({ kind: 'property_not_found' });
  // Ίδιος δρόμος με την όψη ⇒ ο οικοδεσπότης ελέγχει (αποδέχεται/επιστρέφει) και ό,τι του **στάλθηκε** (Φ4.4).
  // Μόνο τα **τεκμήρια**: η σφραγισμένη παράδοση δεν ελέγχεται (Α35 — δεν έχει αρχείο να ελεγχθεί).
  const [{ files: evidence }, viewers] = await Promise.all([
    collectCaseEvidence(db, initial, HOST_EVIDENCE_VIEWER),
    readCaseViewers(db, initial, Date.now()),
  ]);
  const result = await commitCommand(db, { actor, initial, request, context, evidence, viewers });
  if (!result.ok) return result;

  const action: AuditAction = request.command.type === 'cancel' ? 'status_changed' : 'updated';
  await recordAudit(actor, result.value.next, action, result.value.changes, context.propertyName);
  // ADR-862 §5.3.3 — η ΚΥΡΙΑ λήξη: κλείσιμο/ακύρωση ⇒ οι συμμετοχές επαγγελματιών παύουν (ιδεμποτές).
  await closeCaseEngagements(db, actor, result.value.next, context.propertyName, Date.now());
  return { ok: true, value: await buildView(db, result.value.next, context, actor, result.value.revision) };
}
