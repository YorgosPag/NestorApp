'use client';

import React from 'react';
import { CommonBadge } from "@/core/badges";
import { Home, Settings } from 'lucide-react';
import { formatCurrency } from '@/lib/intl-utils';
import { SectionHeader } from '@/core/headers';
import { Button } from '@/components/ui/button';
import { SearchInput } from '@/components/ui/search'; // 🏢 Enterprise centralized search - Same as navigation modal

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
    return (
        <div>
            {/* Header with icon, title, search field, and Settings button */}
            <div className="p-3 border-b bg-card flex items-center gap-2">
                {/* Left: Icon + Title */}
                <div className="flex items-center gap-2 flex-shrink-0">
                    <Home className="h-4 w-4 text-blue-600" />
                    <span className="font-medium text-sm whitespace-nowrap">
                        Μονάδες ({unitCount})
                    </span>
                </div>

                {/* Center: 🏢 ENTERPRISE - EXACT SAME AS NAVIGATION MODAL */}
                <SearchInput
                    value={searchTerm}
                    onChange={onSearchChange}
                    placeholder="Αναζήτηση μονάδων..."
                    debounceMs={0} // Instant για table headers
                    showClearButton={true}
                    className="h-8 text-sm flex-1" // Compact για table
                />

                {/* Right: Toolbar Toggle Button - Mobile Only */}
                {onToolbarToggle && (
                    <Button
                        onClick={() => onToolbarToggle(!showToolbar)}
                        size="sm"
                        variant={showToolbar ? "default" : "outline"}
                        className="h-8 px-2 flex-shrink-0 md:hidden"
                        title="Εργαλειοθήκη"
                    >
                        <Settings className="h-3 w-3" />
                    </Button>
                )}
            </div>

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
