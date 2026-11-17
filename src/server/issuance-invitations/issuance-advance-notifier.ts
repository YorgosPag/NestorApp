import 'server-only';

/**
 * @fileoverview ADR-943 §5.9 · Φ5α — **οι ειδοποιήσεις της προκαταβολής**: τα ορόσημα των χρημάτων («κατατέθηκε — μπορείτε
 *   να ξεκινήσετε» · «έγινε η αυτοψία — αποδεσμεύεται στις …» · «αποδεσμεύτηκε») και «ο ιδιοκτήτης θέλει να πληρώσει —
 *   ενεργοποιήστε τη λήψη πληρωμών» (μηχανικός).
 * @related issuance-delivery-change-notifier.ts (το ίδιο ιδίωμα) · issuance-active-engagement.ts (ο ΕΝΑΣ δρόμος προς τον μηχανικό)
 * @module server/issuance-invitations/issuance-advance-notifier
 *
 * 🔑 **Ποτέ δεν πετά**: τα χρήματα γράφτηκαν ήδη· χαμένη ειδοποίηση δεν τα αναιρεί (το διπλότυπο το κόβει το `eventId`).
 * 🔒 Ε-9′: προς τον μηχανικό **κανένα** στοιχείο επικοινωνίας του ιδιοκτήτη ή του γραφείου — ποσό και ακίνητο μόνο.
 */

import type { Firestore } from 'firebase-admin/firestore';

import { getCurrentEnvironment, NOTIFICATION_EVENT_TYPES, SOURCE_SERVICES } from '@/config/notification-events';
import { createBundleTranslate } from '@/i18n/bundle-translate';
import elShared from '@/i18n/locales/el/common-shared.json';
import { documentExpiryHref } from '@/lib/document-validity/document-registry-view';
import { issuanceKeyOf, type IssuanceAssignmentRecord } from '@/lib/document-validity/issuance-assignment';
import { objectionUntilOf, type AdvanceEvent } from '@/lib/document-validity/issuance-advance';
import { formatMinorIn } from '@/lib/money/money';
import { formatOperatorDateTime } from '@/lib/operator-time-format';
import { viewDestination } from '@/lib/notifications/notification-destination';
import { PRIVATE_PROFILE_ROUTE } from '@/lib/routes/accountRoutes';
import { createModuleLogger } from '@/lib/telemetry';
import { dispatchNotification } from '@/server/notifications/notification-orchestrator';
import { caseEngagementChangedDestination } from '@/services/conveyance/conveyance-engagement-notifier';
import type { DocumentRegistryResponse, RegistryPropertyLabel } from '@/services/document-registry/document-registry.types';
import type { DocumentIssuanceAssignment } from '@/services/document-registry/issuance-assignment-schema';
import { orgWorkspace, personalWorkspace } from '@/types/workspace-membership';

import { activeIssuanceEngagementOf } from './issuance-active-engagement';

const logger = createModuleLogger('issuance-advance-notifier');
const FEATURE = 'document-issuance-advance';
/** Οι ειδοποιήσεις αποδίδονται στα ελληνικά στον διακομιστή (κλειδί + παράμετροι αποθηκεύονται για επαναπόδοση). */
const noticeT = createBundleTranslate({ 'common-shared': elShared }, 'common-shared', 'el');

const SOURCE = () => ({ service: SOURCE_SERVICES.PROPERTIES, feature: FEATURE, env: getCurrentEnvironment() });

/** Η ανάθεση όπως τη διάβασε ο καλών (`readHostedIssuanceContext`). */
export interface AdvanceNoticeContext {
  readonly assignment: Pick<DocumentIssuanceAssignment, 'id' | 'companyId' | 'propertyId' | 'documentKind'>;
  readonly registry: DocumentRegistryResponse;
  readonly label: RegistryPropertyLabel;
}

async function send(input: Parameters<typeof dispatchNotification>[0]): Promise<void> {
  try {
    await dispatchNotification(input);
  } catch (error) {
    logger.error('Η ειδοποίηση προκαταβολής δεν στάλθηκε', { eventId: input.eventId, error: error instanceof Error ? error.message : String(error) });
  }
}

