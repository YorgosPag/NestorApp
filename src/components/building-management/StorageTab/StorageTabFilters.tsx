'use client';

import type { StorageType } from '@/types/storage';
import type { SpaceAvailabilityBucket, SpaceAvailabilityFilter } from '@/lib/spaces/space-availability';
import { useSpaceAvailabilityOptions } from '@/components/shared/unit-status/useSpaceAvailabilityOptions';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { SpaceSelectFilter } from '../shared';

interface StorageTabFiltersInput {
    filterType: StorageType | 'all';
    onFilterTypeChange: (value: StorageType | 'all') => void;
    filterStatus: SpaceAvailabilityFilter;
    onFilterStatusChange: (value: SpaceAvailabilityFilter) => void;
}

export interface StorageTabFilterSet {
    readonly searchPlaceholder: string;
    readonly typeFilter: SpaceSelectFilter<StorageType>;
    readonly statusFilter: SpaceSelectFilter<SpaceAvailabilityBucket>;
}

const FILTER_TYPES: ReadonlyArray<readonly [StorageType, string]> = [
    ['small', 'pages.storage.typeLabels.small'],
    ['large', 'pages.storage.typeLabels.large'],
    ['basement', 'pages.storage.typeLabels.basement'],
    ['ground', 'pages.storage.typeLabels.ground'],
    ['special', 'pages.storage.typeLabels.special'],
];

/**
 * Storage labels for the ONE building space filter bar (shared with Units + Parking).
 *
 * ADR-898 Φ4β: a hook, not a component — the SAME filter description feeds the bar and the «Παραδοχές» sheet of the
 * XLSX export, so what the file says was filtered is what the screen filtered.
 */
export function useStorageTabFilters({
    filterType,
    onFilterTypeChange,
    filterStatus,
    onFilterStatusChange,
}: StorageTabFiltersInput): StorageTabFilterSet {
    // 🏢 ENTERPRISE: i18n hook for translations
    const { t } = useTranslation(['building', 'building-address', 'building-filters', 'building-storage', 'building-tabs', 'building-timeline']);
    const availability = useSpaceAvailabilityOptions();

    return {
        searchPlaceholder: t('tabs.storageTab.searchPlaceholder'),
        typeFilter: {
            value: filterType,
            onChange: onFilterTypeChange,
            options: FILTER_TYPES.map(([value, key]) => ({ value, label: t(key) })),
            allLabel: t('allTypes', { ns: 'filters' }),
        },
        // ADR-777 §8.60.20 — «Διάθεση» από το `commercialStatus` (ίδιοι κουβάδες με τις θέσεις).
        statusFilter: {
            value: filterStatus,
            onChange: onFilterStatusChange,
            options: availability.options,
            allLabel: availability.allLabel,
        },
    };
}
