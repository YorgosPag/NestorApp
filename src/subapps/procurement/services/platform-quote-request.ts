/**
 * =============================================================================
 * ΑΙΤΗΜΑ ΠΡΟΣΦΟΡΑΣ ΠΡΟΣ ΧΩΡΟ ΤΗΣ ΠΛΑΤΦΟΡΜΑΣ — ποσόστωση και ειδοποίηση (ADR-923 §5.13 Ε6δ, Τ5)
 * =============================================================================
 *
 * Ό,τι ισχύει **μόνο** όταν ο παραλήπτης είναι ο χώρος ενός προμηθευτή της πλατφόρμας, σε **κάθε** δρόμο που του στέλνει
 * πρόσκληση (fan-out του `createRfq` · χειρόγραφη πρόσκληση):
 *
 * | Πότε | Τι | Γιατί |
 * |---|---|---|
 * | πριν από την αποστολή | {@link admitPlatformQuoteRequest} — όριο ανά **γραμματοκιβώτιο** του προμηθευτή | δέκα νέοι λογαριασμοί δεν γίνονται δέκα φορές περισσότερο spam |
 * | μετά από παράδοση | {@link announcePlatformQuoteRequest} — ειδοποίηση στους ενεργούς διαχειριστές του χώρου | Alibaba «Inquiry» / Ariba Network: το αίτημα φαίνεται και μέσα στην πλατφόρμα, όχι μόνο στο inbox |
 *
 * 🔑 Η ειδοποίηση είναι **ιδεμποτική** κατά πρόσκληση (`eventId` = id της πρόσκλησης ⇒ ντετερμινιστικό έγγραφο, `create`):
 *    όσες φορές κι αν κληθεί, ένας διαχειριστής βλέπει **μία** γραμμή.
 * 🔒 Δεν φέρει σύνδεσμο πύλης (το token δεν γράφεται ποτέ σε έγγραφο, ADR-876 §5) ούτε id του RFQ (ανήκει στον αγοραστή).
 * ⚠️ Ποτέ δεν πετά: η πρόσκληση έχει ήδη παραδοθεί (N.7.2 #6).
 *
 * @module subapps/procurement/services/platform-quote-request
 */

import 'server-only';

import {
  getCurrentEnvironment,
  NOTIFICATION_EVENT_TYPES,
  SOURCE_SERVICES,
} from '@/config/notification-events';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { QUOTE_REQUEST_SUPPLIER_DAILY_QUOTA } from '@/lib/middleware/rate-limit-config';
import { withinSubjectQuota } from '@/lib/middleware/subject-quota';
import { createModuleLogger } from '@/lib/telemetry';
import { activeWorkspaceAdministrators } from '@/lib/workspace/workspace-administrators';
import { readWorkspaceName } from '@/lib/workspace/workspace-catalog';
import { dispatchNotification } from '@/server/notifications/notification-orchestrator';
import { notificationFallbackTitle } from '@/server/notifications/notification-title';
import { orgWorkspace } from '@/types/workspace-membership';

const logger = createModuleLogger('PLATFORM_QUOTE_REQUEST');

/** Το είδος της ποσόστωσης: δικό του, ώστε να μην τρώει το όριο άλλων μηνυμάτων. */
export const PLATFORM_QUOTE_REQUEST_QUOTA_SCOPE = 'rfq-quote-request:supplier';

/** Χωρά ακόμη ένα αίτημα στο γραμματοκιβώτιο αυτού του προμηθευτή σήμερα; Καταναλώνει μία μονάδα. */
export function admitPlatformQuoteRequest(supplierCompanyId: string): Promise<boolean> {
  return withinSubjectQuota(PLATFORM_QUOTE_REQUEST_QUOTA_SCOPE, supplierCompanyId, QUOTE_REQUEST_SUPPLIER_DAILY_QUOTA);
}

export interface PlatformQuoteRequestNotice {
  readonly supplierCompanyId: string;
  readonly buyerCompanyId: string;
  readonly rfqTitle: string;
  readonly inviteId: string;
}

const TITLE_KEY = 'quoteRequest.receivedTitle';
const BODY_KEY = 'quoteRequest.receivedBody';

async function notifyAdministrator(notice: PlatformQuoteRequestNotice, uid: string, titleParams: Record<string, string>): Promise<void> {
  await dispatchNotification({
    eventType: NOTIFICATION_EVENT_TYPES.PROCUREMENT_QUOTE_REQUESTED,
    recipientId: uid,
    tenantId: notice.supplierCompanyId,
    title: notificationFallbackTitle(TITLE_KEY, titleParams),
    titleKey: TITLE_KEY,
    titleParams,
    body: notificationFallbackTitle(BODY_KEY),
    bodyKey: BODY_KEY,
    eventId: `quote-request:${notice.inviteId}`,
    workspace: orgWorkspace(notice.supplierCompanyId),
    source: { service: SOURCE_SERVICES.PROCUREMENT, feature: 'quote-request', env: getCurrentEnvironment() },
  });
}

/** Πες το στους διαχειριστές του χώρου του προμηθευτή. Ποτέ δεν πετά. */
export async function announcePlatformQuoteRequest(notice: PlatformQuoteRequestNotice): Promise<void> {
  try {
    const db = getAdminFirestore();
    const [administrators, buyerName] = await Promise.all([
      activeWorkspaceAdministrators(db, notice.supplierCompanyId),
      readWorkspaceName(notice.buyerCompanyId).catch(() => ''),
    ]);
    const who = buyerName.trim() === '' ? notificationFallbackTitle('quoteRequest.unnamed') : buyerName.trim();
    const titleParams = { who, title: notice.rfqTitle };
    const results = await Promise.allSettled(administrators.map((uid) => notifyAdministrator(notice, uid, titleParams)));
    const failed = results.filter((result) => result.status === 'rejected').length;
    if (failed > 0) logger.error('Ειδοποίηση αιτήματος προσφοράς: αποτυχίες', { inviteId: notice.inviteId, failed });
  } catch (error) {
    logger.error('Η ειδοποίηση αιτήματος προσφοράς δεν στάλθηκε', {
      inviteId: notice.inviteId, error: error instanceof Error ? error.message : String(error),
    });
  }
}
