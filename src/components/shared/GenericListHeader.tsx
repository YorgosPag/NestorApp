'use client';

import React from 'react';
import { LucideIcon, Search, Settings } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface GenericListHeaderProps {
    /** Icon component for the entity */
    icon: LucideIcon;
    /** Entity name (e.g., "Επαφές", "Έργα") */
    entityName: string;
    /** Count of items */
    itemCount: number;
    /** Search term value */
    searchTerm: string;
    /** Search change handler */
    onSearchChange: (term: string) => void;
    /** Search placeholder text */
    searchPlaceholder: string;
    /** Whether toolbar is shown (mobile only) */
    showToolbar?: boolean;
    /** Toolbar toggle handler (mobile only) */
    onToolbarToggle?: (show: boolean) => void;
}

export function GenericListHeader({
    icon: Icon,
    entityName,
    itemCount,
    searchTerm,
    onSearchChange,
    searchPlaceholder,
    showToolbar = false,
    onToolbarToggle
}: GenericListHeaderProps) {
    return (
        <div className="p-3 border-b bg-card flex items-center gap-2">
            {/* Left: Icon + Title */}
            <div className="flex items-center gap-2 flex-shrink-0">
                <Icon className="h-4 w-4 text-blue-600" />
                <span className="font-medium text-sm whitespace-nowrap">
                    {entityName} ({itemCount})
                </span>
            </div>

            {/* Center: Search Field */}
            <div className="relative flex-1">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <Input
                    placeholder={searchPlaceholder}
                    value={searchTerm}
                    onChange={(e) => onSearchChange(e.target.value)}
                    className="pl-7 h-8 text-sm"
                />
            </div>

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
    );
}