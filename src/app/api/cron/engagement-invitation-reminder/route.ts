/**
 * 🏢 Engagement Invitation Reminder Cron Endpoint — ADR-901 Φ3 · Ε-5
 *
 * **Πυροκροτητής, όχι λογική.** Η πολιτική ζει στο `server/engagement-invitations/engagement-invitation-reminder.ts`,
 * ο προσαρμογέας στο `lib/cron/jobs/engagement-invitation-reminder.job.ts`. Ταυτοποίηση με το **υπάρχον** SSoT
 * (`verifyCronAuthorization` → `CRON_SECRET`, ADR-740) — χωρίς έγκυρο μυστικό **καμία** σάρωση δεν τρέχει.
 *
 * @module api/cron/engagement-invitation-reminder
 */

import 'server-only';

import { runEngagementInvitationReminder } from '@/lib/cron/jobs/engagement-invitation-reminder.job';
import { createScanCronRoute } from '@/lib/cron/scan-cron-route';
import { createModuleLogger } from '@/lib/telemetry';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export const { GET } = createScanCronRoute({
  service: 'engagement-invitation-reminder',
  label: 'Engagement invitation reminder sweep',
  logger: createModuleLogger('ENGAGEMENT_INVITATION_REMINDER_CRON'),
  slug: 'engagement-invitation-reminder',
  category: 'SENSITIVE',
  run: runEngagementInvitationReminder,
});
