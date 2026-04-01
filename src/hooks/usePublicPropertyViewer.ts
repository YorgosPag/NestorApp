'use client';

import { useMemo, useState } from 'react';
import { useSharedProperties } from '@/contexts/SharedPropertiesProvider';
import type { Property, OperationalStatus } from '@/types/property-viewer';
import type { FilterState } from '@/types/property-viewer';
import { tallyBy } from '@/utils/collection-utils';

// ============================================================================
// 🏢 ENTERPRISE: Public Viewing Eligibility Configuration
// ============================================================================
// A property is eligible for public viewing if:
// 1. It has a market status indicating availability (for-sale, for-rent, reserved)
// 2. OR it has an operational status of 'ready' (construction complete)
//
// This dual-check ensures properties appear even when only one status is set,
// which is common during data migration or when using different status systems.
// ============================================================================

// ============================================================================
// Commercial statuses that should appear in public property listings
// Reserved/sold/rented are EXCLUDED — only actively available properties shown
// ============================================================================
const PUBLIC_ALLOWED_COMMERCIAL_STATUSES: ReadonlySet<string> = new Set([
  'for-sale', 'for-rent', 'for-sale-and-rent',
]);

// Legacy market statuses (fallback when commercialStatus is absent)
const PUBLIC_ALLOWED_LEGACY_STATUSES: ReadonlySet<string> = new Set([
  'for-sale', 'for-rent',
]);

// Operational statuses that indicate the property is ready for viewing
const PUBLIC_ALLOWED_OPERATIONAL_STATUSES: OperationalStatus[] = ['ready'];

// 🏢 ADR-051: Use undefined for empty ranges (enterprise-grade type consistency)
const DEFAULT_PUBLIC_FILTERS: FilterState = {
  searchTerm: '',
  project: [],
  building: [],
  floor: [],
  propertyType: [],
  status: [],
  priceRange: { min: undefined, max: undefined },
  areaRange: { min: undefined, max: undefined },
  features: [],
};

/**
 * Hook για το public Properties page - read-only mirror του Units page
 * Φιλτράρει μόνο τα actively available ακίνητα (for-sale, for-rent, for-sale-and-rent)
 * Απενεργοποιεί όλες τις edit capabilities
 */
