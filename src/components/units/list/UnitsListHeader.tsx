'use client';

import React from 'react';
import { CommonBadge } from "@/core/badges";
import { Home } from 'lucide-react';
import { formatCurrency } from '@/lib/project-utils';
import { SectionHeader } from '@/core/headers';

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
        <div>
            {/* Centralized Header Part */}
            <SectionHeader
                icon={Home}
                title="Λίστα Μονάδων"
                count={unitCount}
                className="mb-0 border-b-0"
            />

            {/* Custom Statistics with Badges */}
            <div className="px-4 pb-4 border-b bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20">
                <div className="flex items-center justify-between text-xs">
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
        </div>
    );
}
