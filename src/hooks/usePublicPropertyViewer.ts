'use client';

import { useMemo, useState } from 'react';
import { useSharedProperties } from '@/contexts/SharedPropertiesProvider';
import type { Property } from '@/types/property-viewer';
import type { FilterState } from '@/types/property-viewer';

// Allowed statuses for public viewing
const PUBLIC_ALLOWED_STATUSES = ['for-sale', 'for-rent', 'reserved'] as const;
type PublicAllowedStatus = typeof PUBLIC_ALLOWED_STATUSES[number];

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
 * Φιλτράρει μόνο τα διαθέσιμα ακίνητα (for-sale, for-rent, reserved)
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
  const publicProperties = useMemo(() => {
    if (!Array.isArray(allProperties)) return [];
    
    return allProperties.filter((property: Property) =>
      PUBLIC_ALLOWED_STATUSES.includes(property.status as PublicAllowedStatus)
    );
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
    if (filters.priceRange.min !== null || filters.priceRange.max !== null) {
      filtered = filtered.filter(property => {
        const price = property.price || 0;
        const minOk = filters.priceRange.min === null || price >= filters.priceRange.min;
        const maxOk = filters.priceRange.max === null || price <= filters.priceRange.max;
        return minOk && maxOk;
      });
    }

    // Area range filter
    if (filters.areaRange.min !== null || filters.areaRange.max !== null) {
      filtered = filtered.filter(property => {
        const area = property.area || 0;
        const minOk = filters.areaRange.min === null || area >= filters.areaRange.min;
        const maxOk = filters.areaRange.max === null || area <= filters.areaRange.max;
        return minOk && maxOk;
      });
    }

    return filtered;
  }, [publicProperties, filters]);

  // Υπολογίζουμε stats μόνο για διαθέσιμα properties
  const dashboardStats = useMemo(() => {
    const availableProps = publicProperties;
    
    return {
      totalProperties: availableProps.length,
      availableProperties: availableProps.filter(p => p.status === 'for-sale' || p.status === 'for-rent').length,
      soldProperties: 0, // Δεν εμφανίζουμε sold properties
      totalValue: availableProps.reduce((sum, p) => sum + (p.price || 0), 0),
      totalArea: availableProps.reduce((sum, p) => sum + (p.area || 0), 0),
      averagePrice: availableProps.length > 0 ? 
        availableProps.reduce((sum, p) => sum + (p.price || 0), 0) / availableProps.length : 0,
      propertiesByStatus: availableProps.reduce((acc, p) => { 
        acc[p.status] = (acc[p.status] || 0) + 1; 
        return acc; 
      }, {} as Record<string, number>),
      propertiesByType: availableProps.reduce((acc, p) => { 
        acc[p.type] = (acc[p.type] || 0) + 1; 
        return acc; 
      }, {} as Record<string, number>),
      propertiesByFloor: availableProps.reduce((acc, p) => { 
        const floorLabel = `Όροφος ${p.floor}`; 
        acc[floorLabel] = (acc[floorLabel] || 0) + 1; 
        return acc; 
      }, {} as Record<string, number>),
      totalStorageUnits: availableProps.filter(p => p.type === 'Αποθήκη').length,
      availableStorageUnits: availableProps.filter(p => p.type === 'Αποθήκη' && (p.status === 'for-sale' || p.status === 'for-rent')).length,
      soldStorageUnits: 0, // Δεν εμφανίζουμε sold
      uniqueBuildings: [...new Set(availableProps.map(p => p.building))].length,
      reserved: availableProps.filter(p => p.status === 'reserved').length,
    };
  }, [publicProperties]);

  // Find selected unit
  const selectedUnit = useMemo(() => {
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
    selectedUnit,
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