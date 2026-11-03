/**
 * @fileoverview **ΤΟ ΦΙΛΤΡΟ ΤΟΥ INBOX ΖΕΙ ΣΤΗ ΔΙΕΥΘΥΝΣΗ** — όπως το `?query=is:unread` του GitHub.
 * @related ADR-927 · components/notifications/notification-inbox-model.ts
 * @module components/notifications/notification-inbox-url
 *
 * Γιατί στη διεύθυνση και όχι σε `useState`: επιβιώνει της ανανέωσης, του «Πίσω» και της κοινοποίησης
 * συνδέσμου. Η προεπιλογή (`all`, καμία κατηγορία) **δεν** γράφει παράμετρο: μία διεύθυνση ανά περιεχόμενο.
 * Άγνωστη τιμή ⇒ προεπιλογή, ποτέ σφάλμα (ο σύνδεσμος μπορεί να είναι παλιός).
 */

import { typedHref, withQuery } from '@/lib/workspace/route-worlds';
import { isInboxCategory, isInboxView, type InboxFilter } from './notification-inbox-model';

export const CRM_NOTIFICATIONS_ROUTE = '/crm/notifications' as const;
export const INBOX_VIEW_PARAM = 'view';
export const INBOX_CATEGORY_PARAM = 'category';

export const DEFAULT_INBOX_FILTER: InboxFilter = { view: 'all', category: null };

interface ReadableParams {
  get(name: string): string | null;
}

export function inboxFilterOf(params: ReadableParams | null | undefined): InboxFilter {
  const view = params?.get(INBOX_VIEW_PARAM);
  const category = params?.get(INBOX_CATEGORY_PARAM);
  return {
    view: isInboxView(view) ? view : DEFAULT_INBOX_FILTER.view,
    category: isInboxCategory(category) ? category : null,
  };
}

export function inboxHref(filter: InboxFilter) {
  const query = new URLSearchParams();
  if (filter.view !== DEFAULT_INBOX_FILTER.view) query.set(INBOX_VIEW_PARAM, filter.view);
  if (filter.category !== null) query.set(INBOX_CATEGORY_PARAM, filter.category);
  const search = query.toString();
  return search.length > 0 ? withQuery(CRM_NOTIFICATIONS_ROUTE, search) : typedHref(CRM_NOTIFICATIONS_ROUTE);
}
