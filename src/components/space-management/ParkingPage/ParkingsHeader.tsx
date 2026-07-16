'use client';

/**
 * 🅿️ PARKINGS HEADER
 *
 * Λεπτό wrapper του `ListPageHeader` SSoT: δίνει το εικονίδιο και κάνει το
 * i18n resolve για την οντότητα «θέσεις στάθμευσης». Η δομή του header ζει
 * στο SSoT.
 *
 * ΑΡΧΙΤΕΚΤΟΝΙΚΗ (REAL_ESTATE_HIERARCHY_DOCUMENTATION.md):
 * - Parking είναι παράλληλη κατηγορία με Units/Storage μέσα στο Building
 * - ΟΧΙ children των Units
 * - Ισότιμη οντότητα στην πλοήγηση
 *
 * @see @/core/headers/ListPageHeader — το κοινό header σελίδας-λίστας
 */

import React from 'react';
import { Car } from 'lucide-react';
import { ListPageHeader } from '@/core/headers';
import type { ListPageHeaderProps } from '@/core/headers';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import '@/lib/design-system';

export function ParkingsHeader(props: ListPageHeaderProps) {
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation(['building', 'building-address', 'building-filters', 'building-storage', 'building-tabs', 'building-timeline', 'trash']);

  return (
    <ListPageHeader
      {...props}
      icon={Car}
      labels={{
        title: t('parkings.header.title'),
        subtitle: t('parkings.header.subtitle'),
        searchPlaceholder: t('parkings.header.searchPlaceholder'),
        filtersAriaLabel: t('parkings.accessibility.toggleFilters'),
        trashAriaLabel: t('trashView', { ns: 'trash' }),
      }}
    />
  );
}
