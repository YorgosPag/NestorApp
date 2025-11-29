
'use client';

import React from 'react';
import { Building2, TrendingUp, DollarSign } from 'lucide-react';
import { SectionHeader } from '@/core/headers';

interface BuildingsListHeaderProps {
    buildingCount: number;
    activeProjectsCount: number;
    totalValue: number;
}

export function BuildingsListHeader({
    buildingCount,
    activeProjectsCount,
    totalValue
}: BuildingsListHeaderProps) {
    return (
        <div>
            {/* Centralized Header Part */}
            <SectionHeader
                icon={Building2}
                title="Κτίρια"
                count={buildingCount}
                className="mb-0 border-b-0"
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
