/**
 * @fileoverview **Ο ΕΝΑΣ γραφέας πεδίων ευκαιρίας** — δημιουργία · επεξεργασία · διαγραφή, με ιστορικό (ADR-930 §3.10).
 * @module services/opportunities-server.service
 *
 * Οι τρεις γραφείς της ευκαιρίας: **στάδιο** → `opportunity-stage-transition.server.ts` · **κάτοχος** →
 * `opportunity-owner-transfer.server.ts` · **όλα τα άλλα** → εδώ. Ο browser δεν γράφει πια τη συλλογή.
 *
 * 🔑 **ΕΝΑ σχήμα**: τα πεδία του `Opportunity` (`opportunity-fields-schema.ts`). Ως 2026-11-06 εδώ γραφόταν
 *    `name`/`value`/`leadId` — σχήμα που δεν διάβαζε κανείς.
 * 🔑 **Σύγκρουση κατά ΠΕΔΙΟ** (πάνω από Salesforce/HubSpot/Pipedrive, που κάνουν last-write-wins): 409 μόνο αν άλλαξε
 *    στο μεταξύ ένα από τα πεδία **που αλλάζει αυτός** — και όχι αν ο άλλος έγραψε ήδη την ίδια τιμή. Ένας έλεγχος
 *    `_v` όλου του εγγράφου θα ακύρωνε την επεξεργασία κάθε φορά που κάποιος σέρνει την κάρτα.
 * 🔑 Ανάγνωση + έλεγχος + εγγραφή σε **μία** συναλλαγή· `_v`↑ (`versionedWrite`) · ιστορικό **μετά** το commit
 *    (`recordEntityUpdate`, δηλωμένος γραφέας του CHECK 3.17)· καμία διαφορά ⇒ καμία γραφή, καμία γραμμή.
 * 🔑 Η διαγραφή κρατά στη γραμμή ιστορικού **τις τελευταίες τιμές** — η ευκαιρία ανασυντίθεται από το ιστορικό.
 * ⚠️ Φράχτης μισθωτή **και** εξουσία κατόχου (`requireOpportunityAccess`) είναι ευθύνη του route, **πριν**. Ο έλεγχος
 *    μισθωτή εδώ μέσα είναι η δεύτερη ζώνη (ADR-742 §4) — δεν τον αντικαθιστά.
 */

import 'server-only';

import type { Firestore } from 'firebase-admin/firestore';

import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { COLLECTIONS } from '@/config/firestore-collections';
import { OPPORTUNITY_STAGE_IDS, STATUS_OF_STAGE_KIND, stageSpec } from '@/config/crm/opportunity-stages';
import { getTrackedFieldsForEntityAuditType } from '@/config/audit-tracked-fields';
import { generateOpportunityId } from '@/services/enterprise-id.service';
import { createModuleLogger } from '@/lib/telemetry';
import { isPayloadOwnedByCompany } from '@/lib/auth/tenant-ownership';
import { nowISO, withIsoDateFields } from '@/lib/date-local';
import { serializeScalar } from '@/lib/audit/audit-diff';
import { versionedWrite } from '@/lib/firestore/version-check';
import { isActiveWorkspaceMemberInTx } from '@/lib/workspace/active-member-in-transaction';
import { recordEntityUpdate, type AuditActor } from '@/services/audit/record-entity-update';
import { EntityAuditService } from '@/services/entity-audit.service';
import { opportunityAuditResolvers } from '@/services/crm/opportunity-audit-resolvers.server';
import {
  OPPORTUNITY_DATE_FIELDS,
  type OpportunityCreateBody,
  type OpportunityEditableField,
  type OpportunityUpdateBody,
} from '@/services/crm/opportunity-fields-schema';

const logger = createModuleLogger('OpportunitiesServerService');

export type OpportunityCreateOutcome =
  | { readonly kind: 'created'; readonly id: string }
  | { readonly kind: 'invalid'; readonly reason: 'owner_not_member' };

export type OpportunityUpdateOutcome =
  | { readonly kind: 'applied' }
  | { readonly kind: 'unchanged' }
  | { readonly kind: 'conflict'; readonly fields: readonly OpportunityEditableField[]; readonly updatedBy: string | null }
  /** Ανύπαρκτη ή άλλου μισθωτή — η δεύτερη ζώνη (το route έχει ήδη απαντήσει 404). */
  | { readonly kind: 'refused' };

