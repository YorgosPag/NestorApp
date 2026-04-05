'use client';
/* eslint-disable custom/no-hardcoded-strings */

/**
 * @fileoverview Storage Quick Filters for Sales — ADR-199
 * @description Two rows: Row 1 = Status, Row 2 = Storage Type
 * @pattern Uses centralized TypeQuickFilters
 */

import React from 'react';
import {
  LayoutGrid,
  CheckCircle,
  UserCheck,
  Package,
  Wrench,
  Archive,
  Warehouse,
  Box,
} from 'lucide-react';
import { TypeQuickFilters } from '@/components/shared/TypeQuickFilters';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { TypeFilterOption } from '@/components/shared/TypeQuickFilters';
import '@/lib/design-system';

// =============================================================================
// 🏢 TYPES
// =============================================================================

interface StorageQuickFiltersProps {
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
  { value: 'available',   label: 'storage:status.available',     icon: CheckCircle, tooltip: 'storage:status.available' },
  { value: 'reserved',    label: 'storage:status.reserved',      icon: UserCheck,   tooltip: 'storage:status.reserved' },
  { value: 'sold',        label: 'storage:status.sold',          icon: Package,     tooltip: 'storage:status.sold' },
  { value: 'maintenance', label: 'storage:status.maintenance',   icon: Wrench,      tooltip: 'storage:status.maintenance' },
];

const TYPE_OPTIONS: TypeFilterOption[] = [
  { value: 'all',       label: 'common:filters.all',        icon: LayoutGrid, tooltip: 'common:filters.all' },
  { value: 'large',     label: 'storage:types.large',       icon: Warehouse,  tooltip: 'storage:types.large' },
  { value: 'small',     label: 'storage:types.small',       icon: Box,        tooltip: 'storage:types.small' },
  { value: 'basement',  label: 'storage:types.basement',    icon: Archive,    tooltip: 'storage:types.basement' },
  { value: 'ground',    label: 'storage:types.ground',      icon: Package,    tooltip: 'storage:types.ground' },
];

// =============================================================================
// 🏢 COMPONENT
// =============================================================================

export function StorageQuickFilters({
  selectedStatus,
  onStatusChange,
  selectedType,
  onTypeChange,
  className,
}: StorageQuickFiltersProps) {
  const { t } = useTranslation('common');

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
        ariaLabel={t('salesStorage.quickFilters.statusAriaLabel')}
      />
      <TypeQuickFilters
        options={TYPE_OPTIONS}
        selectedTypes={selectedType === 'all' ? [] : [selectedType]}
        onTypeChange={handleTypeChange}
        compact
        ariaLabel={t('salesStorage.quickFilters.typeAriaLabel')}
      />
    </div>
  );
}