/** Ένα ορόσημο των χρημάτων — το γεγονός που το γέννησε (η ταυτότητα της ειδοποίησης και τα ποσά βγαίνουν από αυτό). */
export type AdvanceMilestone = Extract<AdvanceEvent, { kind: 'funded' | 'work-started' | 'released' }>;

interface MilestoneNotice {
  readonly eventType: Parameters<typeof dispatchNotification>[0]['eventType'];
  readonly key: 'funded' | 'workStarted' | 'released';
  /** Η ταυτότητα του ορόσημου — μία ειδοποίηση ανά ορόσημο και αποδέκτη, όσες φορές κι αν ξανατρέξει ο καλών. */
  readonly identity: string;
  readonly bodyParams: Readonly<Record<string, string>>;
  /** Ο μηχανικός μαθαίνει **ό,τι δεν έκανε ο ίδιος**· την αυτοψία τη δήλωσε εκείνος. */
  readonly toEngineer: boolean;
}

/** Ορόσημο ⇒ ειδοποίηση. Το ποσό είναι **το ποσό του γεγονότος** — ποτέ το εγκεκριμένο. */
function noticeOf(milestone: AdvanceMilestone, fundedMinor: number): MilestoneNotice {
  const { PROPERTIES_DOCUMENT_ISSUANCE_ADVANCE_FUNDED: FUNDED, PROPERTIES_DOCUMENT_ISSUANCE_ADVANCE_WORK_STARTED: STARTED, PROPERTIES_DOCUMENT_ISSUANCE_ADVANCE_RELEASED: RELEASED } = NOTIFICATION_EVENT_TYPES;
  switch (milestone.kind) {
    case 'funded':
      return { eventType: FUNDED, key: 'funded', identity: milestone.paymentReference, bodyParams: { amount: formatMinorIn(milestone.amountMinor, 'el') }, toEngineer: true };
    case 'work-started':
      return {
        eventType: STARTED, key: 'workStarted', identity: `started:${milestone.at}`, toEngineer: false,
        bodyParams: { amount: formatMinorIn(fundedMinor, 'el'), releaseAt: formatOperatorDateTime(objectionUntilOf(milestone.at), 'el') },
      };
    case 'released':
      return { eventType: RELEASED, key: 'released', identity: milestone.transferReference, bodyParams: { amount: formatMinorIn(milestone.amountMinor, 'el') }, toEngineer: true };
  }
}

function fundedMinorOf(record: IssuanceAssignmentRecord): number {
  return record.advanceEvents.reduce((sum, event) => (event.kind === 'funded' ? sum + event.amountMinor : sum), 0);
}

/**
 * **Ένα ορόσημο των χρημάτων** (Κ-4): σε όποιον πρότεινε / έστειλε στο γραφείο, και στον μηχανικό — **μόνο** με ενεργή
 * συμμετοχή, και μόνο για ό,τι δεν έκανε ο ίδιος. Μία ανά ορόσημο και αποδέκτη. Ποτέ δεν πετά.
 */
