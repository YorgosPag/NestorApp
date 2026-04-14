
'use client';

import { useCallback, useMemo } from 'react';
import { usePropertyState } from './usePropertyState';
import { usePropertyEditor } from './usePropertyEditor';
import { usePropertyFilters } from './usePropertyFilters';
import { usePolygonHandlers } from './usePolygonHandlers';
import type { FilterState, PropertyStats } from '@/types/property-viewer';
import type { Property } from '@/types/property-viewer';
import { useGuardedPropertyMutation } from '@/hooks/useGuardedPropertyMutation';
import { useNotifications } from '@/providers/NotificationProvider';
import { useTranslation } from '@/i18n/hooks/useTranslation';

/**
 * 🚨 ENTERPRISE MIGRATION NOTICE
 *
 * This file contains hardcoded user preferences που have been replaced by:
 * EnterpriseUserPreferencesService για personalized, database-driven configuration.
 *
 * Legacy exports are maintained για backward compatibility.
 * For new code, use:
 *
 * ```typescript
 * import { userPreferencesService } from '@/services/user/EnterpriseUserPreferencesService';
 * const prefs = await userPreferencesService.getPropertyViewerPreferences(userId, tenantId);
 * ```
 *
 * @see src/services/user/EnterpriseUserPreferencesService.ts
 * @see scripts/migrate-user-preferences.js
 */

// ============================================================================
// 🏢 ENTERPRISE USER PREFERENCES
// ============================================================================

/**
 * ✅ User preferences are now loaded from Firebase/Database!
 *
 * Configuration υπάρχει στο: COLLECTIONS.USER_PREFERENCES
 * Management μέσω: EnterpriseUserPreferencesService
 * Fallback: Built-in defaults για offline mode
 *
 * Features:
 * - User-specific preferences storage
 * - Company default preferences
 * - Cross-device preference sync
 * - Real-time preferences updates
 * - Performance-optimized caching
 * - Personalized user experiences
 *
 * Usage:
 * ```typescript
 * import { userPreferencesService } from '@/services/user/EnterpriseUserPreferencesService';
 *
 * // Load user preferences
 * const prefs = await userPreferencesService.getPropertyViewerPreferences(userId, tenantId);
 * const filters = prefs.defaultFilters;
 * const fallbackFloorId = prefs.fallbackFloorId;
 * ```
 */

/**
 * ⚠️ LEGACY FALLBACK: Default values για backward compatibility
 *
 * Αυτές οι τιμές χρησιμοποιούνται μόνο ως fallback όταν:
 * - Η Firebase δεν είναι διαθέσιμη
 * - Δεν υπάρχουν user preferences στη database
 * - Offline mode
 */
const FALLBACK_FLOOR_ID = process.env.NEXT_PUBLIC_DEFAULT_FLOOR_ID || 'floor-1' as const;

// 🏢 ADR-051: Use undefined for empty ranges (enterprise-grade type consistency)
export const DEFAULT_FILTERS: FilterState = {
  searchTerm: '',
  project: [],
  building: [],
  floor: [],
  propertyType: [],
  status: [],
  priceRange: { min: undefined, max: undefined },
  areaRange: { min: undefined, max: undefined },
  features: []
};

// 🎯 DOMAIN SEPARATION: Default stats without sales metrics
export const DEFAULT_STATS: PropertyStats = {
  totalProperties: 0, availableProperties: 0, totalValue: 0, totalArea: 0, averagePrice: 0,
  propertiesByStatus: {}, propertiesByType: {}, propertiesByFloor: {},
  totalStorageUnits: 0, availableStorageUnits: 0,
  uniqueBuildings: 0,
  // Optional operational status metrics
  underConstructionProperties: 0,
  maintenanceProperties: 0,
  inspectionProperties: 0,
  draftProperties: 0,
};


/**
 * 🏢 ENTERPRISE PROPERTY VIEWER HOOK
 *
 * Κεντρικό hook που συνδυάζει όλη τη λογική για τη διαχείριση του property viewer
 * με database-driven user preferences.
 *
 * Features:
 * - Database-driven user preferences loading
 * - Company default preferences fallback
 * - Real-time preference updates
 * - Cross-device preference sync
 * - Performance-optimized caching
 *
 * Components:
 * - `usePropertyState`: Διαχειρίζεται την κύρια κατάσταση των properties, ορόφων, επιλογών και ιστορικού
 * - `usePropertyEditor`: Διαχειρίζεται την κατάσταση των εργαλείων του editor και των UI modes
 * - `usePropertyFilters`: Διαχειρίζεται τη λογική του φιλτραρίσματος των properties
 * - `usePolygonHandlers`: Διαχειρίζεται τις ενέργειες πάνω στα polygons (δημιουργία, ενημέρωση, διαγραφή)
 *
 * @enterprise-ready true
 */
