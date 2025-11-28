
'use client';

import React from 'react';
import { Building2, TrendingUp, DollarSign } from 'lucide-react';

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
        <div className="p-4 border-b bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20">
            <div className="flex items-center gap-3 mb-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 shadow-sm">
                    <Building2 className="w-4 h-4 text-white" />
                </div>
                <div>
                    <h3 className="text-sm font-semibold text-foreground">Κτίρια</h3>
                    <p className="text-xs text-muted-foreground">
                        {buildingCount} κτίρια συνολικά
                    </p>
                </div>
            </div>

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
    );
}
