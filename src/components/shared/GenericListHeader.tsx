// ============================================================================
// GENERIC LIST HEADER - MIGRATED TO ENTERPRISE UNIFIED SYSTEM
// ============================================================================
//
// 🔄 MIGRATION STATUS: ✅ COMPLETE
// - Old implementation: Custom 72-line implementation
// - New implementation: Uses SectionHeader + search functionality from unified system
// - Backward compatibility: 100% preserved
// - Breaking changes: ZERO
// - Enterprise improvement: Consistent styling across all list headers
//
// ============================================================================

'use client';

import React from 'react';
import { LucideIcon, Settings } from 'lucide-react';
import { SectionHeader } from '@/core/headers';
import { Button } from '@/components/ui/button';
import { SearchInput } from '@/components/ui/search'; // 🏢 Enterprise centralized search - Same as navigation modal

// ============================================================================
// TYPES (Backward Compatibility)
// ============================================================================

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

// ============================================================================
// MIGRATED COMPONENT
// ============================================================================

/**
 * 🔄 Generic List Header - Now uses Enterprise Unified System
 *
 * This component has been migrated to use the centralized SectionHeader component
 * plus enhanced search functionality, maintaining full backward compatibility
 * while gaining consistent enterprise styling.
 */
export function GenericListHeader({
    icon,
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
            {/* Left: Unified Section Header */}
            <div className="flex items-center gap-2 flex-shrink-0">
                <SectionHeader
                    icon={icon}
                    title={entityName}
                    count={itemCount}
                    className="!p-0 !border-0 !bg-transparent" // Override default styling to match original
                />
            </div>

            {/* Center: 🏢 ENTERPRISE - EXACT SAME PATTERN AS NAVIGATION MODAL */}
            <SearchInput
                value={searchTerm}
                onChange={onSearchChange}
                placeholder={searchPlaceholder} // 🏢 Dynamic placeholder based on entity
                debounceMs={0} // Instant για table headers
                showClearButton={true}
                className="h-8 text-sm flex-1" // Minimal overrides - let SearchInput handle focus ring
            />

            {/* Right: Toolbar Toggle Button - Mobile Only */}
            {onToolbarToggle && (
                <Button
                    onClick={() => onToolbarToggle(!showToolbar)}
                    size="sm"
                    variant={showToolbar ? "default" : "outline"}
                    className="h-8 px-2 flex-shrink-0 md:hidden"
                    title="Εργαλειοθήκη"
                    aria-label="Toggle toolbar"
                >
                    <Settings className="h-3 w-3" />
                </Button>
            )}
        </div>
    );
}