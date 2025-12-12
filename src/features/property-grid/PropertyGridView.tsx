'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Home, MapPin, SlidersHorizontal } from 'lucide-react';
import { usePublicPropertyViewer } from '@/hooks/usePublicPropertyViewer';
import { PageHeader } from '@/core/headers';
import { HOVER_BACKGROUND_EFFECTS, INTERACTIVE_PATTERNS } from '@/components/ui/effects';

import { usePropertyGridFilters } from './hooks/usePropertyGridFilters';
import { PropertyCard } from './components/PropertyCard';
import { PropertyListItem } from './components/PropertyListItem';
import { SearchBar } from './components/SearchBar';
import { TypeSelect } from './components/TypeSelect';
import { ViewModeToggle } from './components/ViewModeToggle';
import { AdvancedFiltersPanel } from './components/AdvancedFiltersPanel';

export function PropertyGridView() {
  const router = useRouter();
  const { properties, filters, setFilters } = usePublicPropertyViewer();

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
    <div className="min-h-screen bg-gray-50 dark:bg-background overflow-x-hidden">
      {/* Header */}
      <div className="sticky top-0 z-10">
        <PageHeader
          variant="sticky"
          layout="multi-row"
          title={{
            icon: Home,
            title: "Διαθέσιμα Ακίνητα",
            subtitle: `Βρέθηκαν ${filteredProperties.length} ακίνητα`
          }}
          search={{
            value: searchTerm,
            onChange: setSearchTerm,
            placeholder: "Αναζήτηση ακινήτων..."
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
                className={`px-4 py-2.5 border rounded-lg flex items-center gap-2 transition-colors h-9 ${
                  showFilters ? 'bg-blue-50 dark:bg-blue-900/50 border-blue-300 text-blue-600' : `border-gray-200 dark:border-border ${HOVER_BACKGROUND_EFFECTS.LIGHT}`
                }`}
              >
                <SlidersHorizontal className="h-4 w-4" />
                <span className="font-medium">Φίλτρα</span>
              </button>
            ]
          }}
          actions={{
            customActions: [
              <ViewModeToggle key="viewmode" value={viewMode} onChange={setViewMode} />,
              <button
                key="floorplan"
                onClick={handleViewAllFloorPlan}
                className={`px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg transition-all flex items-center gap-2 font-medium h-8 ${INTERACTIVE_PATTERNS.PRIMARY_HOVER}`}
              >
                <MapPin className="h-4 w-4" />
                Προβολή σε Κάτοψη
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
              {filteredProperties.map((property: any) => (
                <div key={property.id} className="w-full min-w-0 overflow-hidden">
                  {viewMode === 'grid'
                    ? <PropertyCard property={property} onViewFloorPlan={handleViewFloorPlan} />
                    : <PropertyListItem property={property} onViewFloorPlan={handleViewFloorPlan} />
                  }
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 px-4 sm:px-0">
              <Home className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-foreground mb-2">Δεν βρέθηκαν ακίνητα</h3>
              <p className="text-gray-500 dark:text-muted-foreground">Δοκιμάστε να αλλάξετε τα κριτήρια αναζήτησης</p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="dark:bg-muted/30 py-12 mt-12">
        <div className="max-w-4xl mx-auto text-center px-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-foreground mb-4">
            Θέλετε να δείτε τα ακίνητα στην κάτοψη του ορόφου;
          </h2>
          <p className="text-gray-600 dark:text-muted-foreground mb-6">
            Εξερευνήστε διαδραστικά τη θέση κάθε ακινήτου και δείτε τα γειτονικά διαμερίσματα
          </p>
          <button
            onClick={handleViewAllFloorPlan}
            className={`px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg transition-all font-medium inline-flex items-center gap-2 ${INTERACTIVE_PATTERNS.PRIMARY_HOVER}`}
          >
            <MapPin className="h-5 w-5" />
            Προβολή Κάτοψης Ορόφου
          </button>
        </div>
      </div>
    </div>
  );
}
