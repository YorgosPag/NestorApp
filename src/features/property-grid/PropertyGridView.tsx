'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, SlidersHorizontal } from 'lucide-react';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import { usePublicPropertyViewer } from '@/hooks/usePublicPropertyViewer';
import { PageHeader } from '@/core/headers';
import { HOVER_BACKGROUND_EFFECTS, INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useBorderTokens } from '@/hooks/useBorderTokens';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

import { usePropertyGridFilters } from './hooks/usePropertyGridFilters';
import { PropertyCard } from './components/PropertyCard';
// 🏢 ENTERPRISE: Using centralized domain card
import { PropertyListCard } from '@/domain';
import { SearchBar } from './components/SearchBar';
import { TypeSelect } from '@/components/property-viewer/TypeSelect';
import { ViewModeToggle } from './components/ViewModeToggle';
import { AdvancedFiltersPanel } from './components/AdvancedFiltersPanel';
import type { FilterableProperty } from './utils/filtering';

export function PropertyGridView() {
  const router = useRouter();
  const { properties, filters, setFilters } = usePublicPropertyViewer();
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const { quick, radius } = useBorderTokens();
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('properties');

  // Debug logs (ίδια συμπεριφορά)
  console.log('All properties from hook:', properties);
  console.log('Filters:', filters);

  const {
    viewMode, setViewMode,
    showFilters, setShowFilters,
    searchTerm, setSearchTerm,
    priceRange, setPriceRange,
    areaRange, setAreaRange,
    availableProperties,
    filteredProperties,
  } = usePropertyGridFilters(properties, filters);

  console.log('Available properties (after initial filter):', availableProperties);
  console.log('Filtered properties (after local filters):', filteredProperties);

  const handleViewFloorPlan = (propertyId: string) => {
    router.push(`/properties?view=floorplan&selected=${propertyId}`);
  };
  const handleViewAllFloorPlan = () => {
    router.push('/properties?view=floorplan');
  };

  return (
    <div className={`min-h-screen ${colors.bg.secondary} dark:${colors.bg.primary} overflow-x-hidden`}>
      {/* Header */}
      <div className="sticky top-0 z-10">
        <PageHeader
          variant="sticky"
          layout="multi-row"
          title={{
            icon: NAVIGATION_ENTITIES.unit.icon,
            title: t('grid.header.title'),
            subtitle: t('grid.header.found', { count: filteredProperties.length })
          }}
          search={{
            value: searchTerm,
            onChange: setSearchTerm,
            placeholder: t('grid.search.placeholder')
          }}
          filters={{
            customFilters: [
              <TypeSelect
                key="typeselect"
                selected={filters.propertyType[0]}
                onChange={(value) => {
                  setFilters({
                    ...filters,
                    propertyType: value === 'all' ? [] : [value],
                  });
                }}
              />,
              <button
                key="advfilters"
                onClick={() => setShowFilters(!showFilters)}
                className={`px-4 py-2.5 border ${radius.lg} flex items-center gap-2 transition-colors h-9 ${
                  showFilters ? `${colors.bg.infoSubtle} ${colors.border.info} ${colors.text.info}` : `${colors.border.muted} ${HOVER_BACKGROUND_EFFECTS.LIGHT}`
                }`}
              >
                <SlidersHorizontal className={iconSizes.sm} />
                <span className="font-medium">{t('grid.filters.button')}</span>
              </button>
            ]
          }}
          actions={{
            customActions: [
              <ViewModeToggle key="viewmode" value={viewMode} onChange={setViewMode} />,
              <button
                key="floorplan"
                onClick={handleViewAllFloorPlan}
                className={`px-4 py-2 ${colors.bg.gradient} ${colors.text.primaryContrast} ${radius.lg} transition-all flex items-center gap-2 font-medium h-8 ${INTERACTIVE_PATTERNS.PRIMARY_HOVER}`}
              >
                <MapPin className={iconSizes.sm} />
                {t('grid.actions.viewFloorPlan')}
              </button>
            ]
          }}
        />

        {/* Advanced Filters Panel */}
        <AdvancedFiltersPanel
          show={showFilters}
          priceRange={priceRange}
          setPriceRange={setPriceRange}
          areaRange={areaRange}
          setAreaRange={setAreaRange}
        />
      </div>

      {/* Properties Grid/List */}
      <div className="w-full px-4 py-8 overflow-x-hidden">
        <div className="w-full max-w-screen-sm mx-auto overflow-hidden">
          {filteredProperties.length > 0 ? (
            <div className={viewMode === 'grid'
              ? "flex flex-col gap-4"
              : "flex flex-col gap-4"
            }>
              {filteredProperties.map((property: FilterableProperty) => (
                <div key={property.id} className="w-full min-w-0 overflow-hidden">
                  {viewMode === 'grid'
                    ? <PropertyCard property={property} onViewFloorPlan={handleViewFloorPlan} />
                    : <PropertyListCard property={property} onViewFloorPlan={handleViewFloorPlan} />
                  }
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 px-4 sm:px-0">
              {React.createElement(NAVIGATION_ENTITIES.unit.icon, { className: `${iconSizes.xl} ${colors.text.muted} mx-auto mb-4` })}
              <h3 className={`text-lg font-medium ${colors.text.primary} mb-2`}>{t('grid.emptyState.title')}</h3>
              <p className={colors.text.muted}>{t('grid.emptyState.subtitle')}</p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="dark:bg-muted/30 py-12 mt-12">
        <div className="max-w-4xl mx-auto text-center px-4">
          <h2 className={`text-2xl font-bold ${colors.text.primary} mb-4`}>
            {t('grid.cta.title')}
          </h2>
          <p className={`${colors.text.muted} mb-6`}>
            {t('grid.cta.subtitle')}
          </p>
          <button
            onClick={handleViewAllFloorPlan}
            className={`px-8 py-3 ${colors.bg.gradient} ${colors.text.primaryContrast} ${radius.lg} transition-all font-medium inline-flex items-center gap-2 ${INTERACTIVE_PATTERNS.PRIMARY_HOVER}`}
          >
            <MapPin className={iconSizes.md} />
            {t('grid.cta.button')}
          </button>
        </div>
      </div>
    </div>
  );
}
