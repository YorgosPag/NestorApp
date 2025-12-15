
'use client';

import React from 'react';
import { Building2, TrendingUp, DollarSign, Settings } from 'lucide-react';
import { GenericListHeader } from '@/components/shared/GenericListHeader';
import { Button } from '@/components/ui/button';

interface BuildingsListHeaderProps {
    buildingCount: number;
    activeProjectsCount: number;
    totalValue: number;
    searchTerm: string;
    onSearchChange: (term: string) => void;
    showToolbar?: boolean;
    onToolbarToggle?: (show: boolean) => void;
}

export function BuildingsListHeader({
    buildingCount,
    activeProjectsCount,
    totalValue,
    searchTerm,
    onSearchChange,
    showToolbar = false,
    onToolbarToggle
}: BuildingsListHeaderProps) {
    return (
        <div>
            {/* 🏢 ENTERPRISE CENTRALIZED GenericListHeader - ΜΙΑ ΠΗΓΗ ΑΛΗΘΕΙΑΣ */}
            <GenericListHeader
                icon={Building2}
                entityName="Κτίρια"
                itemCount={buildingCount}
                searchTerm={searchTerm}
                onSearchChange={onSearchChange}
                searchPlaceholder="Αναζήτηση κτιρίων..."
                showToolbar={showToolbar}
                onToolbarToggle={onToolbarToggle}
            />

            {/* Custom Statistics Grid */}
            <div className="px-4 pb-4 border-b bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20">
                <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="flex items-center gap-1">
                        <TrendingUp className="w-3 h-3 text-green-600" />
                        <span className="text-muted-foreground">Ενεργά:</span>
                        <span className="font-medium">{activeProjectsCount}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <DollarSign className="w-3 h-3 text-green-600" />
                        <span className="text-muted-foreground">Αξία:</span>
                        <span className="font-medium">{(totalValue / 1000000).toFixed(1)}M€</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
