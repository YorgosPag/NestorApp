'use client';
/* eslint-disable custom/no-hardcoded-strings */

/**
 * @fileoverview Parking Quick Filters for Sales — ADR-199
 * @description Two rows: Row 1 = Status, Row 2 = Parking Type/Zone
 * @pattern Uses centralized TypeQuickFilters
 */

import React from 'react';
import {
  LayoutGrid,
  CheckCircle,
  UserCheck,
  Package,
  Wrench,
  Car,
  Accessibility,
  Bike,
  Zap,
  Users,
} from 'lucide-react';
import { TypeQuickFilters } from '@/components/shared/TypeQuickFilters';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { TypeFilterOption } from '@/components/shared/TypeQuickFilters';
import '@/lib/design-system';

// =============================================================================
// 🏢 TYPES
// =============================================================================

interface ParkingQuickFiltersProps {
  selectedStatus: string;
  onStatusChange: (status: string) => void;
  selectedType: string;
  onTypeChange: (type: string) => void;
  className?: string;
}

// =============================================================================
// 🏢 OPTIONS
// =============================================================================

const STATUS_OPTIONS: TypeFilterOption[] = [
  { value: 'all',         label: 'common:filters.all',           icon: LayoutGrid, tooltip: 'common:filters.all' },
  { value: 'available',   label: 'parking:status.available',     icon: CheckCircle, tooltip: 'parking:status.available' },
  { value: 'reserved',    label: 'parking:status.reserved',      icon: UserCheck,   tooltip: 'parking:status.reserved' },
  { value: 'sold',        label: 'parking:status.sold',          icon: Package,     tooltip: 'parking:status.sold' },
  { value: 'maintenance', label: 'parking:status.maintenance',   icon: Wrench,      tooltip: 'parking:status.maintenance' },
];

const TYPE_OPTIONS: TypeFilterOption[] = [
  { value: 'all',          label: 'common:filters.all',              icon: LayoutGrid,    tooltip: 'common:filters.all' },
  { value: 'standard',     label: 'parking:types.standard',          icon: Car,           tooltip: 'parking:types.standard' },
  { value: 'handicapped',  label: 'parking:types.handicapped',       icon: Accessibility, tooltip: 'parking:types.handicapped' },
  { value: 'motorcycle',   label: 'parking:types.motorcycle',        icon: Bike,          tooltip: 'parking:types.motorcycle' },
  { value: 'electric',     label: 'parking:types.electric',          icon: Zap,           tooltip: 'parking:types.electric' },
  { value: 'visitor',      label: 'parking:types.visitor',           icon: Users,         tooltip: 'parking:types.visitor' },
];

// =============================================================================
// 🏢 COMPONENT
// =============================================================================

export function ParkingQuickFilters({
  selectedStatus,
  onStatusChange,
  selectedType,
  onTypeChange,
  className,
}: ParkingQuickFiltersProps) {
  const { t } = useTranslation(['common', 'common-account', 'common-actions', 'common-empty-states', 'common-navigation', 'common-photos', 'common-sales', 'common-shared', 'common-status', 'common-validation']);

  const handleStatusChange = (types: string[]) => {
    onStatusChange(types.length === 0 ? 'all' : types[0]);
  };

  const handleTypeChange = (types: string[]) => {
    onTypeChange(types.length === 0 ? 'all' : types[0]);
  };

  return (
    <div className={`flex flex-col gap-1 ${className ?? ''}`}>
      <TypeQuickFilters
        options={STATUS_OPTIONS}
        selectedTypes={selectedStatus === 'all' ? [] : [selectedStatus]}
        onTypeChange={handleStatusChange}
        compact
        ariaLabel={t('salesParking.quickFilters.statusAriaLabel')}
      />
      <TypeQuickFilters
        options={TYPE_OPTIONS}
        selectedTypes={selectedType === 'all' ? [] : [selectedType]}
        onTypeChange={handleTypeChange}
        compact
        ariaLabel={t('salesParking.quickFilters.typeAriaLabel')}
      />
    </div>
  );
}
