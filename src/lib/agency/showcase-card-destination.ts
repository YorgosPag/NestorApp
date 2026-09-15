/**
 * @fileoverview **ΠΟΥ ΟΔΗΓΕΙ ΜΙΑ ΕΙΔΟΠΟΙΗΣΗ ΓΙΑ ΤΗΝ ΚΑΡΤΑ** — η φόρμα της κάρτας, στον χώρο του γραφείου (ADR-841 §7).
 * @related services/mandate/showcase-email-return.service.ts (Α21.20) · services/mandate/holiday-hours-question.service.ts
 *   (Α21.21 Φάση Β) · server/notifications/notification-destination-rules.ts (ο ανιχνευτής απόκλισης)
 * @module lib/agency/showcase-card-destination
 *
 * 🔴 **ΕΞΗΧΘΗ ΤΗ ΣΤΙΓΜΗ ΠΟΥ ΧΡΕΙΑΣΤΗΚΕ ΔΕΥΤΕΡΗ ΦΟΡΑ** (N.0.2): δύο παραγωγοί ειδοποιήσεων οδηγούν στην ίδια πόρτα, και
 * ο ανιχνευτής απόκλισης ρωτά τη συνάρτηση **του παραγωγού**. Δύο αντίγραφα θα μπορούσαν να αποκλίνουν σιωπηλά.
 */

import { AGENCY_SHOWCASE_CARD_ROUTE } from '@/lib/mandate/mandate-routes';
import { viewDestination, type NotificationDestination } from '@/lib/notifications/notification-destination';
import { orgWorkspace } from '@/types/workspace-membership';

/** Η φόρμα της κάρτας του γραφείου — **στον χώρο του**, ποτέ στον χώρο του θεατή (ADR-849 Β1). */
export function showcaseCardDestination(companyId: string): NotificationDestination {
  return viewDestination(AGENCY_SHOWCASE_CARD_ROUTE, orgWorkspace(companyId));
}
