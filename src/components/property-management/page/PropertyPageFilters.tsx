'use client';

import React, { useMemo } from 'react';
import { LabeledSelect } from './LabeledSelect';
import { LabeledInput } from './LabeledInput';
import { MapPin, Activity, Search } from 'lucide-react';
// 🏢 ENTERPRISE: Using centralized entity config for Building icon
import { NAVIGATION_ENTITIES } from '@/components/navigation/config/navigation-entities';
import { cn } from '@/lib/utils';
import { useIconSizes } from '@/hooks/useIconSizes';
import {
  PROPERTY_TYPE_LABELS,
  PROPERTY_STATUS_LABELS,
  PROPERTY_FILTER_LABELS,
  PROPERTY_STANDARD_FLOORS,
  LEGACY_STATUS_MAPPING,
  STORAGE_LABELS
} from '@/constants/property-statuses-enterprise';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface PropertyPageFiltersProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  filterType: string;
  setFilterType: (type: string) => void;
  filterStatus: string;
  setFilterStatus: (status: string) => void;
  filterFloor: string;
  setFilterFloor: (floor: string) => void;
  filterBuilding: string;
  setFilterBuilding: (building: string) => void;
}

export function PropertyPageFilters({
  searchTerm,
  setSearchTerm,
  filterType,
  setFilterType,
  filterStatus,
  setFilterStatus,
  filterFloor,
  setFilterFloor,
  filterBuilding,
  setFilterBuilding
}: PropertyPageFiltersProps) {
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('properties');
  const iconSizes = useIconSizes();

  // 🏢 ENTERPRISE: Options with i18n support
  const typeOptions = useMemo(() => [
    { value: 'all', label: t(PROPERTY_FILTER_LABELS.ALL_TYPES, { ns: 'common' }) },
    ...Object.entries(PROPERTY_TYPE_LABELS).map(([value, label]) => ({
      value,
      label: t(label, { ns: 'properties' })
    }))
  ], [t]);

  const statusOptions = useMemo(() => [
    { value: 'all', label: t(PROPERTY_FILTER_LABELS.ALL_STATUSES, { ns: 'common' }) },
    ...Object.entries(LEGACY_STATUS_MAPPING).map(([legacyValue, modernValue]) => ({
      value: legacyValue,
      label: t(PROPERTY_STATUS_LABELS[modernValue], { ns: 'common' })
    }))
  ], [t]);

  const floorOptions = useMemo(() => [
    { value: 'all', label: t(PROPERTY_FILTER_LABELS.ALL_FLOORS, { ns: 'common' }) },
    ...PROPERTY_STANDARD_FLOORS.map(floor => ({ value: floor, label: floor }))
  ], [t]);

  const buildingOptions = useMemo(() => [
    { value: 'all', label: t(PROPERTY_FILTER_LABELS.ALL_BUILDINGS, { ns: 'common' }) },
    { value: 'A', label: t(STORAGE_LABELS.BUILDING_A, { ns: 'building' }) },
    { value: 'B', label: t(STORAGE_LABELS.BUILDING_B, { ns: 'building' }) },
    { value: 'C', label: t(STORAGE_LABELS.BUILDING_C, { ns: 'building' }) },
    { value: 'D', label: t(STORAGE_LABELS.BUILDING_D, { ns: 'building' }) },
  ], [t]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
      <LabeledInput
        id="search"
        icon={<Search className={iconSizes.sm} />}
        label={t('pageFilters.search.label')}
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder={t('pageFilters.search.placeholder')}
        className="lg:col-span-1"
      />
      <LabeledSelect
        id="type-filter"
        icon={<NAVIGATION_ENTITIES.unit.icon className={cn(iconSizes.xs, NAVIGATION_ENTITIES.unit.color)} />}
        label={t('pageFilters.type.label')}
        value={filterType}
        onValueChange={setFilterType}
        options={typeOptions}
      />
      <LabeledSelect
        id="status-filter"
        icon={<Activity className={iconSizes.xs} />}
        label={t('pageFilters.status.label')}
        value={filterStatus}
        onValueChange={setFilterStatus}
        options={statusOptions}
      />
      <LabeledSelect
        id="floor-filter"
        icon={<MapPin className={iconSizes.xs} />}
        label={t('pageFilters.floor.label')}
        value={filterFloor}
        onValueChange={setFilterFloor}
        options={floorOptions}
      />
      <LabeledSelect
        id="building-filter"
        icon={<NAVIGATION_ENTITIES.building.icon className={cn(iconSizes.xs, NAVIGATION_ENTITIES.building.color)} />}
        label={t('pageFilters.building.label')}
        value={filterBuilding}
        onValueChange={setFilterBuilding}
        options={buildingOptions}
      />
    </div>
  );
}
