import 'server-only';

/**
 * @fileoverview ADR-943 §5.14 — **ειδοποίηση ασφαλείας** «άλλαξε ο λογαριασμός πίστωσης των πληρωμών σας».
 * @related payment-payee-service.ts (`updatePayoutAccount` — ο ΕΝΑΣ καλών) · server/workspace/member-exit-notifier.ts (ίδιο ιδίωμα)
 * @module server/payments/payment-payee-notifier
 *
 * 🔑 Υποχρεωτική (`security.*`, κανένας διακόπτης): σχήμα τραπεζών / Stripe — κάθε αλλαγή IBAN αποδόσεων φτάνει **πάντα**
 *    στον κάτοχο, γιατί κλεμμένος λογαριασμός που αλλάζει IBAN είναι η κλασική απάτη αποδόσεων.
 * 🔒 Κανένα στοιχείο του λογαριασμού στο κείμενο (ούτε τα τελευταία ψηφία): η ειδοποίηση πάει και σε email.
 * 🔑 **Ποτέ δεν πετά**: η αλλαγή έγινε ήδη στον πάροχο· χαμένη ειδοποίηση δεν την αναιρεί.
 */

import { getCurrentEnvironment, NOTIFICATION_EVENT_TYPES, SOURCE_SERVICES } from '@/config/notification-events';
import { createBundleTranslate } from '@/i18n/bundle-translate';
import elShared from '@/i18n/locales/el/common-shared.json';
import { getErrorMessage } from '@/lib/error-utils';
import { viewDestination } from '@/lib/notifications/notification-destination';
import { PRIVATE_PROFILE_ROUTE } from '@/lib/routes/accountRoutes';
import { createModuleLogger } from '@/lib/telemetry';
import { dispatchNotification } from '@/server/notifications/notification-orchestrator';
import { personalWorkspace, workspaceTenantId } from '@/types/workspace-membership';

const logger = createModuleLogger('PaymentPayeeNotifier');
/** Η εφεδρεία (και το email) βγαίνει από το locale — μία διατύπωση, ένα σημείο. */
const elSharedT = createBundleTranslate({ 'common-shared': elShared }, 'common-shared');

const TITLE_KEY = 'payoutAccount.detailsChanged';
const BODY_KEY = 'payoutAccount.detailsChangedBody';

/** «Άλλαξε ο λογαριασμός πίστωσης» — προς τον ίδιο τον δικαιούχο, προσγείωση στο προφίλ του. Μία ανά πράξη. */
export async function announcePayoutDetailsChanged(userId: string, at: Date): Promise<void> {
  const workspace = personalWorkspace(userId);
  try {
    await dispatchNotification({
      eventType: NOTIFICATION_EVENT_TYPES.SECURITY_PAYOUT_DETAILS_CHANGED,
      recipientId: userId,
      tenantId: workspaceTenantId(workspace),
      title: elSharedT(TITLE_KEY, {}),
      titleKey: TITLE_KEY,
      titleParams: {},
      body: elSharedT(BODY_KEY, {}),
      bodyKey: BODY_KEY,
      bodyParams: {},
      eventId: `payout-details-changed:${userId}:${at.toISOString()}`,
      ...viewDestination(PRIVATE_PROFILE_ROUTE, workspace),
      source: { service: SOURCE_SERVICES.SECURITY, feature: 'payout-details', env: getCurrentEnvironment() },
    });
  } catch (error: unknown) {
    logger.error('Η ειδοποίηση αλλαγής λογαριασμού πίστωσης δεν στάλθηκε', { userId, error: getErrorMessage(error) });
  }
}
