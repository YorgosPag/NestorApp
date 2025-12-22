'use client';

import React from 'react';
import { Warehouse, CheckCircle, DollarSign, TrendingUp } from 'lucide-react';
import { GenericListHeader } from '@/components/shared/GenericListHeader';
import type { Storage } from '@/types/storage/contracts';

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
            />

            {/* Custom Statistics Grid */}
            <div className="px-4 pb-4 border-b bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20">
                <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="flex items-center gap-1">
                        <CheckCircle className="w-3 h-3 text-green-600" />
                        <span className="text-muted-foreground">Διαθέσιμες:</span>
                        <span className="font-medium">{availableCount}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <TrendingUp className="w-3 h-3 text-blue-600" />
                        <span className="text-muted-foreground">Κατειλημμένες:</span>
                        <span className="font-medium">{occupiedCount}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <DollarSign className="w-3 h-3 text-green-600" />
                        <span className="text-muted-foreground">Συν. Αξία:</span>
                        <span className="font-medium">{(totalValue / 1000).toFixed(0)}K€</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <Warehouse className="w-3 h-3 text-orange-600" />
                        <span className="text-muted-foreground">Συν. Επιφάνεια:</span>
                        <span className="font-medium">{totalArea.toFixed(0)} m²</span>
                    </div>
                </div>
            </div>
        </div>
    );
}