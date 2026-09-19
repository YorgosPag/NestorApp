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
} from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { TypeQuickFilters } from './TypeQuickFilters';
import {
  ALL_SPACE_AVAILABILITY,
  SPACE_AVAILABILITY_BUCKETS,
  type SpaceAvailabilityBucket,
} from '@/lib/spaces/space-availability';
import type { TypeFilterOption, TypeQuickFiltersProps } from './TypeQuickFilters';

/** Το εικονίδιο κάθε κουβά διάθεσης — εξαντλητικό, ώστε νέος κουβάς χωρίς εικονίδιο να μη μεταγλωττίζεται. */
const SPACE_AVAILABILITY_ICONS: Readonly<Record<SpaceAvailabilityBucket, TypeFilterOption['icon']>> = {
  listed: CheckCircle,
  reserved: Clock,
  sold: CircleCheck,
  rented: Lock,
  unavailable: XCircle,
};

/**
 * **ΟΙ** γρήγορες επιλογές διάθεσης χώρων (ADR-777 §8.60.20) — θέσεις **και** αποθήκες, σελίδα
 * χώρων **και** σελίδα πωλήσεων. Ήταν **τέσσερις** χειρόγραφες λίστες πάνω στο παλιό ανάμεικτο
 * `status` (με «Κατειλημμένη» και «Συντήρηση» ανάμεσα στις εμπορικές). Κουβάδες και κατηγόρημα:
 * `lib/spaces/space-availability`.
 */
export const SPACE_AVAILABILITY_QUICK_OPTIONS: TypeFilterOption[] = [
  { value: ALL_SPACE_AVAILABILITY, label: 'filters:spaceAvailability.all', icon: LayoutGrid, tooltip: 'filters:spaceAvailability.allTooltip' },
  ...SPACE_AVAILABILITY_BUCKETS.map((bucket) => ({
    value: bucket,
    label: `filters:spaceAvailability.${bucket}`,
    icon: SPACE_AVAILABILITY_ICONS[bucket],
    tooltip: `filters:spaceAvailability.${bucket}Tooltip`,
  })),
];

export const BUILDING_STATUS_OPTIONS: TypeFilterOption[] = [
  { value: 'all', label: 'filters:buildingStatuses.all', icon: LayoutGrid, tooltip: 'filters:buildingStatuses.allTooltip' },
  { value: 'planning', label: 'filters:buildingStatuses.planning', icon: FileEdit, tooltip: 'filters:buildingStatuses.planningTooltip' },
  { value: 'construction', label: 'filters:buildingStatuses.construction', icon: HardHat, tooltip: 'filters:buildingStatuses.constructionTooltip' },
  { value: 'completed', label: 'filters:buildingStatuses.completed', icon: CircleCheck, tooltip: 'filters:buildingStatuses.completedTooltip' },
  { value: 'active', label: 'filters:buildingStatuses.active', icon: Building2, tooltip: 'filters:buildingStatuses.activeTooltip' },
];

export const PROJECT_STATUS_OPTIONS: TypeFilterOption[] = [
  { value: 'all', label: 'filters:projectStatuses.all', icon: LayoutGrid, tooltip: 'filters:projectStatuses.allTooltip' },
  { value: 'planning', label: 'filters:projectStatuses.planning', icon: FileEdit, tooltip: 'filters:projectStatuses.planningTooltip' },
  { value: 'in_progress', label: 'filters:projectStatuses.in_progress', icon: HardHat, tooltip: 'filters:projectStatuses.in_progressTooltip' },
  { value: 'completed', label: 'filters:projectStatuses.completed', icon: CircleCheck, tooltip: 'filters:projectStatuses.completedTooltip' },
  { value: 'on_hold', label: 'filters:projectStatuses.on_hold', icon: PauseCircle, tooltip: 'filters:projectStatuses.on_holdTooltip' },
  { value: 'cancelled', label: 'filters:projectStatuses.cancelled', icon: XCircle, tooltip: 'filters:projectStatuses.cancelledTooltip' },
];

/** Γρήγορες επιλογές διάθεσης — **ένα** component για θέσεις και αποθήκες. */
export function SpaceAvailabilityQuickFilters(props: Omit<TypeQuickFiltersProps, 'options'>) {
  const { t } = useTranslation(['filters']);
  return (
    <TypeQuickFilters
      {...props}
      options={SPACE_AVAILABILITY_QUICK_OPTIONS}
      ariaLabel={props.ariaLabel ?? t('spaceAvailability.ariaLabel')}
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