export type OpportunityRemoveOutcome = { readonly kind: 'deleted' } | { readonly kind: 'refused' };

interface UpdateCommit {
  readonly outcome: OpportunityUpdateOutcome;
  readonly before?: Readonly<Record<string, unknown>>;
  readonly written?: Readonly<Record<string, unknown>>;
}

const REFUSED = { kind: 'refused' } as const;

function getDb(): Firestore {
  const db = getAdminFirestore();
  if (!db) throw new Error('Admin Firestore unavailable');
  return db;
}

const textOrNull = (value: unknown): string | null => (typeof value === 'string' && value !== '' ? value : null);

/** «Ίδια τιμή;» με τον ΕΝΑΝ συγκριτή του ιστορικού: κενό = `null` = `''` = λείπει· αντικείμενα ανεξαρτήτως σειράς κλειδιών. */
const sameValue = (a: unknown, b: unknown): boolean => serializeScalar(a ?? null) === serializeScalar(b ?? null);

/** Το νέο έγγραφο: τα πεδία του αιτήματος + ό,τι παράγεται (κατάσταση από στάδιο, κάτοχος, στιγμές). */
function buildNewOpportunity(id: string, body: OpportunityCreateBody, actor: AuditActor, nowIso: string): Record<string, unknown> {
  const { stage: requestedStage, assignedTo, ...fields } = body;
  const stage = requestedStage ?? OPPORTUNITY_STAGE_IDS[0];
  const spec = stageSpec(stage);
  return {
    ...fields,
    id,
    companyId: actor.companyId,
    createdBy: actor.uid,
    assignedTo: assignedTo ?? actor.uid,
    stage,
    status: STATUS_OF_STAGE_KIND[spec.kind],
    probability: fields.probability ?? spec.defaultProbability,
    stageChangedAt: nowIso,
    lastActivity: nowIso,
    createdAt: nowIso,
  };
}

/** Τα πεδία που αλλάζει το αίτημα — ή `conflicts` όσα άλλαξαν στο μεταξύ σε **άλλη** τιμή από αυτήν που ζητείται. */
function planFieldUpdate(
  before: Readonly<Record<string, unknown>>,
  body: OpportunityUpdateBody,
): { readonly conflicts: readonly OpportunityEditableField[]; readonly written: Record<string, unknown> } {
  const stored = withIsoDateFields(before, OPPORTUNITY_DATE_FIELDS);
  const fields = Object.keys(body.changes) as OpportunityEditableField[];
  const conflicts = fields.filter(
    (field) => !sameValue(stored[field], body.expected[field]) && !sameValue(stored[field], body.changes[field]),
  );
  const effective = fields.filter((field) => !sameValue(stored[field], body.changes[field]));
  return { conflicts, written: Object.fromEntries(effective.map((field) => [field, body.changes[field] ?? null])) };
}

async function commitUpdate(db: Firestore, id: string, body: OpportunityUpdateBody, actor: AuditActor): Promise<UpdateCommit> {
  const ref = db.collection(COLLECTIONS.OPPORTUNITIES).doc(id);
  return db.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    const before: Readonly<Record<string, unknown>> | undefined = snapshot.data();
    // 🔴 ADR-742 §4 — «χωρίς μισθωτή» ΔΕΝ σημαίνει «ελεύθερο»: το `isPayloadOwnedByCompany` αρνείται το κενό.
    if (!snapshot.exists || !before || !isPayloadOwnedByCompany(before, actor.companyId)) return { outcome: REFUSED };

    const { conflicts, written } = planFieldUpdate(before, body);
    if (conflicts.length > 0) {
      return { outcome: { kind: 'conflict', fields: conflicts, updatedBy: textOrNull(before.updatedBy) } };
    }
    if (Object.keys(written).length === 0) return { outcome: { kind: 'unchanged' } };

    tx.update(ref, versionedWrite(before, written, actor.uid).data);
    return { outcome: { kind: 'applied' }, before, written };
  });
}

