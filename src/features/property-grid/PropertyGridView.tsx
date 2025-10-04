'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Home, SlidersHorizontal, MapPin } from 'lucide-react';
import { usePublicPropertyViewer } from '@/hooks/usePublicPropertyViewer';

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
    <div className="min-h-screen bg-gray-50 dark:bg-background">
      {/* Header */}
      <div className="bg-white dark:bg-card border-b dark:border-border sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-4">
            {/* Top Row */}
            <div className="flex justify-between items-center mb-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-foreground">Διαθέσιμα Ακίνητα</h1>
                <p className="text-sm text-gray-600 dark:text-muted-foreground mt-1">
                  Βρέθηκαν {filteredProperties.length} ακίνητα
                </p>
              </div>

              <div className="flex items-center gap-3">
                <ViewModeToggle value={viewMode} onChange={setViewMode} />
                <button
                  onClick={handleViewAllFloorPlan}
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all flex items-center gap-2 font-medium"
                >
                  <MapPin className="h-4 w-4" />
                  Προβολή σε Κάτοψη
                </button>
              </div>
            </div>

            {/* Search and Filters Row */}
            <div className="flex gap-3">
              <SearchBar value={searchTerm} onChange={setSearchTerm} />
              <TypeSelect
                selected={filters.propertyType[0]}
                onChange={(value) => {
                  setFilters({
                    ...filters,
                    propertyType: value === 'all' ? [] : [value],
                  });
                }}
              />
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`px-4 py-2.5 border rounded-lg flex items-center gap-2 transition-colors ${
                  showFilters ? 'bg-blue-50 dark:bg-blue-900/50 border-blue-300 text-blue-600' : 'border-gray-200 dark:border-border hover:bg-gray-50 dark:hover:bg-muted/50'
                }`}
              >
                <SlidersHorizontal className="h-4 w-4" />
                <span className="font-medium">Φίλτρα</span>
              </button>
            </div>
            
            <AdvancedFiltersPanel 
                show={showFilters}
                priceRange={priceRange}
                setPriceRange={setPriceRange}
                areaRange={areaRange}
                setAreaRange={setAreaRange}
            />

          </div>
        </div>
      </div>

      {/* Properties Grid/List */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {filteredProperties.length > 0 ? (
          <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : "space-y-4"}>
            {filteredProperties.map((property: any) =>
              viewMode === 'grid'
                ? <PropertyCard key={property.id} property={property} onViewFloorPlan={handleViewFloorPlan} />
                : <PropertyListItem key={property.id} property={property} onViewFloorPlan={handleViewFloorPlan} />
            )}
          </div>
        ) : (
          <div className="text-center py-12">
            <Home className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-foreground mb-2">Δεν βρέθηκαν ακίνητα</h3>
            <p className="text-gray-500 dark:text-muted-foreground">Δοκιμάστε να αλλάξετε τα κριτήρια αναζήτησης</p>
          </div>
        )}
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
            className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all font-medium inline-flex items-center gap-2"
          >
            <MapPin className="h-5 w-5" />
            Προβολή Κάτοψης Ορόφου
          </button>
        </div>
      </div>
    </div>
  );
}
