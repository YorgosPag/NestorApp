'use client';

import React from 'react';
import { Warehouse, CheckCircle, DollarSign, TrendingUp } from 'lucide-react';
import { GenericListHeader } from '@/components/shared/GenericListHeader';
import type { Storage } from '@/types/storage/contracts';
import { useIconSizes } from '@/hooks/useIconSizes';

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
    const iconSizes = useIconSizes();
    // Calculate statistics
    const availableCount = storages.filter(storage => storage.status === 'available').length;
    const occupiedCount = storages.filter(storage => storage.status === 'occupied').length;
    const totalArea = storages.reduce((sum, storage) => sum + storage.area, 0);
    const totalValue = storages.reduce((sum, storage) => sum + (storage.price || 0), 0);
    const averagePrice = totalValue > 0 && storages.length > 0 ? totalValue / storages.length : 0;

    return (
        <div>
            {/* 🏢 ENTERPRISE CENTRALIZED GenericListHeader - ΜΙΑ ΠΗΓΗ ΑΛΗΘΕΙΑΣ */}
            <GenericListHeader
                icon={Warehouse}
                entityName="Αποθήκες"
                itemCount={storages.length}
                searchTerm={searchTerm}
                onSearchChange={onSearchChange}
                searchPlaceholder="Αναζήτηση αποθηκών..."
                showToolbar={showToolbar}
                onToolbarToggle={onToolbarToggle}
                hideSearch={true}  // 🏢 ENTERPRISE: Κρύβουμε το search - χρησιμοποιούμε το CompactToolbar search
            />
        </div>
    );
}