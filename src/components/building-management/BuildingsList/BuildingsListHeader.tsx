
'use client';

import React from 'react';
import { Building2, TrendingUp, DollarSign, Settings } from 'lucide-react';
import { SectionHeader } from '@/core/headers';
import { Button } from '@/components/ui/button';
import { SearchInput } from '@/components/ui/search'; // 🏢 Enterprise centralized search - Same as navigation modal

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
            {/* Header with icon, title, search field, and Settings button */}
            <div className="p-3 border-b bg-card flex items-center gap-2">
                {/* Left: Icon + Title */}
                <div className="flex items-center gap-2 flex-shrink-0">
                    <Building2 className="h-4 w-4 text-blue-600" />
                    <span className="font-medium text-sm whitespace-nowrap">
                        Κτίρια ({buildingCount})
                    </span>
                </div>

                {/* Center: 🏢 ENTERPRISE - EXACT SAME AS NAVIGATION MODAL */}
                <SearchInput
                    value={searchTerm}
                    onChange={onSearchChange}
                    placeholder="Αναζήτηση κτιρίων..."
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
