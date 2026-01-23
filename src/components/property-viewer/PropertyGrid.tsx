'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PropertyBadge } from '@/core/badges';
import { SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIconSizes } from '@/hooks/useIconSizes';
// 🏢 ENTERPRISE: Centralized entity icons/colors (ZERO hardcoded values)
import { NAVIGATION_ENTITIES } from '@/components/navigation/config/navigation-entities';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { COMPLEX_HOVER_EFFECTS, INTERACTIVE_PATTERNS, HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';
import type { Property } from '@/types/property-viewer';
import { formatFloorLabel, formatCurrency } from '@/lib/intl-utils';
import { brandClasses } from '@/styles/design-tokens';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';

// 🏢 ENTERPRISE: Import centralized status labels - ZERO HARDCODED VALUES
import { PROPERTY_STATUS_LABELS } from '@/constants/property-statuses-enterprise';

// 🚀 ENTERPRISE: PropertyGridView features integration (conditional imports)
import { PageHeader } from '@/core/headers';
import { usePublicPropertyViewer } from '@/hooks/usePublicPropertyViewer';
import { usePropertyGridFilters } from './usePropertyGridFilters';
import { TypeSelect } from './TypeSelect';
// ❌ REMOVED: ViewModeToggle - Conflicts with header icons (Single Source of Truth)
// import { ViewModeToggle } from './ViewModeToggle';
import { AdvancedFiltersPanel } from './AdvancedFiltersPanel';


// 🏢 ENTERPRISE: Centralized Unit Icon & Color
const UnitIcon = NAVIGATION_ENTITIES.unit.icon;
const unitColor = NAVIGATION_ENTITIES.unit.color;

// 🏢 ENTERPRISE: Using centralized icons for property types
const propertyTypeIcons: { [key: string]: React.ElementType } = {
  'Στούντιο': NAVIGATION_ENTITIES.unit.icon,
  'Γκαρσονιέρα': NAVIGATION_ENTITIES.unit.icon,
  'Διαμέρισμα 2Δ': NAVIGATION_ENTITIES.unit.icon,
  'Διαμέρισμα 3Δ': NAVIGATION_ENTITIES.unit.icon,
  'Μεζονέτα': NAVIGATION_ENTITIES.building.icon,
  'Κατάστημα': NAVIGATION_ENTITIES.building.icon,
  'Αποθήκη': NAVIGATION_ENTITIES.storage.icon,
};

function PropertyCard({ property, onSelect, isSelected }: { property: Property, onSelect: () => void, isSelected: boolean }) {
  // 🏢 ENTERPRISE: i18n hook for translations
  const { t } = useTranslation('properties');
  const iconSizes = useIconSizes();
  const { quick, getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();

  // 🎨 ENTERPRISE STATUS STYLING - Subtle, professional approach
  // ✅ CENTRALIZED: Using PROPERTY_STATUS_LABELS from central system - ZERO HARDCODED VALUES
  // 🏢 SAP/Salesforce Pattern: Status only shown in badge, header is clean
  const statusConfig = {
    'for-sale': {
      label: PROPERTY_STATUS_LABELS['for-sale']
    },
    'for-rent': {
      label: PROPERTY_STATUS_LABELS['for-rent']
    },
    'sold': {
      label: PROPERTY_STATUS_LABELS.sold
    },
    'rented': {
      label: PROPERTY_STATUS_LABELS.rented
    },
    'reserved': {
      label: PROPERTY_STATUS_LABELS.reserved
    },
  };

  const statusInfo = statusConfig[property.status as keyof typeof statusConfig] || { label: t('grid.status.unknown') };
  const IconComponent = propertyTypeIcons[property.type] || UnitIcon;

  return (
    <Card
        className={cn(
            "cursor-pointer group border rounded-lg",
            COMPLEX_HOVER_EFFECTS.FEATURE_CARD,
            // 🏢 ENTERPRISE: Selection styling aligned with ListCard (blue border + blue background)
            isSelected
              ? cn(getStatusBorder('info'), colors.bg.info, 'ring-2 ring-primary shadow-lg')
              : getStatusBorder('muted')
        )}
        onClick={onSelect}
    >
      {/* 🏢 ENTERPRISE: Clean header without heavy status borders - Professional SAP/Salesforce pattern */}
      <CardHeader className="p-3 border-b">
        <div className="flex justify-between items-start gap-2">
            <div className="flex-1 min-w-0">
                <CardTitle className="text-sm flex items-center gap-2 truncate">
                    <IconComponent className={iconSizes.sm} />
                    {property.name}
                </CardTitle>
                <p className="text-xs text-muted-foreground truncate mt-1">{property.type}</p>
            </div>
            {/* 🏢 ENTERPRISE: Badge handles status styling (subtle, professional) */}
            <PropertyBadge
              status={property.status}
              className="text-xs flex-shrink-0"
            />
        </div>
      </CardHeader>
      <CardContent className="p-3 space-y-2">
        <div className={`flex items-center gap-2 text-xs ${colors.text.muted}`}>
          {/* 🏢 ENTERPRISE: Using centralized building icon/color */}
          <NAVIGATION_ENTITIES.building.icon className={cn(iconSizes.xs, NAVIGATION_ENTITIES.building.color)} />
          <span>{property.building}</span>
          {/* 🏢 ENTERPRISE: Using centralized floor icon/color */}
          <NAVIGATION_ENTITIES.floor.icon className={cn(iconSizes.xs, NAVIGATION_ENTITIES.floor.color, 'ml-2')} />
          <span>{formatFloorLabel(property.floor)}</span>
        </div>
        <div className="flex justify-between items-center text-sm">
            {/* ❌ REMOVED: Price display (commercial data - domain separation)
            Migration: PR1.1 - Units Grid Cleanup - Price moved to /sales
            */}
            {property.area && (
                 <div className={`flex items-center gap-1 ${colors.text.muted}`}>
                    {/* 🏢 ENTERPRISE: Using centralized area icon/color */}
                    <NAVIGATION_ENTITIES.area.icon className={cn(iconSizes.sm, NAVIGATION_ENTITIES.area.color)}/>
                    {property.area} {t('grid.area.sqm')}
                </div>
            )}
        </div>
      </CardContent>
    </Card>
  );
}


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
  const { quick, radius, getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();
  const router = useRouter();

  // 🚀 ENTERPRISE: Conditional enhanced features (PropertyGridView integration)
  const enhancedFilters = enhanced?.initialFilters || { propertyType: [] };
  const [filters, setFilters] = React.useState(enhancedFilters);

  // Only use PropertyGridView features if enhanced mode is enabled
  const gridFilters = enhanced ? usePropertyGridFilters(properties, filters) : null;

  const displayProperties = enhanced && gridFilters
    ? gridFilters.filteredProperties
    : properties;

  // ❌ REMOVED: viewMode from gridFilters - Always grid now (Single Source of Truth)
  const showFilters = gridFilters?.showFilters || false;

  // Enhanced handlers
  const handleViewFloorPlan = (propertyId: string) => {
    if (enhanced?.onViewFloorPlan) {
      enhanced.onViewFloorPlan(propertyId);
    } else {
      router.push(`/properties?view=floorplan&selected=${propertyId}`);
    }
  };

  const handleViewAllFloorPlan = () => {
    router.push('/properties?view=floorplan');
  };

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
              <PropertyCard
                key={property.id}
                property={property}
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
          <PropertyCard
            key={prop.id}
            property={prop}
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
  const { properties: hookProperties, filters, setFilters } = usePublicPropertyViewer();
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
