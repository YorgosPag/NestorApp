'use client';
/* eslint-disable custom/no-hardcoded-strings */

/**
 * @fileoverview Storage Quick Filters for Sales — ADR-199
 * @description Δύο σειρές (διάθεση · τύπος αποθήκης) πάνω στο κοινό `SalesSpaceQuickFilters`
 *   (ADR-777 §8.60.20)· εδώ μένει μόνο το λεξιλόγιο τύπων της αποθήκης.
 */

import { COMMON_NAMESPACES } from '@/i18n/namespace-bundles';
import React from 'react';
import { Package, Archive, Warehouse, Box } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { TypeFilterOption } from '@/components/shared/TypeQuickFilters';
import { SalesSpaceQuickFilters, type SalesSpaceQuickFilterSelection } from './SalesSpaceQuickFilters';

const TYPE_OPTIONS: TypeFilterOption[] = [
  { value: 'large',     label: 'storage:types.large',       icon: Warehouse,  tooltip: 'storage:types.large' },
  { value: 'small',     label: 'storage:types.small',       icon: Box,        tooltip: 'storage:types.small' },
  { value: 'basement',  label: 'storage:types.basement',    icon: Archive,    tooltip: 'storage:types.basement' },
  { value: 'ground',    label: 'storage:types.ground',      icon: Package,    tooltip: 'storage:types.ground' },
];

export function StorageQuickFilters(props: SalesSpaceQuickFilterSelection) {
  const { t } = useTranslation(COMMON_NAMESPACES);
  return (
    <SalesSpaceQuickFilters
      {...props}
      typeOptions={TYPE_OPTIONS}
      ariaLabels={{
        status: t('salesStorage.quickFilters.statusAriaLabel'),
        type: t('salesStorage.quickFilters.typeAriaLabel'),
      }}
    />
  );
}
