/**
 * @fileoverview **Πού ανοίγει η ειδοποίηση «ο πελάτης έγραψε»** (ADR-939 §3(στ))
 * @description Τα ενιαία εισερχόμενα, στον χώρο του μισθωτή του παραστατικού. Το ρωτούν ο **παραγωγός**
 *   (`invoice-portal-messages` → `notifyIssuer`) **και** ο ανιχνευτής απόκλισης (`notification-destination-rules`):
 *   ένα σημείο, όχι δύο. Χωριστό module ώστε ο ανιχνευτής να μη φορτώνει τον γραφέα του CRM
 *   (ίδιο πρότυπο με το `network-destination`).
 *
 * @see ADR-939 · ADR-849 §6δ Β2
 */

import { viewDestination, type NotificationDestination } from '@/lib/notifications/notification-destination';
import { ENTITY_ROUTES } from '@/lib/routes/entityRoutes';
import { orgWorkspace } from '@/types/workspace-membership';

export function portalMessageDestination(companyId: string): NotificationDestination {
  return viewDestination(ENTITY_ROUTES.crm.communications, orgWorkspace(companyId));
}