export function usePublicPropertyViewer() {
  // Παίρνουμε δεδομένα από το shared context
  const { properties: allProperties, floors, isLoading } = useSharedProperties();

  // Local state για UI controls
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<string[]>([]);
  const [hoveredPropertyId, setHoveredPropertyId] = useState<string | null>(null);
  const [selectedFloorId, setSelectedFloorId] = useState<string | null>("floor-2");
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [showDashboard, setShowDashboard] = useState(false);
  const [scale, setScale] = useState(1);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_PUBLIC_FILTERS);

  // Φιλτράρουμε properties για public view
  // 🏢 ADR-197: commercialStatus υπερισχύει του legacy status
  // Reserved/sold/rented αποκλείονται — μόνο actively available εμφανίζονται
  const publicProperties = useMemo(() => {
    if (!Array.isArray(allProperties)) return [];

    return allProperties.filter((property: Property) => {
      // ADR-197: commercialStatus is source of truth when present
      if (property.commercialStatus) {
        return PUBLIC_ALLOWED_COMMERCIAL_STATUSES.has(property.commercialStatus);
      }

      // Fallback: legacy status check (for-sale, for-rent only — NOT reserved)
      const hasAllowedLegacyStatus = PUBLIC_ALLOWED_LEGACY_STATUSES.has(property.status);

      // OR: operational status indicates ready
      const hasAllowedOperationalStatus = property.operationalStatus
        ? PUBLIC_ALLOWED_OPERATIONAL_STATUSES.includes(property.operationalStatus)
        : false;

      return hasAllowedLegacyStatus || hasAllowedOperationalStatus;
    });
  }, [allProperties]);

  // Apply filters to public properties
  const filteredProperties = useMemo(() => {
    let filtered = publicProperties;

    // Search term filter
    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      filtered = filtered.filter(property => {
        const name = (property.name ?? '').toLowerCase();
        const desc = (property.description ?? '').toLowerCase();
        return name.includes(term) || desc.includes(term);
      });
    }

    // Type filter
    if (filters.propertyType.length > 0) {
      filtered = filtered.filter(property => 
        filters.propertyType.includes(property.type)
      );
    }

    // Status filter
    if (filters.status.length > 0) {
      filtered = filtered.filter(property => 
        filters.status.includes(property.status)
      );
    }

    // Price range filter
    // 🏢 ENTERPRISE: Check for both null AND undefined (ADR-051 uses undefined for empty ranges)
    const hasPriceFilter = filters.priceRange.min != null || filters.priceRange.max != null;
    if (hasPriceFilter) {
      filtered = filtered.filter(property => {
        const price = property.price || 0;
        const minOk = filters.priceRange.min == null || price >= filters.priceRange.min;
        const maxOk = filters.priceRange.max == null || price <= filters.priceRange.max;
        return minOk && maxOk;
      });
    }

    // Area range filter
    // 🏢 ENTERPRISE: Check for both null AND undefined (ADR-051 uses undefined for empty ranges)
    const hasAreaFilter = filters.areaRange.min != null || filters.areaRange.max != null;
    if (hasAreaFilter) {
      filtered = filtered.filter(property => {
        const area = property.area || 0;
        const minOk = filters.areaRange.min == null || area >= filters.areaRange.min;
        const maxOk = filters.areaRange.max == null || area <= filters.areaRange.max;
        return minOk && maxOk;
      });
    }

    return filtered;
  }, [publicProperties, filters]);

  // Υπολογίζουμε stats μόνο για διαθέσιμα properties
  // 🏢 ENTERPRISE: Stats calculation considers both market and operational status
  const dashboardStats = useMemo(() => {
    const availableProps = publicProperties;

    // Helper: Check if property is available for sale/rent
    const isAvailableForTransaction = (p: Property): boolean => {
      const hasMarketStatus = p.status === 'for-sale' || p.status === 'for-rent';
      const isReady = p.operationalStatus === 'ready';
      return hasMarketStatus || isReady;
    };

    return {
      totalProperties: availableProps.length,
      availableProperties: availableProps.filter(isAvailableForTransaction).length,
      soldProperties: 0, // Δεν εμφανίζουμε sold properties
      totalValue: availableProps.reduce((sum, p) => sum + (p.price || 0), 0),
      totalArea: availableProps.reduce((sum, p) => sum + (p.area || 0), 0),
      averagePrice: availableProps.length > 0 ?
        availableProps.reduce((sum, p) => sum + (p.price || 0), 0) / availableProps.length : 0,
      // 🏢 ENTERPRISE: Group by effective status (market or operational)
      propertiesByStatus: tallyBy(availableProps, p => p.status || p.operationalStatus || 'unknown'),
      propertiesByType: tallyBy(availableProps, p => p.type),
      propertiesByFloor: tallyBy(availableProps, p => `Όροφος ${p.floor}`),
      totalStorageUnits: availableProps.filter(p => p.type === 'Αποθήκη').length,
      // 🏢 ENTERPRISE: Storage availability considers both status systems
      availableStorageUnits: availableProps.filter(p =>
        p.type === 'Αποθήκη' && (
          p.status === 'for-sale' ||
          p.status === 'for-rent' ||
          p.operationalStatus === 'ready'
        )
      ).length,
      soldStorageUnits: 0, // Δεν εμφανίζουμε sold
      uniqueBuildings: [...new Set(availableProps.map(p => p.building))].length,
      reserved: availableProps.filter(p => p.status === 'reserved').length,
    };
  }, [publicProperties]);

  // Find selected unit
  const selectedProperty = useMemo(() => {
    if (selectedPropertyIds.length === 1) {
      return publicProperties.find(p => p.id === selectedPropertyIds[0]) || null;
    }
    return null;
  }, [selectedPropertyIds, publicProperties]);

  // Get current floor με filtered properties
  const currentFloor = useMemo(() => {
    const baseFloor = floors.find(f => f.id === selectedFloorId);
    if (!baseFloor) return null;
    
    // Return floor με μόνο τα filtered properties
    return {
      ...baseFloor,
      properties: filteredProperties.filter(p => p.floorId === baseFloor.id)
    };
  }, [floors, selectedFloorId, filteredProperties]);

  // Event handlers
  const handleSelectUnit = (unit: Property) => {
    setSelectedPropertyIds([unit.id]);
  };

  const onHoverProperty = (propertyId: string | null) => {
    setHoveredPropertyId(propertyId);
  };

  const onSelectFloor = (floorId: string | null) => {
    setSelectedFloorId(floorId);
  };

  const handleFiltersChange = (newFilters: Partial<FilterState>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  // Read-only polygon select handler
  const handlePolygonSelect = (propertyId: string, isShiftClick: boolean) => {
    if (!propertyId) {
      setSelectedPropertyIds([]);
      return;
    }
    
    if (isShiftClick) {
      setSelectedPropertyIds(prev => 
        prev.includes(propertyId) 
          ? prev.filter(id => id !== propertyId) 
          : [...prev, propertyId]
      );
    } else {
      setSelectedPropertyIds(prev => 
        prev.length === 1 && prev[0] === propertyId ? [] : [propertyId]
      );
    }
  };

  // Disabled handlers for read-only mode
  const readOnlyHandlers = {
    handlePolygonCreated: () => {},
    handlePolygonUpdated: () => {},
    handleDuplicate: () => {},
    handleDelete: () => {},
    setProperties: () => {},
    undo: () => {},
    redo: () => {},
    setActiveTool: () => {},
    setShowGrid: () => {},
    setSnapToGrid: () => {},
    setGridSize: () => {},
    setShowMeasurements: () => {},
    setConnections: () => {},
    setGroups: () => {},
    setIsConnecting: () => {},
    setFirstConnectionPoint: () => {},
    onShowHistory: () => {},
  };

  return {
    // Data
    properties: publicProperties,
    filteredProperties,
    dashboardStats,
    floors,
    
    // State
    isLoading,
    selectedPropertyIds,
    hoveredPropertyId,
    selectedFloorId,
    selectedProperty,
    currentFloor,
    
    // UI State
    viewMode,
    setViewMode,
    showDashboard,
    setShowDashboard,
    filters,
    handleFiltersChange,
    
    // Display settings (keep some for zoom, etc.)
    showGrid: true,
    snapToGrid: true,
    gridSize: 20,
    showMeasurements: false,
    scale,
    setScale,
    
    // Event handlers
    onHoverProperty,
    onSelectFloor,
    handleSelectUnit,
    handlePolygonSelect,
    setSelectedProperties: setSelectedPropertyIds,
    
    // Read-only handlers
    ...readOnlyHandlers,
    
    // Disabled capabilities
    canUndo: false,
    canRedo: false,
    activeTool: null,
    showHistoryPanel: false,
    setShowHistoryPanel: () => {},
    suggestionToDisplay: null,
    setSuggestionToDisplay: () => {},
    connections: [],
    groups: [],
    isConnecting: false,
    firstConnectionPoint: null,
    
    // Mark as read-only for components
    isReadOnly: true,
  };
}