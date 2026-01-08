/**
 * 🏢 ENTERPRISE: Unit Type Quick Filters Component
 *
 * Segmented controls για γρήγορο φιλτράρισμα τύπων μονάδων
 * Per local_4.log architecture decision:
 * - Filters (not tabs) for same entity with different attributes
 * - State-based filtering, not navigation-based
 * - No route/breadcrumb changes
 *
 * @version 1.0.0
 * @author Enterprise Team
 * @date 2026-01-08
 * @compliance CLAUDE.md Protocol - Enterprise UI Pattern
 */

'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  LayoutGrid,
  BedSingle,
  Building2,
  Home,
  Store,
  Briefcase,
  type LucideIcon
} from 'lucide-react';

// =============================================================================
// 🏢 ENTERPRISE: Unit Type Quick Filters
// =============================================================================
// Icons follow enterprise standards (Zillow, Rightmove, JLL patterns)
// Studio/Γκαρσονιέρα unified per enterprise UX best practice
// Excludes 'Αποθήκη' as storage units are PARALLEL category (local_4.log)

interface UnitTypeOption {
  value: string;
  label: string;
  icon: LucideIcon;
  tooltip: string;
}

// 🏢 ENTERPRISE: Standard icons used by major prop-tech companies
const UNIT_TYPE_OPTIONS: UnitTypeOption[] = [
  { value: 'all', label: 'Όλες', icon: LayoutGrid, tooltip: 'Εμφάνιση όλων των τύπων' },
  { value: 'studio', label: 'Studio', icon: BedSingle, tooltip: 'Studio / Γκαρσονιέρα' },
  { value: 'apartment', label: 'Διαμέρισμα', icon: Building2, tooltip: 'Διαμέρισμα' },
  { value: 'maisonette', label: 'Μεζονέτα', icon: Home, tooltip: 'Μεζονέτα' },
  { value: 'shop', label: 'Κατάστημα', icon: Store, tooltip: 'Κατάστημα' },
  { value: 'office', label: 'Γραφείο', icon: Briefcase, tooltip: 'Γραφείο' },
];

// =============================================================================
// 🏢 ENTERPRISE: Component Props Interface
// =============================================================================

interface UnitTypeQuickFiltersProps {
  /** Currently selected type(s) - array to support multi-select in future */
  selectedTypes: string[];
  /** Callback when selection changes */
  onTypeChange: (types: string[]) => void;
  /** Optional className for container */
  className?: string;
  /** Compact mode for smaller screens */
  compact?: boolean;
}

// =============================================================================
// 🏢 ENTERPRISE: Unit Type Quick Filters Component
// =============================================================================

export function UnitTypeQuickFilters({
  selectedTypes,
  onTypeChange,
  className,
  compact = false
}: UnitTypeQuickFiltersProps) {
  const colors = useSemanticColors();

  // 🎯 Handle filter selection
  const handleFilterClick = (typeValue: string) => {
    if (typeValue === 'all') {
      // Clear all filters - show all units
      onTypeChange([]);
    } else {
      // Toggle single filter (enterprise UX: single selection for quick filters)
      if (selectedTypes.includes(typeValue)) {
        // Deselect = show all
        onTypeChange([]);
      } else {
        // Select this type only
        onTypeChange([typeValue]);
      }
    }
  };

  // 🎨 Determine if a button is active
  const isActive = (typeValue: string): boolean => {
    if (typeValue === 'all') {
      return selectedTypes.length === 0;
    }
    return selectedTypes.includes(typeValue);
  };

  return (
    <nav
      className={cn(
        'flex flex-wrap items-center gap-1 px-4 py-2',
        colors.bg.secondary,
        'border-b border-border/50',
        className
      )}
      aria-label="Φίλτρα τύπου μονάδας"
      role="group"
    >
      {/* 📋 Filter Label (desktop only) */}
      {!compact && (
        <span className={cn('text-xs font-medium mr-2', colors.text.muted)}>
          Τύπος:
        </span>
      )}

      {/* 🔘 Filter Buttons with Tooltips */}
      {UNIT_TYPE_OPTIONS.map((option) => {
        const Icon = option.icon;
        const active = isActive(option.value);

        return (
          <Tooltip key={option.value}>
            <TooltipTrigger asChild>
              <Button
                variant={active ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleFilterClick(option.value)}
                className={cn(
                  'h-7 px-2 text-xs font-medium transition-all',
                  compact ? 'px-1.5' : 'px-3',
                  active
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : cn(
                        'bg-transparent hover:bg-muted/50',
                        colors.text.secondary,
                        'border-muted-foreground/20'
                      )
                )}
                aria-pressed={active}
                aria-label={`Φιλτράρισμα: ${option.tooltip}`}
              >
                <Icon
                  className={cn(
                    'h-3.5 w-3.5',
                    !compact && 'mr-1'
                  )}
                />
                {!compact && (
                  <span className="hidden sm:inline">{option.label}</span>
                )}
                {compact && option.value === 'all' && (
                  <span className="ml-1">Όλες</span>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {option.tooltip}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </nav>
  );
}

// =============================================================================
// 🏢 ENTERPRISE: Exports
// =============================================================================

export { UNIT_TYPE_OPTIONS };
export type { UnitTypeQuickFiltersProps, UnitTypeOption };