export async function announceAdvanceMilestone(
  db: Firestore,
  input: { readonly context: AdvanceNoticeContext; readonly record: IssuanceAssignmentRecord; readonly milestone: AdvanceMilestone; readonly now: Date },
): Promise<void> {
  try {
    const { context, record } = input;
    const { assignment } = context;
    const notice = noticeOf(input.milestone, fundedMinorOf(record));
    const titleParams = { title: context.label.name ?? assignment.id };
    const content = (recipientId: string) => ({
      eventType: notice.eventType,
      recipientId,
      tenantId: assignment.companyId,
      title: noticeT(`documentIssuanceAdvance.${notice.key}`, titleParams),
      titleKey: `documentIssuanceAdvance.${notice.key}`,
      titleParams,
      body: noticeT(`documentIssuanceAdvance.${notice.key}Body`, notice.bodyParams),
      bodyKey: `documentIssuanceAdvance.${notice.key}Body`,
      bodyParams: notice.bodyParams,
      eventId: `document-issuance-advance-${notice.key}:${assignment.id}:${notice.identity}:${recipientId}`,
      source: SOURCE(),
    });
    const engagement = notice.toEngineer ? await activeIssuanceEngagementOf(db, assignment, context.registry, input.now.toISOString()) : null;
    const office = viewDestination(documentExpiryHref(undefined, { doc: issuanceKeyOf(assignment.propertyId, assignment.documentKind) }), orgWorkspace(assignment.companyId));
    const officeUids = [...new Set([record.proposedByUid, ...(record.notice === null ? [] : [record.notice.byUid])])];
    await Promise.all([
      ...officeUids.map((uid) => send({ ...content(uid), ...office })),
      ...(engagement === null ? [] : [caseEngagementChangedDestination(engagement).then((dest) => send({ ...content(engagement.uid), ...dest }))]),
    ]);
  } catch (error) {
    logger.error('Το ορόσημο προκαταβολής δεν ανακοινώθηκε', { milestone: input.milestone.kind, error: error instanceof Error ? error.message : String(error) });
  }
}

/** Το τελευταίο γεγονός ενός είδους — το ορόσημο που μόλις γράφτηκε. */
export function latestAdvanceMilestone<K extends AdvanceMilestone['kind']>(record: IssuanceAssignmentRecord, kind: K): Extract<AdvanceMilestone, { kind: K }> | null {
  const found = [...record.advanceEvents].reverse().find((event): event is Extract<AdvanceMilestone, { kind: K }> => event.kind === kind);
  return found ?? null;
}

/** «Η προκαταβολή κατατέθηκε και κρατείται — μπορείτε να ξεκινήσετε». */
export async function announceAdvanceFunded(
  db: Firestore,
  input: { readonly context: AdvanceNoticeContext; readonly record: IssuanceAssignmentRecord; readonly now: Date },
): Promise<void> {
  const milestone = latestAdvanceMilestone(input.record, 'funded');
  if (milestone !== null) await announceAdvanceMilestone(db, { ...input, milestone });
}

/**
 * «Ο ιδιοκτήτης θέλει να πληρώσει την προκαταβολή — ενεργοποιήστε τη λήψη πληρωμών» (πρακτική Airbnb/Upwork: πρώτα
 * τρόπος απόδοσης, μετά χρήματα). Προς τον μηχανικό, προσγείωση στο προφίλ του. Μία ανά ανάθεση **και ημέρα**: ο
 * ιδιοκτήτης μπορεί να ξαναδοκιμάσει πολλές φορές, ο μηχανικός δεν ενοχλείται πάνω από μία φορά τη μέρα.
 */
export async function announcePayeeRequired(
  input: { readonly context: AdvanceNoticeContext; readonly engineerUid: string; readonly now: Date },
): Promise<void> {
  const { context, engineerUid } = input;
  const titleParams = { title: context.label.name ?? context.assignment.id };
  await send({
    eventType: NOTIFICATION_EVENT_TYPES.PROPERTIES_DOCUMENT_ISSUANCE_ADVANCE_PAYEE_REQUIRED,
    recipientId: engineerUid,
    tenantId: context.assignment.companyId,
    title: noticeT('documentIssuanceAdvance.payeeRequired', titleParams),
    titleKey: 'documentIssuanceAdvance.payeeRequired',
    titleParams,
    body: noticeT('documentIssuanceAdvance.payeeRequiredBody', {}),
    bodyKey: 'documentIssuanceAdvance.payeeRequiredBody',
    bodyParams: {},
    eventId: `document-issuance-advance-payee-required:${context.assignment.id}:${input.now.toISOString().slice(0, 10)}:${engineerUid}`,
    ...viewDestination(PRIVATE_PROFILE_ROUTE, personalWorkspace(engineerUid)),
    source: SOURCE(),
  });
}
