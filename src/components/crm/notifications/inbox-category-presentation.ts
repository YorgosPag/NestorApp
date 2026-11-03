'use client';

/**
 * @fileoverview **Η ΟΨΗ ΜΙΑΣ ΚΑΤΗΓΟΡΙΑΣ ΤΟΥ INBOX** — εικονίδιο + ετικέτα, από τα ΙΔΙΑ SSoT με τις ρυθμίσεις
 * ειδοποιήσεων: `CATEGORY_ICONS` (εικονίδιο) και `NOTIFICATION_PREFERENCE_GROUPS[].titleKey` (ετικέτα).
 * @related ADR-927 · ADR-849 Α3 · components/account/notification-settings-config.ts
 * @module components/crm/notifications/inbox-category-presentation
 *
 * Ό,τι λέγεται «Ακίνητα» στις ρυθμίσεις λέγεται «Ακίνητα» και εδώ — **ένα** κλειδί, όχι αντίγραφο.
 */

import { useCallback } from 'react';
import { Inbox } from 'lucide-react';
import { useTranslation } from '@/i18n';
import { COMMON_NAMESPACES } from '@/i18n/namespace-bundles';
import { CATEGORY_ICONS } from '@/components/account/notification-settings-config';
import { NOTIFICATION_PREFERENCE_GROUPS } from '@/config/notification-preference-rows';
import { inboxCategoryOf, type InboxCategory } from '@/components/notifications/notification-inbox-model';
import type { Notification } from '@/types/notification';

export interface CategoryPresentation {
  readonly Icon: React.ElementType;
  readonly label: string;
}

const TITLE_KEY_BY_CATEGORY = new Map(NOTIFICATION_PREFERENCE_GROUPS.map((g) => [g.category, g.titleKey]));

/** Η όψη κάθε κατηγορίας, για το φίλτρο και τη γραμμή. */
export function useCategoryPresenter(): (category: InboxCategory) => CategoryPresentation {
  const { t } = useTranslation(['crm', ...COMMON_NAMESPACES]);
  return useCallback((category: InboxCategory): CategoryPresentation => {
    if (category === 'other') return { Icon: Inbox, label: t('crm:notifications.inbox.categoryOther') };
    const titleKey = TITLE_KEY_BY_CATEGORY.get(category);
    return { Icon: CATEGORY_ICONS[category], label: titleKey ? t(titleKey) : category };
  }, [t]);
}

export function useInboxCategoryPresentation(n: Pick<Notification, 'meta'>): CategoryPresentation {
  return useCategoryPresenter()(inboxCategoryOf(n));
}
