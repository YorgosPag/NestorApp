'use client';

import {
  LayoutGrid,
  Building2,
  FileEdit,
  CheckCircle,
  CircleCheck,
  XCircle,
  Clock,
  HardHat,
  PauseCircle,
  Lock,
  Wrench,
} from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { TypeQuickFilters } from './TypeQuickFilters';
import type { TypeFilterOption, TypeQuickFiltersProps } from './TypeQuickFilters';

export const PARKING_STATUS_OPTIONS: TypeFilterOption[] = [
  { value: 'all', label: 'filters.parkingStatuses.all', icon: LayoutGrid, tooltip: 'filters.parkingStatuses.allTooltip' },
  { value: 'available', label: 'filters.parkingStatuses.available', icon: CheckCircle, tooltip: 'filters.parkingStatuses.availableTooltip' },
  { value: 'occupied', label: 'filters.parkingStatuses.occupied', icon: Lock, tooltip: 'filters.parkingStatuses.occupiedTooltip' },
  { value: 'reserved', label: 'filters.parkingStatuses.reserved', icon: Clock, tooltip: 'filters.parkingStatuses.reservedTooltip' },
  { value: 'sold', label: 'filters.parkingStatuses.sold', icon: CircleCheck, tooltip: 'filters.parkingStatuses.soldTooltip' },
  { value: 'maintenance', label: 'filters.parkingStatuses.maintenance', icon: Wrench, tooltip: 'filters.parkingStatuses.maintenanceTooltip' },
];

export const STORAGE_STATUS_OPTIONS: TypeFilterOption[] = [
  { value: 'all', label: 'filters.storageStatuses.all', icon: LayoutGrid, tooltip: 'filters.storageStatuses.allTooltip' },
  { value: 'available', label: 'filters.storageStatuses.available', icon: CheckCircle, tooltip: 'filters.storageStatuses.availableTooltip' },
  { value: 'occupied', label: 'filters.storageStatuses.occupied', icon: Lock, tooltip: 'filters.storageStatuses.occupiedTooltip' },
  { value: 'reserved', label: 'filters.storageStatuses.reserved', icon: Clock, tooltip: 'filters.storageStatuses.reservedTooltip' },
  { value: 'maintenance', label: 'filters.storageStatuses.maintenance', icon: Wrench, tooltip: 'filters.storageStatuses.maintenanceTooltip' },
  { value: 'sold', label: 'filters.storageStatuses.sold', icon: CircleCheck, tooltip: 'filters.storageStatuses.soldTooltip' },
  { value: 'unavailable', label: 'filters.storageStatuses.unavailable', icon: XCircle, tooltip: 'filters.storageStatuses.unavailableTooltip' },
];

export const BUILDING_STATUS_OPTIONS: TypeFilterOption[] = [
  { value: 'all', label: 'filters.buildingStatuses.all', icon: LayoutGrid, tooltip: 'filters.buildingStatuses.allTooltip' },
  { value: 'planning', label: 'filters.buildingStatuses.planning', icon: FileEdit, tooltip: 'filters.buildingStatuses.planningTooltip' },
  { value: 'construction', label: 'filters.buildingStatuses.construction', icon: HardHat, tooltip: 'filters.buildingStatuses.constructionTooltip' },
  { value: 'completed', label: 'filters.buildingStatuses.completed', icon: CircleCheck, tooltip: 'filters.buildingStatuses.completedTooltip' },
  { value: 'active', label: 'filters.buildingStatuses.active', icon: Building2, tooltip: 'filters.buildingStatuses.activeTooltip' },
];

export const PROJECT_STATUS_OPTIONS: TypeFilterOption[] = [
  { value: 'all', label: 'filters.projectStatuses.all', icon: LayoutGrid, tooltip: 'filters.projectStatuses.allTooltip' },
  { value: 'planning', label: 'filters.projectStatuses.planning', icon: FileEdit, tooltip: 'filters.projectStatuses.planningTooltip' },
  { value: 'in_progress', label: 'filters.projectStatuses.in_progress', icon: HardHat, tooltip: 'filters.projectStatuses.in_progressTooltip' },
  { value: 'completed', label: 'filters.projectStatuses.completed', icon: CircleCheck, tooltip: 'filters.projectStatuses.completedTooltip' },
  { value: 'on_hold', label: 'filters.projectStatuses.on_hold', icon: PauseCircle, tooltip: 'filters.projectStatuses.on_holdTooltip' },
  { value: 'cancelled', label: 'filters.projectStatuses.cancelled', icon: XCircle, tooltip: 'filters.projectStatuses.cancelledTooltip' },
];

export function ParkingStatusQuickFilters(props: Omit<TypeQuickFiltersProps, 'options'>) {
  const { t } = useTranslation(['filters']);
  return (
    <TypeQuickFilters
      {...props}
      options={PARKING_STATUS_OPTIONS}
      ariaLabel={props.ariaLabel ?? t('parkingStatuses.ariaLabel')}
    />
  );
}

export function StorageStatusQuickFilters(props: Omit<TypeQuickFiltersProps, 'options'>) {
  const { t } = useTranslation(['filters']);
  return (
    <TypeQuickFilters
      {...props}
      options={STORAGE_STATUS_OPTIONS}
      ariaLabel={props.ariaLabel ?? t('storageStatuses.ariaLabel')}
    />
  );
}

export function BuildingStatusQuickFilters(props: Omit<TypeQuickFiltersProps, 'options'>) {
  const { t } = useTranslation(['filters']);
  return (
    <TypeQuickFilters
      {...props}
      options={BUILDING_STATUS_OPTIONS}
      ariaLabel={props.ariaLabel ?? t('buildingStatuses.ariaLabel')}
    />
  );
}

export function ProjectStatusQuickFilters(props: Omit<TypeQuickFiltersProps, 'options'>) {
  const { t } = useTranslation(['filters']);
  return (
    <TypeQuickFilters
      {...props}
      options={PROJECT_STATUS_OPTIONS}
      ariaLabel={props.ariaLabel ?? t('projectStatuses.ariaLabel')}
    />
  );
}
