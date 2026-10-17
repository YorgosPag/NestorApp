/**
 * 🏢 Issuance Invitation Reminder Cron Endpoint — ADR-915 §31
 *
 * **Πυροκροτητής, όχι λογική.** Η πολιτική ζει στο `lib/document-validity/issuance-reminder.ts`, η σάρωση στο
 * `server/issuance-invitations/issuance-invitation-reminder.ts`, ο προσαρμογέας στο
 * `lib/cron/jobs/issuance-invitation-reminder.job.ts`. Ταυτοποίηση με το **υπάρχον** SSoT (`verifyCronAuthorization` →
 * `CRON_SECRET`, ADR-740) — χωρίς έγκυρο μυστικό **καμία** σάρωση δεν τρέχει.
 *
 * @module api/cron/issuance-invitation-reminder
 */

import 'server-only';

import { runIssuanceInvitationReminder } from '@/lib/cron/jobs/issuance-invitation-reminder.job';
import { createScanCronRoute } from '@/lib/cron/scan-cron-route';
import { createModuleLogger } from '@/lib/telemetry';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export const { GET } = createScanCronRoute({
  service: 'issuance-invitation-reminder',
  label: 'Issuance invitation reminder sweep',
  logger: createModuleLogger('ISSUANCE_INVITATION_REMINDER_CRON'),
  slug: 'issuance-invitation-reminder',
  category: 'SENSITIVE',
  run: runIssuanceInvitationReminder,
});
