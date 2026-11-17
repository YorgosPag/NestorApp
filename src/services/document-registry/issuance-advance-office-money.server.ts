import 'server-only';

/**
 * @fileoverview ADR-943 Φ5γ (Θ-3) — **οι πράξεις του γραφείου που κινούν κρατημένα χρήματα**: ακύρωση (Ζ-4) και απόφαση
 *   διαφοράς (Ζ-5). Πριν γραφτεί το γεγονός, γράφεται η εντολή χρημάτων της εγγραφής **όπως θα είναι** — από τον ΙΔΙΟ
 *   μειωτή (καθαρός) και τον ΕΝΑ παραγωγό. Μετά το γεγονός, η εντολή εκτελείται αμέσως και οι πλευρές ενημερώνονται.
 * @related issuance-assignment.service.ts (η πόρτα του γραφείου) · issuance-advance-settlement-order.server.ts (ο παραγωγός) ·
 *   lib/document-validity/issuance-advance-settlement.ts (η κρίση)
 * @module services/document-registry/issuance-advance-office-money.server
 *
 * 🔑 **Πρώτα η εντολή, μετά το γεγονός**: εντολή που δεν γράφτηκε (`busy`) ⇒ το γεγονός **δεν** γράφεται (`settlement-busy`,
 *    ο άνθρωπος ξαναπατά). Γεγονός που απέτυχε μετά την εντολή ⇒ ο εκτελεστής ρωτά τον τομέα και η εντολή σβήνει ή
 *    ξαναγράφεται (Θ-2) — κανένα χρήμα δεν κινείται χωρίς γεγονός, καμία κίνηση δεν ξεχνιέται.
 * 🔑 Η πρόβλεψη τρέχει τον μειωτή με την **ίδια** στιγμή (`nowIso`) με την εγγραφή: ίδια ακύρωση ⇒ ίδιο `dueAt` ⇒ ίδια εντολή.
 */

import type { Firestore } from 'firebase-admin/firestore';

import { issuanceKeyOf, reduceIssuance, type IssuanceAssignmentRecord } from '@/lib/document-validity/issuance-assignment';
import { advanceSettlementDueOf } from '@/lib/document-validity/issuance-advance-settlement';
import { issuanceActionOf, type IssuanceAssignmentBody } from '@/lib/document-validity/issuance-request';
import { createModuleLogger } from '@/lib/telemetry';
import { issueAdvanceLink } from '@/server/issuance-invitations/issuance-advance-link';
import { announceAdvanceMilestone, latestAdvanceMilestone } from '@/server/issuance-invitations/issuance-advance-notifier';

import type { DocumentRegistryResponse } from './document-registry.types';
import { ensureAdvanceSettlement, settleAdvanceNow, type EnsureSettlementResult } from './issuance-advance-settlement-order.server';
import { issuanceAssignmentIdOf, issuanceRecordOf } from './issuance-assignment-schema';
import { readHostedIssuanceAssignment } from './issuance-engagement-host-adapter';

const logger = createModuleLogger('IssuanceAdvanceOfficeMoney');

/** Οι πράξεις του γραφείου που μπορεί να κινήσουν κρατημένα χρήματα. */
const MONEY_MOVING_ACTIONS: ReadonlySet<IssuanceAssignmentBody['action']> = new Set(['cancel', 'resolve-advance-dispute']);

export interface OfficeMoneyInput {
  readonly companyId: string;
  readonly uid: string;
  readonly body: IssuanceAssignmentBody;
  readonly latestIssuedOn: string | null;
  readonly now: Date;
}

/** `null` ⇒ η πράξη δεν κινεί χρήματα (ή ο μειωτής θα την αρνηθεί / δεν αλλάζει τίποτα — ο γραφέας λέει το ίδιο). */
export type OfficeMoneyOrder = EnsureSettlementResult | null;

/** **Η εντολή πριν από το γεγονός** — βλ. κεφαλίδα. Σφάλμα βάσης ⇒ ρίχνει (τίποτα δεν γράφτηκε). */
export async function orderMoneyBeforeOfficeAction(db: Firestore, input: OfficeMoneyInput): Promise<OfficeMoneyOrder> {
  const { body, companyId, now } = input;
  if (!MONEY_MOVING_ACTIONS.has(body.action)) return null;
  const assignmentId = issuanceAssignmentIdOf(companyId, body.propertyId, body.documentKind);
  const assignment = await readHostedIssuanceAssignment(db, companyId, assignmentId);
  if (assignment === null) return null;
  const reduced = reduceIssuance(body.documentKind, issuanceRecordOf(assignment), input.latestIssuedOn, issuanceActionOf(body), {
    kind: 'office', uid: input.uid, nowIso: now.toISOString(),
  });
  if (!reduced.ok || !reduced.changed) return null;
  return ensureAdvanceSettlement(db, { companyId, assignmentId, record: reduced.record, nowMs: now.getTime() });
}

/** Μετά το γεγονός: η εντολή που οφείλεται ήδη εκτελείται τώρα (ποτέ δεν πετά — αλλιώς το cron). */
export async function settleAfterOfficeAction(db: Firestore, order: OfficeMoneyOrder, now: Date): Promise<void> {
  if (order !== null) await settleAdvanceNow(db, order, now.getTime());
}

export interface OfficeMoneyNoticeInput {
  readonly companyId: string;
  readonly uid: string;
  readonly body: IssuanceAssignmentBody;
  /** Η εγγραφή **μετά** την πράξη. */
  readonly record: IssuanceAssignmentRecord;
  readonly registry: DocumentRegistryResponse;
  readonly now: Date;
}

/**
 * Μετά το γεγονός: η απόφαση διαφοράς ανακοινώνεται (γραφείο με αιτιολογία, μηχανικός χωρίς — Ε-9′), και ο ιδιοκτήτης
 * μαθαίνει **με email** τι του επιστρέφεται (νέος σύνδεσμος προς τη σελίδα του — Ζ-1). Ποτέ δεν πετά.
 */
export async function announceOfficeMoneyAction(db: Firestore, input: OfficeMoneyNoticeInput): Promise<void> {
  const { body, record, registry, companyId, now } = input;
  const label = registry.properties[body.propertyId];
  const assignment = await readHostedIssuanceAssignment(db, companyId, issuanceAssignmentIdOf(companyId, body.propertyId, body.documentKind));
  if (label === undefined || assignment === null) return;
  const resolved = body.action === 'resolve-advance-dispute' ? latestAdvanceMilestone(record, 'dispute-resolved') : null;
  if (resolved !== null) await announceAdvanceMilestone(db, { context: { assignment, registry, label }, record, milestone: resolved, now });
  if (advanceSettlementDueOf(record) === null) return;
  const latestIssuedOn = registry.issuance[issuanceKeyOf(body.propertyId, body.documentKind)]?.latestIssuedOn ?? null;
  const told = await issueAdvanceLink(db, {
    context: { assignment, registry, label, latestIssuedOn }, record, moment: 'settlement', actorUid: input.uid, requireAccessCode: false, now,
  });
  if (!told.ok) logger.warn('Owner not emailed about the advance settlement', { assignmentId: assignment.id, refusal: told.refusal });
}
