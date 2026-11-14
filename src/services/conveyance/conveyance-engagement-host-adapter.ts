import 'server-only';

/**
 * @fileoverview **Ο ΟΙΚΟΔΕΣΠΟΤΗΣ ΤΗΣ ΜΕΤΑΒΙΒΑΣΗΣ** — ό,τι απαντά η υπόθεση μεταβίβασης στη μηχανή συμμετοχής.
 * @related ADR-862 §5.3.11 (μητρώο οικοδεσποτών) · ADR-901 Φ3 (πρόσκληση) · §5.4 («Οι υποθέσεις μου»)
 * @module services/conveyance/conveyance-engagement-host-adapter
 *
 * 🔑 **Μετακίνηση, όχι αντιγραφή**: ό,τι ήταν γραμμένο **μέσα** στην εξαργύρωση, την όψη και την υπενθύμιση της
 *    πρόσκλησης («ζει η υπόθεση;» · ο κατάλογος του ρόλου · η ειδοποίηση) ζει πλέον εδώ — η μηχανή πρόσκλησης
 *    ρωτά το μητρώο (`server/engagements/engagement-hosts.ts`) και δεν ξέρει τι είναι μεταβίβαση.
 * ⚠️ Οι πράξεις του γραφείου (πρόταση · τέλος · κλείσιμο) μένουν στο `conveyance-engagement-host.service.ts`.
 */

import type { Firestore, Transaction } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { acceptsEngagements, effectiveCaseState } from '@/lib/conveyance/case-state';
import { parseConveyanceCase } from '@/lib/conveyance/conveyance-case-schema';
import { legalRoleAuthority } from '@/lib/conveyance/declared-credential';
import { createModuleLogger } from '@/lib/telemetry';
import { readWorkspaceName } from '@/lib/workspace/workspace-catalog';
import type {
  EngagementHostAdapter,
  InvitationAnswer,
  InvitationAnswerer,
} from '@/server/engagements/engagement-host-adapter';
import type { EngagementHostLine } from '@/types/contact-professional-link';
import type { ConveyanceCase } from '@/types/conveyance-case';
import { TEMPLATE_OF_SUBJECT, type ConveyanceEngagement } from '@/types/engagement';
import type { ConveyanceEngagementInvitation, EngagementInvitationChecklist } from '@/types/engagement-invitation';
import {
  checklistForRole,
  engagementChecklistViewer,
  getEngagedCaseView,
  listCaseCards,
  readCaseOf,
} from './conveyance-engagement-access.service';
import {
  announceEngagementAnswered,
  announceInvitationDeclined,
  announceInvitationUnanswered,
} from './conveyance-engagement-notifier';
import { asCaseEngagement, answerChanges, recordEngagementAudit } from './conveyance-engagement-support';
import { loadConveyanceSubject } from './conveyance-subject.server';
import { caseRosterSignal, invitationHostSignal } from './conveyance-view-signal.server';

const logger = createModuleLogger('conveyance-engagement-host-adapter');

/** Η υπόθεση της πρόσκλησης — **μόνο** αν ανήκει στον μισθωτή της (ξένη ≡ ανύπαρκτη). */
function ownCase(raw: unknown, invitation: ConveyanceEngagementInvitation): ConveyanceCase | null {
  const record = parseConveyanceCase(raw);
  return record && record.companyId === invitation.hostCompanyId ? record : null;
}

function caseRef(db: Firestore, invitation: ConveyanceEngagementInvitation) {
  return db.collection(COLLECTIONS.CONVEYANCE_CASES).doc(invitation.caseId);
}

/** Ζει ακόμη η υπόθεση; — συμβουλευτικά πριν τη συναλλαγή (με τη **φάση** του ακινήτου). */
async function stillOpen(db: Firestore, invitation: ConveyanceEngagementInvitation): Promise<boolean> {
  const record = ownCase((await caseRef(db, invitation).get()).data(), invitation);
  if (!record) return false;
  const context = await loadConveyanceSubject(db, invitation.hostCompanyId, invitation.propertyId);
  return acceptsEngagements(effectiveCaseState(record.storedState, context?.legalPhase));
}

/** 🔴 Η αποθηκευμένη κατάσταση ξαναρωτιέται **μέσα** στη συναλλαγή: κλείσιμο/ακύρωση είναι ρητές πράξεις. */
async function stageOpen(db: Firestore, tx: Transaction, invitation: ConveyanceEngagementInvitation) {
  const record = ownCase((await tx.get(caseRef(db, invitation))).data(), invitation);
  return record && acceptsEngagements(record.storedState) ? caseRosterSignal(db, record) : null;
}