export function usePropertyViewer() {
  const { t } = useTranslation('properties');
  const { success, error: notifyError } = useNotifications();

  // 1. Core State Management (properties, selection, history)
  const {
    properties,
    setProperties,
    floors,
    isLoading,
    selectedPropertyIds,
    setSelectedProperties,
    hoveredPropertyId,
    onHoverProperty,
    selectedFloorId,
    onSelectFloor,
    undo,
    redo,
    canUndo,
    canRedo,
    forceDataRefresh,
  } = usePropertyState();

  // 2. Editor Tools & UI State Management
  const {
    activeTool, setActiveTool,
    showGrid, setShowGrid,
    snapToGrid, setSnapToGrid,
    gridSize, setGridSize,
    showMeasurements, setShowMeasurements,
    scale, setScale,
    showHistoryPanel, setShowHistoryPanel,
    suggestionToDisplay, setSuggestionToDisplay,
    connections, setConnections,
    groups, setGroups,
    isConnecting, setIsConnecting,
    firstConnectionPoint, setFirstConnectionPoint,
    viewMode, setViewMode,
    showDashboard, setShowDashboard,
    filters, setFilters,
  } = usePropertyEditor();

  // 3. Filtering Logic
  const { filteredProperties, stats } = usePropertyFilters(properties, filters);

  // 4. Polygon Action Handlers
  const {
    handlePolygonCreated,
    handlePolygonUpdated,
    handleDuplicate,
    handleDelete,
    handlePolygonSelect,
    PropertyDeletionDialogs,
  } = usePolygonHandlers({
    properties,
    floors,
    setProperties,
    setSelectedProperties,
    selectedFloorId: selectedFloorId || process.env.NEXT_PUBLIC_DEFAULT_FLOOR_ID || 'floor-1',
    isConnecting,
    firstConnectionPoint,
    setIsConnecting,
    setFirstConnectionPoint,
    forceDataRefresh,
  });

  const selectedProperty = useMemo(
    () => (selectedPropertyIds.length === 1
      ? properties.find((property) => property.id === selectedPropertyIds[0]) ?? null
      : null),
    [properties, selectedPropertyIds],
  );
  const {
    checking: checkingPropertyMutation,
    runExistingPropertyUpdate,
    ImpactDialog: PropertyMutationImpactDialog,
  } = useGuardedPropertyMutation(selectedProperty);

  const handleGuardedUpdateProperty = useCallback(async (propertyId: string, updates: Partial<Property>) => {
    const currentProperty = properties.find((property) => property.id === propertyId);
    if (!currentProperty) {
      throw new Error(`Property ${propertyId} not found.`);
    }

    if (!selectedProperty || selectedProperty.id !== propertyId) {
      notifyError(t('viewer.messages.selectSinglePropertyToEdit'));
      return;
    }

    const completed = await runExistingPropertyUpdate(currentProperty, updates, async () => {
      const description = `Updated details for property ${propertyId}`;
      setProperties(
        properties.map((property) => (property.id === propertyId ? { ...property, ...updates } : property)),
        description,
      );
      success(t('viewer.messages.updateSuccess'));
    });

    if (!completed) {
      return;
    }
  }, [notifyError, properties, runExistingPropertyUpdate, selectedProperty, setProperties, success, t]);

  // Εξασφαλίζουμε ότι οι τιμές που επιστρέφονται είναι πάντα προβλέψιμες και δεν είναι ποτέ null/undefined.
  return {
    // from usePropertyState
    properties: properties || [],
    setProperties,
    floors: floors || [],
    isLoading,
    selectedPropertyIds: selectedPropertyIds || [],
    hoveredPropertyId: hoveredPropertyId || null,
    selectedFloorId: selectedFloorId || null,
    setSelectedProperties,
    onHoverProperty,
    onSelectFloor,
    undo,
    redo,
    canUndo,
    canRedo,
    forceDataRefresh,

    // from usePropertyEditor
    activeTool,
    setActiveTool,
    showGrid,
    setShowGrid,
    snapToGrid,
    setSnapToGrid,
    gridSize,
    setGridSize,
    showMeasurements,
    setShowMeasurements,
    scale,
    setScale,
    showHistoryPanel,
    setShowHistoryPanel,
    suggestionToDisplay,
    setSuggestionToDisplay,
    connections,
    setConnections,
    groups,
    setGroups,
    isConnecting,
    setIsConnecting,
    firstConnectionPoint,
    setFirstConnectionPoint,
    viewMode,
    setViewMode,
    showDashboard,
    setShowDashboard,
    filters: filters || DEFAULT_FILTERS,
    setFilters,

    // from usePropertyFilters
    filteredProperties: filteredProperties || [],
    stats: stats || DEFAULT_STATS,

    // from usePolygonHandlers
    handlePolygonCreated,
    handlePolygonUpdated,
    handleDuplicate,
    handleDelete,
    handlePolygonSelect,
    handleUpdateProperty: handleGuardedUpdateProperty,
    checkingPropertyMutation,
    PropertyMutationImpactDialog,
    PropertyDeletionDialogs,
  };
}


