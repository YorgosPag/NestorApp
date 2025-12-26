'use client';

import React from 'react';
import { CommonBadge } from "@/core/badges";
import { Home, Settings } from 'lucide-react';
import { formatCurrency } from '@/lib/intl-utils';
import { GenericListHeader } from '@/components/shared/GenericListHeader';
import { Button } from '@/components/ui/button';
import { useBorderTokens } from '@/hooks/useBorderTokens';

interface UnitsListHeaderProps {
    unitCount: number;
    availableCount: number;
    totalValue: number;
    searchTerm: string;
    onSearchChange: (term: string) => void;
    showToolbar?: boolean;
    onToolbarToggle?: (show: boolean) => void;
}

export function UnitsListHeader({
    unitCount,
    availableCount,
    totalValue,
    searchTerm,
    onSearchChange,
    showToolbar = false,
    onToolbarToggle
}: UnitsListHeaderProps) {
    const { getDirectionalBorder } = useBorderTokens();

    return (
        <div>
            {/* 🏢 ENTERPRISE CENTRALIZED GenericListHeader - ΜΙΑ ΠΗΓΗ ΑΛΗΘΕΙΑΣ */}
            <GenericListHeader
                icon={Home}
                entityName="Μονάδες"
                itemCount={unitCount}
                searchTerm={searchTerm}
                onSearchChange={onSearchChange}
                searchPlaceholder="Αναζήτηση μονάδων..."
                showToolbar={showToolbar}
                onToolbarToggle={onToolbarToggle}
            />

            {/* Custom Statistics with Badges */}
            <div className={`px-4 pb-4 ${getDirectionalBorder('info', 'bottom')} bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20`}>
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
