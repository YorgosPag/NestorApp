'use client';

import React from 'react';
import { Warehouse } from 'lucide-react';
import { GenericListHeader } from '@/components/shared/GenericListHeader';
import type { Storage } from '@/types/storage/contracts';
import { useIconSizes } from '@/hooks/useIconSizes';
import { totalPrice } from '@/lib/properties/price-resolver';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface StoragesListHeaderProps {
    storages: Storage[];
    searchTerm: string;
    onSearchChange: (term: string) => void;
    showToolbar?: boolean;
    onToolbarToggle?: (show: boolean) => void;
}

export function StoragesListHeader({
    storages,
    searchTerm,
    onSearchChange,
    showToolbar = false,
    onToolbarToggle
}: StoragesListHeaderProps) {
    // 🏢 ENTERPRISE: i18n hook for translations
    const { t } = useTranslation('storage');
    const iconSizes = useIconSizes();
    // Calculate statistics
    const availableCount = storages.filter(storage => storage.status === 'available').length;
    const occupiedCount = storages.filter(storage => storage.status === 'occupied').length;
    const totalArea = storages.reduce((sum, storage) => sum + storage.area, 0);
    // ADR-777 Α5/Α6 — the price SSoT, and the average divides by the units that
    // HAVE a price: dividing by `storages.length` let every priceless unit pull
    // the average down as though it were free.
    const priced = totalPrice(storages);
    const totalValue = priced.total;
    const averagePrice = priced.average;

    return (
        <div>
            {/* 🏢 ENTERPRISE CENTRALIZED GenericListHeader - ΜΙΑ ΠΗΓΗ ΑΛΗΘΕΙΑΣ */}
            <GenericListHeader
                icon={Warehouse}
                entityName={t('storages.list.entityName')}
                itemCount={storages.length}
                searchTerm={searchTerm}
                onSearchChange={onSearchChange}
                searchPlaceholder={t('storages.list.searchPlaceholder')}
                showToolbar={showToolbar}
                onToolbarToggle={onToolbarToggle}
                hideSearch  // 🏢 ENTERPRISE: Κρύβουμε το search - χρησιμοποιούμε το CompactToolbar search
            />
        </div>
    );
}