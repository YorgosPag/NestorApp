'use client';

/**
 * 🏬 STORAGES HEADER
 *
 * Λεπτό wrapper του `ListPageHeader` SSoT: δίνει το εικονίδιο και κάνει το
 * i18n resolve για την οντότητα «αποθήκες». Η δομή του header ζει στο SSoT.
 *
 * @see @/core/headers/ListPageHeader — το κοινό header σελίδας-λίστας
 */

import React from 'react';
import { Warehouse } from 'lucide-react';
import { ListPageHeader } from '@/core/headers';
import type { ListPageHeaderProps } from '@/core/headers';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import '@/lib/design-system';

export function StoragesHeader(props: ListPageHeaderProps) {
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation(['storage', 'trash']);

  return (
    <ListPageHeader
      {...props}
      icon={Warehouse}
      labels={{
        title: t('storages.header.title'),
        subtitle: t('storages.header.subtitle'),
        searchPlaceholder: t('storages.header.searchPlaceholder'),
        filtersAriaLabel: t('storages.accessibility.toggleFilters'),
        trashAriaLabel: t('trashView', { ns: 'trash' }),
      }}
    />
  );
}
