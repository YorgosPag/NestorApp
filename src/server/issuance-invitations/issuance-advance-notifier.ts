import 'server-only';

/**
 * @fileoverview ADR-943 §5.9 — **οι ειδοποιήσεις της προκαταβολής**: «η προκαταβολή κατατέθηκε — μπορείτε να ξεκινήσετε»
 *   (μηχανικός στον χώρο του + γραφείο) και «ο ιδιοκτήτης θέλει να πληρώσει — ενεργοποιήστε τη λήψη πληρωμών» (μηχανικός).
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
import { advanceStateOf } from '@/lib/document-validity/issuance-advance';
import { formatMinorIn } from '@/lib/money/money';
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

/** Το ποσό που **εισπράχθηκε** (από τα γεγονότα, η μία κρίση) — ποτέ το εγκεκριμένο. */
function fundedAmountOf(record: IssuanceAssignmentRecord): string {
  const state = advanceStateOf(record);
  return state.kind === 'held' ? formatMinorIn(state.fundedMinor, 'el') : '';
}

/**
 * «Η προκαταβολή κατατέθηκε και κρατείται — μπορείτε να ξεκινήσετε» (Κ-4): στον μηχανικό, **μόνο** με ενεργή συμμετοχή,
 * και σε όποιον πρότεινε / έστειλε στο γραφείο. Μία ανά πληρωμή και αποδέκτη. Ποτέ δεν πετά.
 */
export async function announceAdvanceFunded(
  db: Firestore,
  input: { readonly context: AdvanceNoticeContext; readonly record: IssuanceAssignmentRecord; readonly now: Date },
): Promise<void> {
  try {
    const { context, record } = input;
    const { assignment } = context;
    const titleParams = { title: context.label.name ?? assignment.id };
    const bodyParams = { amount: fundedAmountOf(record) };
    const funded = record.advanceEvents.filter((event) => event.kind === 'funded').at(-1);
    const eventKey = funded?.kind === 'funded' ? funded.paymentReference : input.now.toISOString();
    const content = (recipientId: string) => ({
      eventType: NOTIFICATION_EVENT_TYPES.PROPERTIES_DOCUMENT_ISSUANCE_ADVANCE_FUNDED,
      recipientId,
      tenantId: assignment.companyId,
      title: noticeT('documentIssuanceAdvance.funded', titleParams),
      titleKey: 'documentIssuanceAdvance.funded',
      titleParams,
      body: noticeT('documentIssuanceAdvance.fundedBody', bodyParams),
      bodyKey: 'documentIssuanceAdvance.fundedBody',
      bodyParams,
      eventId: `document-issuance-advance-funded:${assignment.id}:${eventKey}:${recipientId}`,
      source: SOURCE(),
    });
    const engagement = await activeIssuanceEngagementOf(db, assignment, context.registry, input.now.toISOString());
    const office = viewDestination(documentExpiryHref(undefined, { doc: issuanceKeyOf(assignment.propertyId, assignment.documentKind) }), orgWorkspace(assignment.companyId));
    const officeUids = [...new Set([record.proposedByUid, ...(record.notice === null ? [] : [record.notice.byUid])])];
    await Promise.all([
      ...officeUids.map((uid) => send({ ...content(uid), ...office })),
      ...(engagement === null ? [] : [caseEngagementChangedDestination(engagement).then((dest) => send({ ...content(engagement.uid), ...dest }))]),
    ]);
  } catch (error) {
    logger.error('Η κατάθεση προκαταβολής δεν ανακοινώθηκε', { error: error instanceof Error ? error.message : String(error) });
  }
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