/** Οι μετρήσεις του καταλόγου **του ρόλου** — αποτυχία ⇒ `null`, ποτέ ψεύτικο «0». */
async function checklistOf(db: Firestore, invitation: ConveyanceEngagementInvitation): Promise<EngagementInvitationChecklist | null> {
  const record = ownCase((await caseRef(db, invitation).get()).data(), invitation);
  if (!record) return null;
  const context = await loadConveyanceSubject(db, record.companyId, record.subject.propertyId);
  if (!context) return null;
  const viewer = engagementChecklistViewer({ role: invitation.role, template: TEMPLATE_OF_SUBJECT.conveyance_case });
  const { summary } = await checklistForRole(db, record, context, viewer);
  return { applicable: summary.applicable, complete: summary.complete, missing: summary.missing };
}

async function propertyNameOf(db: Firestore, invitation: ConveyanceEngagementInvitation): Promise<string | null> {
  return (await loadConveyanceSubject(db, invitation.hostCompanyId, invitation.propertyId).catch(() => null))?.propertyName ?? null;
}

/** Η **μία** περιγραφή της πρόσκλησης υπόθεσης — για την όψη (`describe` του οικοδεσπότη) **και** το email της. */
export async function describeConveyanceInvitation(db: Firestore, invitation: ConveyanceEngagementInvitation) {
  const [propertyLabel, workspaceName, checklist] = await Promise.all([
    propertyNameOf(db, invitation),
    readWorkspaceName(invitation.hostCompanyId).catch(() => ''),
    checklistOf(db, invitation).catch((error: unknown) => {
      logger.warn('Ο κατάλογος της πρόσκλησης δεν διαβάστηκε', { invitationId: invitation.id, error: String(error) });
      return null;
    }),
  ]);
  return {
    propertyLabel,
    hostName: workspaceName.trim().length > 0 ? workspaceName.trim() : null,
    subject: { kind: 'conveyance_case', role: invitation.role, checklist },
  } as const;
}

/** Ίχνος στο βιβλίο του οικοδεσπότη (await — ορθότητα) → ειδοποίηση του προσκαλούντος (ποτέ δεν πετά). */
async function afterAnswer(
  db: Firestore,
  invitation: ConveyanceEngagementInvitation,
  answer: InvitationAnswer,
  answerer: InvitationAnswerer,
): Promise<void> {
  const propertyName = await propertyNameOf(db, invitation);
  if (answer.kind === 'declined') {
    await announceInvitationDeclined(invitation, propertyName);
    return;
  }
  const engagement = asCaseEngagement(answer.engagement);
  await recordEngagementAudit({
    engagement, action: 'created', changes: answerChanges(null, engagement),
    performedBy: answerer.uid, performedByName: answerer.email, entityName: propertyName,
  });
  await announceEngagementAnswered(engagement, invitation.propertyId, propertyName);
}

/** ADR-915 §40 — η γραμμή «Ανέλαβε» στην επαφή του γραφείου: ποιο ακίνητο (η μεταβίβαση δεν έχει είδος εγγράφου). */
async function hostLine(db: Firestore, engagement: ConveyanceEngagement): Promise<EngagementHostLine> {
  const record = await readCaseOf(db, engagement).catch(() => null);
  const context = record ? await loadConveyanceSubject(db, record.companyId, record.subject.propertyId).catch(() => null) : null;
  return { propertyName: context?.propertyName ?? null, documentKind: null };
}

export const CONVEYANCE_ENGAGEMENT_HOST: EngagementHostAdapter<ConveyanceEngagementInvitation, ConveyanceEngagement> = {
  invitationSignal: (db, invitation) => invitationHostSignal(db, invitation),
  stillOpen,
  stageOpen,
  credentialAuthority: (invitation) => legalRoleAuthority(invitation.role),
  describe: describeConveyanceInvitation,
  afterAnswer,
  announceUnanswered: async (db, invitation) => announceInvitationUnanswered(invitation, await propertyNameOf(db, invitation)),
  listCards: (db, viewer, history, nowMs) => listCaseCards(db, viewer, history, nowMs),
  view: (db, viewer, engagement, nowMs) => getEngagedCaseView(db, viewer, engagement.id, nowMs),
  hostLine,
};
