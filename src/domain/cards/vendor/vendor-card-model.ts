'use client';

/**
 * 🏢 VENDOR CARD — Shared Model (ADR-585)
 *
 * Shared derived data for VendorGridCard + VendorListCard (Grid = StatItems +
 * specialty subtitle, List = metrics subtitle + trade badges). Centralizes the
 * display-name + trade-specialties derivation duplicated across both views.
 *
 * @see ADR-585 Domain card view-model hook SSoT
 */

import { useMemo } from 'react';

import { getContactDisplayName } from '@/types/contacts';
import { useTranslation } from '@/i18n/hooks/useTranslation';

import type { VendorCardData } from './vendor-types';

/**
 * Resolve the shared display name, trade specialties, aria label + `t`.
 */
export function useVendorCardCommon(data: VendorCardData) {
  const { t } = useTranslation('procurement');
  const { contact, metrics } = data;

  const displayName = useMemo(() => getContactDisplayName(contact), [contact]);
  const tradeSpecialties = metrics?.tradeSpecialties ?? [];

  return {
    t,
    metrics,
    displayName,
    tradeSpecialties,
    ariaLabel: t('hub.vendorMaster.cardAriaLabel', { name: displayName }),
  };
}
