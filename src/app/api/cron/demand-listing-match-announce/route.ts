/**
 * 🏢 Demand Listing Match Announce Cron Endpoint
 *
 * **Πυροκροτητής, όχι λογική.** Η κρίση «ταιριάζει;» ζει στο `lib/demand/`, η
 * αποστολή στο `services/demand/listing-match-notifier.service.ts`, ο προσαρμογέας
 * στο `lib/cron/jobs/demand-listing-match-announce.job.ts`, και το wiring HTTP στο
 * `lib/cron/scan-cron-route.ts`. Εδώ δεν κρίνεται και δεν καλωδιώνεται τίποτα —
 * μόνο δηλώνεται **ποια** εργασία είναι αυτή.
 *
 * ⚠️ **Η ΔΙΑΔΡΟΜΗ ΑΥΤΗ ΣΤΕΛΝΕΙ EMAIL ΣΕ ΑΝΘΡΩΠΟΥΣ.** Η ταυτοποίηση γίνεται με το
 * **υπάρχον** SSoT (`verifyCronAuthorization` → `CRON_SECRET`, ADR-740)· χωρίς
 * έγκυρο μυστικό **καμία σάρωση δεν τρέχει** και **κανένα email δεν φεύγει**.
 *
 * @module api/cron/demand-listing-match-announce
 * @see ADR-740 — το πρόγραμμα ζει στο src/config/cron-schedule.ts
 */

import 'server-only';

import { runDemandListingMatchAnnounce } from '@/lib/cron/jobs/demand-listing-match-announce.job';
import { createScanCronRoute } from '@/lib/cron/scan-cron-route';
import { createModuleLogger } from '@/lib/telemetry';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export const { GET } = createScanCronRoute({
  service: 'demand-listing-match-announce',
  label: 'Demand listing match announcement scan',
  logger: createModuleLogger('DEMAND_LISTING_MATCH_ANNOUNCE_CRON'),
  run: runDemandListingMatchAnnounce,
});
