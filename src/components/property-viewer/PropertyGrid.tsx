'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PropertyBadge } from '@/core/badges';
import { Home, Building, MapPin, Euro, Ruler, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { COMPLEX_HOVER_EFFECTS, INTERACTIVE_PATTERNS, HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';
import type { Property } from '@/types/property-viewer';
import { formatFloorLabel, formatCurrency } from '@/lib/intl-utils';
import { brandClasses } from '@/styles/design-tokens';

// 🚀 ENTERPRISE: PropertyGridView features integration (conditional imports)
import { PageHeader } from '@/core/headers';
import { usePublicPropertyViewer } from '@/hooks/usePublicPropertyViewer';
import { usePropertyGridFilters } from './usePropertyGridFilters';
import { TypeSelect } from './TypeSelect';
import { ViewModeToggle } from './ViewModeToggle';
import { AdvancedFiltersPanel } from './AdvancedFiltersPanel';


const propertyTypeIcons: { [key: string]: React.ElementType } = {
  'Στούντιο': Home,
  'Γκαρσονιέρα': Home,
  'Διαμέρισμα 2Δ': Home,
  'Διαμέρισμα 3Δ': Home,
  'Μεζονέτα': Building,
  'Κατάστημα': Building,
  'Αποθήκη': Building,
};

function PropertyCard({ property, onSelect, isSelected }: { property: Property, onSelect: () => void, isSelected: boolean }) {
  const iconSizes = useIconSizes();
  const { quick, getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();

  // 🎨 ENTERPRISE BORDER TOKENS - Centralized status configuration
  const statusConfig = {
    'for-sale': {
      label: 'Προς Πώληση',
      color: `${getStatusBorder('success')} ${colors.bg.success}`,
      textColor: colors.text.success
    },
    'for-rent': {
      label: 'Προς Ενοικίαση',
      color: `${brandClasses.primary.border} ${brandClasses.primary.bg}`,
      textColor: brandClasses.primary.text
    },
    'sold': {
      label: 'Πουλημένο',
      color: `${getStatusBorder('error')} ${colors.bg.error}`,
      textColor: colors.text.error
    },
    'rented': {
      label: 'Ενοικιασμένο',
      color: `${getStatusBorder('warning')} ${colors.bg.warning}`,
      textColor: colors.text.warning
    },
    'reserved': {
      label: 'Δεσμευμένο',
      color: `${getStatusBorder('warning')} ${colors.bg.warning}`,
      textColor: colors.text.warning
    },
  };

  const statusInfo = statusConfig[property.status as keyof typeof statusConfig] || { color: `${quick.card}`, label: 'Άγνωστο', textColor: colors.text.muted };
  const IconComponent = propertyTypeIcons[property.type] || Home;

  return (
    <Card 
        className={cn(
            "cursor-pointer group border",
            COMPLEX_HOVER_EFFECTS.FEATURE_CARD,
            isSelected ? `ring-2 ring-primary shadow-lg ${getStatusBorder('info')}` : getStatusBorder('muted')
        )}
        onClick={onSelect}
    >
      <CardHeader className={cn("p-4 border-b", statusInfo.color)}>
        <div className="flex justify-between items-start">
            <div>
                <CardTitle className="text-base flex items-center gap-2">
                    <IconComponent className={iconSizes.sm} />
                    {property.name}
                </CardTitle>
                <p className="text-xs text-muted-foreground">{property.type}</p>
            </div>
            <PropertyBadge
              status={property.status as any}
              variant="outline"
              className={cn("text-xs", statusInfo.color, statusInfo.textColor)}
            />
        </div>
      </CardHeader>
      <CardContent className="p-4 space-y-3">
        <div className={`flex items-center gap-2 text-xs ${colors.text.muted}`}>
          <Building className={iconSizes.xs} />
          <span>{property.building}</span>
          <MapPin className={`${iconSizes.xs} ml-2`} />
          <span>{formatFloorLabel(property.floor)}</span>
        </div>
        <div className="flex justify-between items-center text-sm">
            {property.price && (
                <div className={`flex items-center gap-1 font-semibold ${colors.text.success}`}>
                    <Euro className={iconSizes.sm}/>
                    {formatCurrency(property.price)}
                </div>
            )}
            {property.area && (
                 <div className={`flex items-center gap-1 ${colors.text.muted}`}>
                    <Ruler className={iconSizes.sm}/>
                    {property.area} τ.μ.
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
    withViewModeToggle?: boolean;
    onViewFloorPlan?: (propertyId: string) => void;
    initialFilters?: { propertyType: string[] };
  };
}

export function PropertyGrid({ properties, onSelect, selectedPropertyIds, enhanced }: PropertyGridProps) {
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

  const viewMode = gridFilters?.viewMode || 'grid';
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
        <Home className={`${iconSizes.xl} mb-4`} />
        <h2 className="text-xl font-semibold">Δεν βρέθηκαν ακίνητα</h2>
        <p className="text-sm">Δοκιμάστε να αλλάξετε τα φίλτρα</p>
      </div>
    );
  }

  // 🚀 ENHANCED MODE: Full PropertyGridView features
  if (enhanced?.withHeader) {
    return (
      <div className={`min-h-screen ${colors.bg.secondary} dark:bg-background overflow-x-hidden`}>
        {/* Header */}
        <div className="sticky top-0 z-10">
          <PageHeader
            variant="sticky"
            layout="multi-row"
            title={{
              icon: Home,
              title: "Διαθέσιμα Ακίνητα",
              subtitle: `Βρέθηκαν ${displayProperties.length} ακίνητα`
            }}
            search={enhanced.withSearch && gridFilters ? {
              value: gridFilters.searchTerm,
              onChange: gridFilters.setSearchTerm,
              placeholder: "Αναζήτηση ακινήτων..."
            } : undefined}
            filters={enhanced.withFilters ? {
              customFilters: [
                <TypeSelect
                  key="typeselect"
                  selected={filters.propertyType[0] || 'all'}
                  onChange={(value) => {
                    setFilters({
                      ...filters,
                      propertyType: value === 'all' ? [] : [value],
                    });
                  }}
                />,
                <button
                  key="advfilters"
                  onClick={() => gridFilters?.setShowFilters(!showFilters)}
                  className={`px-4 py-2.5 border ${radius.lg} flex items-center gap-2 transition-colors h-9 ${
                    showFilters ? `${colors.bg.info} ${getStatusBorder('info')} ${colors.text.info}` : `${quick.card} ${HOVER_BACKGROUND_EFFECTS.LIGHT}`
                  }`}
                >
                  <SlidersHorizontal className={iconSizes.sm} />
                  <span className="font-medium">Φίλτρα</span>
                </button>
              ]
            } : undefined}
            actions={{
              customActions: [
                enhanced.withViewModeToggle && gridFilters ? (
                  <ViewModeToggle key="viewmode" value={viewMode} onChange={gridFilters.setViewMode} />
                ) : null,
                <button
                  key="floorplan"
                  onClick={handleViewAllFloorPlan}
                  className={`px-4 py-2 ${colors.bg.gradient} text-white ${radius.lg} transition-all flex items-center gap-2 font-medium h-8 ${INTERACTIVE_PATTERNS.PRIMARY_HOVER}`}
                >
                  <MapPin className={iconSizes.sm} />
                  Προβολή σε Κάτοψη
                </button>
              ].filter(Boolean)
            }}
          />

          {/* Advanced Filters Panel */}
          {enhanced.withFilters && gridFilters && (
            <AdvancedFiltersPanel
              show={showFilters}
              priceRange={gridFilters.priceRange}
              setPriceRange={gridFilters.setPriceRange}
              areaRange={gridFilters.areaRange}
              setAreaRange={gridFilters.setAreaRange}
            />
          )}
        </div>

        {/* Properties Grid/List */}
        <div className="w-full px-4 py-8 overflow-x-hidden">
          <div className="w-full max-w-screen-sm mx-auto overflow-hidden">
            <div className={viewMode === 'grid'
              ? "flex flex-col gap-4"
              : "flex flex-col gap-4"
            }>
              {displayProperties.map((property: any) => (
                <div key={property.id} className="w-full min-w-0 overflow-hidden">
                  <PropertyCard
                    property={property}
                    onSelect={() => onSelect(property.id, false)}
                    isSelected={selectedPropertyIds.includes(property.id)}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className={`${colors.bg.secondary}/30 py-12 mt-12`}>
          <div className="max-w-4xl mx-auto text-center px-4">
            <h2 className={`text-2xl font-bold ${colors.text.foreground} mb-4`}>
              Θέλετε να δείτε τα ακίνητα στην κάτοψη του ορόφου;
            </h2>
            <p className={`${colors.text.muted} mb-6`}>
              Δείτε την ακριβή θέση και διάταξη των ακινήτων στην κάτοψη του κτηρίου.
            </p>
            <button
              onClick={handleViewAllFloorPlan}
              className={`px-8 py-3 ${colors.bg.gradient} text-white ${radius.lg} font-medium transition-all ${INTERACTIVE_PATTERNS.PRIMARY_HOVER}`}
            >
              Προβολή Κάτοψης
            </button>
          </div>
        </div>
      </div>
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
export function PropertyGridViewCompatible() {
  const { properties, filters, setFilters } = usePublicPropertyViewer();

  return (
    <PropertyGrid
      properties={properties}
      onSelect={() => {}} // PropertyGridView doesn't use selection
      selectedPropertyIds={[]}
      enhanced={{
        withHeader: true,
        withFilters: true,
        withSearch: true,
        withViewModeToggle: true,
        initialFilters: filters
      }}
    />
  );
}
