'use client';
/* eslint-disable custom/no-hardcoded-strings */

/**
 * @fileoverview Parking Quick Filters for Sales — ADR-199
 * @description Δύο σειρές (διάθεση · τύπος θέσης) πάνω στο κοινό `SalesSpaceQuickFilters`
 *   (ADR-777 §8.60.20)· εδώ μένει μόνο το λεξιλόγιο τύπων της θέσης.
 */

import { COMMON_NAMESPACES } from '@/i18n/namespace-bundles';
import React from 'react';
import { Car, Accessibility, Bike, Zap, Users } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { TypeFilterOption } from '@/components/shared/TypeQuickFilters';
import { SalesSpaceQuickFilters, type SalesSpaceQuickFilterSelection } from './SalesSpaceQuickFilters';

const TYPE_OPTIONS: TypeFilterOption[] = [
  { value: 'standard',     label: 'parking:types.standard',          icon: Car,           tooltip: 'parking:types.standard' },
  { value: 'handicapped',  label: 'parking:types.handicapped',       icon: Accessibility, tooltip: 'parking:types.handicapped' },
  { value: 'motorcycle',   label: 'parking:types.motorcycle',        icon: Bike,          tooltip: 'parking:types.motorcycle' },
  { value: 'electric',     label: 'parking:types.electric',          icon: Zap,           tooltip: 'parking:types.electric' },
  { value: 'visitor',      label: 'parking:types.visitor',           icon: Users,         tooltip: 'parking:types.visitor' },
];

export function ParkingQuickFilters(props: SalesSpaceQuickFilterSelection) {
  const { t } = useTranslation(COMMON_NAMESPACES);
  return (
    <SalesSpaceQuickFilters
      {...props}
      typeOptions={TYPE_OPTIONS}
      ariaLabels={{
        status: t('salesParking.quickFilters.statusAriaLabel'),
        type: t('salesParking.quickFilters.typeAriaLabel'),
      }}
    />
  );
}
