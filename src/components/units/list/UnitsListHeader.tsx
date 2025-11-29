'use client';

import React from 'react';
import { CommonBadge } from "@/core/badges";
import { Home } from 'lucide-react';
import { formatCurrency } from '@/lib/project-utils';

interface UnitsListHeaderProps {
    unitCount: number;
    availableCount: number;
    totalValue: number;
}

export function UnitsListHeader({
    unitCount,
    availableCount,
    totalValue,
}: UnitsListHeaderProps) {
    return (
        <div className="p-4 border-b bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20">
            <div className="flex items-center gap-3 mb-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 shadow-sm">
                    <Home className="w-5 h-5 text-white" />
                </div>
                <div>
                    <h3 className="text-base font-semibold text-foreground">Λίστα Μονάδων</h3>
                    <p className="text-xs text-muted-foreground">
                        {unitCount} μονάδες συνολικά
                    </p>
                </div>
            </div>

            <div className="flex items-center justify-between text-xs mb-3">
                 <CommonBadge
                    status="units"
                    customLabel={`${availableCount} Διαθέσιμες`}
                    variant="secondary"
                 />
                 <CommonBadge
                    status="company"
                    customLabel={`${formatCurrency(totalValue)} Συνολική Αξία`}
                    variant="secondary"
                 />
            </div>

        </div>
    );
}
