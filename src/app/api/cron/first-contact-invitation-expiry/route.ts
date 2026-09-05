/**
 * 🏢 First-Contact Invitation Expiry Cron Endpoint — ADR-844 Β6
 *
 * **Πυροκροτητής, όχι λογική.** Η πολιτική «τι σβήνεται και γιατί» ζει στο
 * `services/contact/first-contact-invitation-expiry.service.ts`, ο προσαρμογέας στο
 * `lib/cron/jobs/first-contact-invitation-expiry.job.ts`.
 *
 * 🔴 **ΑΥΤΗ Η ΔΙΑΔΡΟΜΗ ΔΙΑΓΡΑΦΕΙ ΠΡΟΣΩΠΙΚΑ ΔΕΔΟΜΕΝΑ** *(όνομα, email, τηλέφωνο ανθρώπων
 * που δεν ολοκλήρωσαν επαφή)*. Δεν στέλνει τίποτα και δεν αποκαλύπτει τίποτα — αλλά η
 * διαγραφή είναι **μη αναστρέψιμη**, οπότε η ταυτοποίηση γίνεται με το **υπάρχον** SSoT
 * (`verifyCronAuthorization` → `CRON_SECRET`, ADR-740). Χωρίς έγκυρο μυστικό **καμία
 * σάρωση δεν τρέχει**.
 *
 * ⚠️ **Δεν αγγίζει ΠΟΤΕ το `first_contacts`.** Η πράξη είναι αδιάγραπτη (ΠΕ6) — εδώ
 * σβήνεται μόνο η **σκαλωσιά** που δεν γέννησε ποτέ σχέση.
 *
 * @module api/cron/first-contact-invitation-expiry
 * @see ADR-844 — «η πρόσκληση λήγει σιωπηλά»
 */

import 'server-only';

import { runFirstContactInvitationExpiry } from '@/lib/cron/jobs/first-contact-invitation-expiry.job';
import { createScanCronRoute } from '@/lib/cron/scan-cron-route';
import { createModuleLogger } from '@/lib/telemetry';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export const { GET } = createScanCronRoute({
  service: 'first-contact-invitation-expiry',
  label: 'First-contact invitation expiry sweep',
  logger: createModuleLogger('FIRST_CONTACT_INVITATION_EXPIRY_CRON'),
  run: runFirstContactInvitationExpiry,
});
