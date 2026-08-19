/**
 * 🏢 Demand Interest Announce Cron Endpoint — ADR-777 §8.23
 *
 * **Πυροκροτητής, όχι λογική.** Η κρίση «ποιοι σε ψάχνουν;» ζει στο
 * `lib/demand/demand-interest.ts`, η αποστολή στο
 * `services/demand/interest-notifier.service.ts`, ο προσαρμογέας στο
 * `lib/cron/jobs/demand-interest-announce.job.ts`, και το wiring HTTP στο
 * `lib/cron/scan-cron-route.ts`. Εδώ δεν κρίνεται και δεν καλωδιώνεται τίποτα —
 * μόνο δηλώνεται **ποια** εργασία είναι αυτή.
 *
 * ⚠️ **Η ΔΙΑΔΡΟΜΗ ΑΥΤΗ ΣΤΕΛΝΕΙ EMAIL ΣΕ ΑΝΘΡΩΠΟΥΣ** — είναι το κύριο ρίσκο
 * ασφαλείας του §8.23. Η ταυτοποίηση γίνεται με το **υπάρχον** SSoT
 * (`verifyCronAuthorization` → `CRON_SECRET`, ADR-740)· δεν επινοήθηκε τρίτο
 * σχήμα ταυτότητας μηχανής→μηχανής. Χωρίς έγκυρο μυστικό **καμία σάρωση δεν
 * τρέχει** και **κανένα email δεν φεύγει**.
 *
 * @module api/cron/demand-interest-announce
 * @see ADR-740 — το πρόγραμμα ζει στο src/config/cron-schedule.ts (ωριαία, λεπτό 15)
 * @see ADR-777 §8.23 — «η ειδοποίηση φτάνει σε άνθρωπο»
 */

import 'server-only';

import { runDemandInterestAnnounce } from '@/lib/cron/jobs/demand-interest-announce.job';
import { createScanCronRoute } from '@/lib/cron/scan-cron-route';
import { createModuleLogger } from '@/lib/telemetry';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export const { GET } = createScanCronRoute({
  service: 'demand-interest-announce',
  label: 'Demand interest announcement scan',
  logger: createModuleLogger('DEMAND_INTEREST_ANNOUNCE_CRON'),
  run: runDemandInterestAnnounce,
});