/** Κάθε παρακολουθούμενο πεδίο → `null`: η γραμμή διαγραφής κρατά ό,τι χάθηκε (παλιά τιμή → —). */
function clearedTrackedFields(): Record<string, null> {
  return Object.fromEntries(Object.keys(getTrackedFieldsForEntityAuditType('opportunity') ?? {}).map((field) => [field, null]));
}

export class OpportunitiesServerService {
  /** Νέα ευκαιρία — ο αρχικός κάτοχος, αν δεν είναι ο δημιουργός, πρέπει να είναι ενεργό μέλος του χώρου. */
  static async create(body: OpportunityCreateBody, actor: AuditActor): Promise<OpportunityCreateOutcome> {
    const db = getDb();
    const id = generateOpportunityId();
    const document = buildNewOpportunity(id, body, actor, nowISO());
    const ownerUid = String(document.assignedTo);
    const created = await db.runTransaction(async (tx) => {
      if (ownerUid !== actor.uid && !(await isActiveWorkspaceMemberInTx(tx, db, actor.companyId, ownerUid))) return false;
      tx.create(db.collection(COLLECTIONS.OPPORTUNITIES).doc(id), versionedWrite({}, document, actor.uid).data);
      return true;
    });
    if (!created) return { kind: 'invalid', reason: 'owner_not_member' };

    await recordEntityUpdate({
      entityType: 'opportunity', entityId: id, before: {}, written: document, action: 'created', ctx: actor,
      entityName: body.title, resolvers: opportunityAuditResolvers(db, actor.companyId),
    });
    logger.info('Created opportunity', { id, companyId: actor.companyId });
    // ADR-029 Phase D: search_documents written by Cloud Function onOpportunityWrite.
    return { kind: 'created', id };
  }

  /** Αλλαγή πεδίων — ποτέ στάδιο ή κάτοχος (το σχήμα δεν τα γνωρίζει· έχουν τις δικές τους πόρτες). */
  static async update(id: string, body: OpportunityUpdateBody, actor: AuditActor): Promise<OpportunityUpdateOutcome> {
    const db = getDb();
    const committed = await commitUpdate(db, id, body, actor);
    if (committed.outcome.kind === 'applied' && committed.before && committed.written) {
      await recordEntityUpdate({
        entityType: 'opportunity', entityId: id, before: committed.before, written: committed.written, ctx: actor,
        entityName: textOrNull(committed.written.title) ?? textOrNull(committed.before.title),
        resolvers: opportunityAuditResolvers(db, actor.companyId),
      });
    }
    return committed.outcome;
  }

  /** Οριστική διαγραφή — η γραμμή ιστορικού κρατά τις τελευταίες τιμές. */
  static async remove(id: string, actor: AuditActor): Promise<OpportunityRemoveOutcome> {
    const db = getDb();
    const ref = db.collection(COLLECTIONS.OPPORTUNITIES).doc(id);
    const before = await db.runTransaction(async (tx) => {
      const snapshot = await tx.get(ref);
      const data = snapshot.data();
      if (!snapshot.exists || !data || !isPayloadOwnedByCompany(data, actor.companyId)) return null;
      tx.delete(ref);
      return data;
    });
    if (!before) return REFUSED;

    const entityName = textOrNull(before.title);
    const recorded = await recordEntityUpdate({
      entityType: 'opportunity', entityId: id, before, written: clearedTrackedFields(), action: 'deleted', ctx: actor,
      entityName, resolvers: opportunityAuditResolvers(db, actor.companyId),
    });
    // Δίχτυ: έγγραφο χωρίς καμία παρακολουθούμενη τιμή ⇒ καμία διαφορά — η διαγραφή γράφεται ΠΑΝΤΑ.
    if (recorded.auditId === null) {
      await EntityAuditService.recordChange({
        entityType: 'opportunity', entityId: id, entityName, action: 'deleted', changes: [],
        performedBy: actor.uid, performedByName: actor.email ?? null, companyId: textOrNull(before.companyId) ?? actor.companyId,
      });
    }
    logger.info('Deleted opportunity', { id });
    // ADR-029 Phase D: search_documents row cleaned up by Cloud Function onOpportunityWrite (delete branch).
    return { kind: 'deleted' };
  }
}
