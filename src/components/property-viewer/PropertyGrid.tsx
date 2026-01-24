'use client';

import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useIconSizes } from '@/hooks/useIconSizes';
// 🏢 ENTERPRISE: Centralized entity icons/colors (ZERO hardcoded values)
import { NAVIGATION_ENTITIES } from '@/components/navigation/config/navigation-entities';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import type { Property } from '@/types/property-viewer';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';

// 🏢 ENTERPRISE: Using centralized UnitGridCard (PR: Enterprise Grid System)
import { UnitGridCard } from '@/domain';

// 🚀 ENTERPRISE: PropertyGridView features integration (conditional imports)
import { usePublicPropertyViewer } from '@/hooks/usePublicPropertyViewer';
import { usePropertyGridFilters } from './usePropertyGridFilters';


// 🏢 ENTERPRISE: Centralized Unit Icon & Color (for empty state)
const UnitIcon = NAVIGATION_ENTITIES.unit.icon;
const unitColor = NAVIGATION_ENTITIES.unit.color;

// ✅ ENTERPRISE: PropertyCard REPLACED with UnitGridCard from @/domain (PR: Enterprise Grid System)
// 🏢 All grid cards now use the centralized design system GridCard molecule


// 🏢 ENTERPRISE: Enhanced PropertyGrid with optional page features
interface PropertyGridProps {
  properties: Property[];
  onSelect: (id: string, shift: boolean) => void;
  selectedPropertyIds: string[];
  // 🚀 NEW: Optional enhanced features from PropertyGridView
  enhanced?: {
    withHeader?: boolean;
    withFilters?: boolean;
    withSearch?: boolean;
    // ❌ REMOVED: withViewModeToggle - Conflicts with header icons (Single Source of Truth)
    onViewFloorPlan?: (propertyId: string) => void;
    initialFilters?: { propertyType: string[] };
  };
}

export function PropertyGrid({ properties, onSelect, selectedPropertyIds, enhanced }: PropertyGridProps) {
  // 🏢 ENTERPRISE: i18n hook for translations
  const { t } = useTranslation('properties');
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();

  // 🚀 ENTERPRISE: Conditional enhanced features (PropertyGridView integration)
  const enhancedFilters = enhanced?.initialFilters || { propertyType: [] };
  const [filters] = React.useState(enhancedFilters);

  // Only use PropertyGridView features if enhanced mode is enabled
  const gridFilters = enhanced ? usePropertyGridFilters(properties, filters) : null;

  const displayProperties = enhanced && gridFilters
    ? gridFilters.filteredProperties
    : properties;

  // Empty state
  if (displayProperties.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center h-full ${colors.text.muted} p-4`}>
        <UnitIcon className={`${iconSizes.xl} mb-4 ${unitColor}`} />
        <h2 className="text-xl font-semibold">{t('grid.emptyState.title')}</h2>
        <p className="text-sm">{t('grid.emptyState.subtitle')}</p>
      </div>
    );
  }

  // 🚀 ENHANCED MODE: Full PropertyGridView features
  if (enhanced?.withHeader) {
    return (
      <>
        {/* ❌ REMOVED: Duplicate PageHeader with search/filters - Already present in main page */}
        {/* 🏢 ENTERPRISE: Grid view uses centralized page-level AdvancedFiltersPanel (no duplication) */}

        {/* Properties Grid - Full width with 8px padding matching list layout */}
        <div className="w-full p-2 overflow-y-auto flex-1">
          {/* 🏢 ENTERPRISE: Responsive Grid - 1 col (mobile), 2 cols (tablet), 3 cols (desktop), 4 cols (xl) */}
          {/* NO max-width constraint - grid expands to fill available space */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
            {displayProperties.map((property: Property) => (
              <UnitGridCard
                key={property.id}
                unit={property}
                onSelect={() => onSelect(property.id, false)}
                isSelected={selectedPropertyIds.includes(property.id)}
              />
            ))}
          </div>
        </div>
      </>
    );
  }

  // 🔒 STANDARD MODE: Original PropertyGrid functionality (backward compatible)
  return (
    <ScrollArea className="h-full">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 p-4">
        {displayProperties.map(prop => (
          <UnitGridCard
            key={prop.id}
            unit={prop}
            onSelect={() => onSelect(prop.id, false)}
            isSelected={selectedPropertyIds.includes(prop.id)}
          />
        ))}
      </div>
    </ScrollArea>
  );
}

// 🚀 ENTERPRISE COMPATIBILITY: PropertyGridView wrapper for seamless migration
// 🏢 ENTERPRISE: Grid view now fully integrated with page-level filters (no duplication)

// 🏢 ENTERPRISE: Extended interface for selection support (PR: Grid Selection Styling)
interface PropertyGridViewCompatibleProps {
  properties?: Property[];
  /** Selected property IDs for visual highlighting */
  selectedPropertyIds?: string[];
  /** Callback when a property is selected */
  onSelect?: (id: string, shift: boolean) => void;
}

export function PropertyGridViewCompatible({
  properties: externalProperties,
  selectedPropertyIds: externalSelectedIds,
  onSelect: externalOnSelect,
}: PropertyGridViewCompatibleProps) {
  // ✅ ENTERPRISE: Use externally provided properties (from page filters) if available
  // Otherwise fallback to usePublicPropertyViewer (for standalone usage)
  const { properties: hookProperties, filters } = usePublicPropertyViewer();
  const displayProperties = externalProperties || hookProperties;

  return (
    <PropertyGrid
      properties={displayProperties}
      // 🏢 ENTERPRISE: Support external selection (PR: Grid Selection Styling)
      onSelect={externalOnSelect || (() => {})}
      selectedPropertyIds={externalSelectedIds || []}
      enhanced={{
        withHeader: true,
        // ❌ REMOVED: withFilters, withSearch - Use page-level AdvancedFiltersPanel (no duplication)
        initialFilters: filters
      }}
    />
  );
}
