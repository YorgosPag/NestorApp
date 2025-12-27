'use client';

import React from 'react';
import { LabeledSelect } from './LabeledSelect';
import { LabeledInput } from './LabeledInput';
import { Home, MapPin, Activity, Building2, Search } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import {
  PROPERTY_TYPE_LABELS,
  PROPERTY_STATUS_LABELS,
  PROPERTY_FILTER_LABELS,
  PROPERTY_STANDARD_FLOORS,
  LEGACY_STATUS_MAPPING,
  STORAGE_LABELS
} from '@/constants/property-statuses-enterprise';

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

const typeOptions = [
  { value: 'all', label: PROPERTY_FILTER_LABELS.ALL_TYPES },
  ...Object.entries(PROPERTY_TYPE_LABELS).map(([value, label]) => ({ value, label }))
];

const statusOptions = [
  { value: 'all', label: PROPERTY_FILTER_LABELS.ALL_STATUSES },
  ...Object.entries(LEGACY_STATUS_MAPPING).map(([legacyValue, modernValue]) => ({
    value: legacyValue,
    label: PROPERTY_STATUS_LABELS[modernValue]
  }))
];

const floorOptions = [
  { value: 'all', label: PROPERTY_FILTER_LABELS.ALL_FLOORS },
  ...PROPERTY_STANDARD_FLOORS.map(floor => ({ value: floor, label: floor }))
];

const buildingOptions = [
  { value: 'all', label: PROPERTY_FILTER_LABELS.ALL_BUILDINGS },
  { value: 'A', label: STORAGE_LABELS.BUILDING_A },
  { value: 'B', label: STORAGE_LABELS.BUILDING_B },
  { value: 'C', label: STORAGE_LABELS.BUILDING_C },
  { value: 'D', label: STORAGE_LABELS.BUILDING_D },
];

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
  const iconSizes = useIconSizes();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
      <LabeledInput
        id="search"
        icon={<Search className={iconSizes.sm} />}
        label="Αναζήτηση"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="Αναζήτηση κωδικού, αγοραστή..."
        className="lg:col-span-1"
      />
      <LabeledSelect
        id="type-filter"
        icon={<Home className={iconSizes.xs} />}
        label="Τύπος"
        value={filterType}
        onValueChange={setFilterType}
        options={typeOptions}
      />
      <LabeledSelect
        id="status-filter"
        icon={<Activity className={iconSizes.xs} />}
        label="Κατάσταση"
        value={filterStatus}
        onValueChange={setFilterStatus}
        options={statusOptions}
      />
      <LabeledSelect
        id="floor-filter"
        icon={<MapPin className={iconSizes.xs} />}
        label="Όροφος"
        value={filterFloor}
        onValueChange={setFilterFloor}
        options={floorOptions}
      />
      <LabeledSelect
        id="building-filter"
        icon={<Building2 className={iconSizes.xs} />}
        label="Κτίριο"
        value={filterBuilding}
        onValueChange={setFilterBuilding}
        options={buildingOptions}
      />
    </div>
  );
}
