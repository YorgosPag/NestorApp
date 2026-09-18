'use client';

import React from 'react';
import type { StorageType, StorageStatus } from '@/types/storage';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { BuildingSpaceFilterBar } from '../shared';

interface StorageTabFiltersProps {
    searchTerm: string;
    onSearchChange: (value: string) => void;
    filterType: StorageType | 'all';
    onFilterTypeChange: (value: StorageType | 'all') => void;
    filterStatus: StorageStatus | 'all';
    onFilterStatusChange: (value: StorageStatus | 'all') => void;
}

const FILTER_TYPES: ReadonlyArray<readonly [StorageType, string]> = [
    ['small', 'pages.storage.typeLabels.small'],
    ['large', 'pages.storage.typeLabels.large'],
    ['basement', 'pages.storage.typeLabels.basement'],
    ['ground', 'pages.storage.typeLabels.ground'],
    ['special', 'pages.storage.typeLabels.special'],
];
const FILTER_STATUSES: ReadonlyArray<readonly [StorageStatus, string]> = [
    ['available', 'pages.storage.statusLabels.available'],
    ['sold', 'pages.storage.statusLabels.sold'],
    ['reserved', 'pages.storage.statusLabels.reserved'],
    ['maintenance', 'pages.storage.statusLabels.maintenance'],
];

/** Storage labels over the ONE building space filter bar (shared with Units + Parking). */
export function StorageTabFilters({
    searchTerm,
    onSearchChange,
    filterType,
    onFilterTypeChange,
    filterStatus,
    onFilterStatusChange,
}: StorageTabFiltersProps) {
    // 🏢 ENTERPRISE: i18n hook for translations
    const { t } = useTranslation(['building', 'building-address', 'building-filters', 'building-storage', 'building-tabs', 'building-timeline']);

    return (
        <BuildingSpaceFilterBar
            searchPlaceholder={t('tabs.storageTab.searchPlaceholder')}
            searchTerm={searchTerm}
            onSearchChange={onSearchChange}
            typeFilter={{
                value: filterType,
                onChange: onFilterTypeChange,
                options: FILTER_TYPES.map(([value, key]) => ({ value, label: t(key) })),
                allLabel: t('allTypes', { ns: 'filters' }),
            }}
            statusFilter={{
                value: filterStatus,
                onChange: onFilterStatusChange,
                options: FILTER_STATUSES.map(([value, key]) => ({ value, label: t(key) })),
                allLabel: t('allStatuses', { ns: 'filters' }),
            }}
            exportLabel={t('tabs.storageTab.exportReport')}
        />
    );
}
