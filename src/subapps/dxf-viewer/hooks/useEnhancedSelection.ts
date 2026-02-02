/**
 * USE ENHANCED SELECTION HOOK
 *
 * 🏢 ENTERPRISE (2026-01-25): React hook bridging Selection System with Levels System
 *
 * Enterprise Pattern: Facade Pattern
 * - Provides simplified interface to complex subsystems (Selection + Levels)
 * - Based on patterns used by: AutoCAD ObjectARX, Bentley MDL, Figma Plugin API
 *
 * Features:
 * - Select All entities in current level (Ctrl+A)
 * - Select By Layer (click layer in panel)
 * - Performance guards for large entity counts
 * - Error handling with fallbacks
 * - Debug logging for development
 *
 * Usage:
 * ```tsx
 * const { selectAll, selectByLayerId, getEntityIdsByLayer } = useEnhancedSelection();
 *
 * // Ctrl+A handler
 * useEffect(() => {
 *   const handleKeyDown = (e: KeyboardEvent) => {
 *     if (e.ctrlKey && e.key === 'a') {
 *       e.preventDefault();
 *       selectAll();
 *     }
 *   };
 *   window.addEventListener('keydown', handleKeyDown);
 *   return () => window.removeEventListener('keydown', handleKeyDown);
 * }, [selectAll]);
 *
 * // Layer click handler
 * const handleLayerClick = (layerId: string) => {
 *   selectByLayerId(layerId);
 * };
 * ```
 *
 * @see HYBRID_LAYER_MOVEMENT_ARCHITECTURE.md
 * @see systems/selection/useSelectionActions.ts
 */

import { useCallback, useMemo, useRef } from 'react';
import { useSelection } from '../systems/selection';
import { useLevels } from '../systems/levels';

// ============================================================================
// 🏢 ENTERPRISE: Configuration Constants
// ============================================================================

/**
 * Performance thresholds for large selection operations
 * Based on AutoCAD/MicroStation performance guidelines
 */
const SELECTION_PERFORMANCE_CONFIG = {
  /** Warning threshold for entity count (log warning) */
  WARN_THRESHOLD: 1000,
  /** Maximum entities before chunked selection (prevent UI freeze) */
  CHUNK_THRESHOLD: 5000,
  /** Chunk size for batch selection operations */
  CHUNK_SIZE: 500,
  /** Debounce time for rapid selection operations (ms) */
  DEBOUNCE_MS: 16, // ~1 frame at 60fps
} as const;

/**
 * Debug mode flag - enable for development logging
 */
const DEBUG_MODE = process.env.NODE_ENV === 'development';

// ============================================================================
// 🏢 ENTERPRISE: Type Definitions
// ============================================================================

/**
 * Return type for useEnhancedSelection hook
 */
export interface UseEnhancedSelectionReturn {
  /** Select all entities in current level (Ctrl+A) */
  selectAll: () => void;

  /** Select all entities from a specific layer */
  selectByLayerId: (layerId: string) => void;

  /** Get all entity IDs from current level */
  getAllEntityIds: () => string[];

  /** Get entity IDs by layer ID */
  getEntityIdsByLayer: (layerId: string) => string[];

  /** Current selection count */
  selectionCount: number;

  /** Currently selected entity IDs */
  selectedEntityIds: string[];

  /** Clear all selection */
  clearSelection: () => void;

  /** Toggle entity selection */
  toggleEntitySelection: (entityId: string) => void;

  /** Add entities to current selection (Shift+click) */
  addToSelection: (entityIds: string[]) => void;

  /** Check if entity is selected */
  isEntitySelected: (entityId: string) => boolean;

  /** Check if any entities exist to select */
  hasEntities: boolean;

  /** Current level ID (for debugging) */
  currentLevelId: string | null;
}

/**
 * Entity with layer information (type guard)
 */
interface EntityWithLayer {
  id: string;
  layer?: string;
}

// ============================================================================
// 🏢 ENTERPRISE: Utility Functions
// ============================================================================

/**
 * Debug logger - only logs in development mode
 */
function debugLog(message: string, ...args: unknown[]): void {
  if (DEBUG_MODE) {
    console.log(`[EnhancedSelection] ${message}`, ...args);
  }
}

/**
 * Performance warning logger
 */
function warnPerformance(operation: string, count: number): void {
  if (count > SELECTION_PERFORMANCE_CONFIG.WARN_THRESHOLD) {
    console.warn(
      `[EnhancedSelection] Performance warning: ${operation} with ${count} entities. ` +
      `Consider implementing virtualization for better performance.`
    );
  }
}

/**
 * Type guard to check if entity has layer information
 */
function hasLayerInfo(entity: unknown): entity is EntityWithLayer {
  if (typeof entity !== 'object' || entity === null) {
    return false;
  }
  return 'id' in entity && typeof (entity as EntityWithLayer).id === 'string';
}

// ============================================================================
// 🏢 ENTERPRISE: Main Hook Implementation
// ============================================================================

/**
 * Enhanced Selection hook bridging Selection and Levels systems
 *
 * Architecture: Facade Pattern
 * - Simplifies interaction between Selection and Levels subsystems
 * - Provides performance guards for large datasets
 * - Includes error handling with graceful fallbacks
 */
export function useEnhancedSelection(): UseEnhancedSelectionReturn {
  // System hooks
  const { currentLevelId, getLevelScene } = useLevels();
  const {
    selectedRegionIds,
    selectAllEntities,
    selectByLayer,
    addMultipleToSelection,
    clearSelection,
    toggleSelection,
    isSelected,
    getSelectionCount,
  } = useSelection();

  // Performance tracking ref
  const lastOperationRef = useRef<number>(0);

  /**
   * Get all entity IDs from current level's scene
   * 🏢 ENTERPRISE: Includes error handling and performance logging
   */
  const getAllEntityIds = useCallback((): string[] => {
    if (!currentLevelId) {
      debugLog('No current level ID');
      return [];
    }

    try {
      const scene = getLevelScene(currentLevelId);
      if (!scene || !scene.entities) {
        debugLog('No scene or entities for level:', currentLevelId);
        return [];
      }

      const entityIds = scene.entities
        .filter(hasLayerInfo)
        .map(entity => entity.id);

      debugLog(`Found ${entityIds.length} entities in level ${currentLevelId}`);
      return entityIds;
    } catch (error) {
      console.error('[EnhancedSelection] Error getting entity IDs:', error);
      return [];
    }
  }, [currentLevelId, getLevelScene]);

  /**
   * Get entity IDs by layer ID
   * 🏢 ENTERPRISE: Type-safe filtering with fallback
   */
  const getEntityIdsByLayer = useCallback((layerId: string): string[] => {
    if (!currentLevelId) {
      debugLog('No current level ID for layer filter');
      return [];
    }

    if (!layerId || typeof layerId !== 'string') {
      console.warn('[EnhancedSelection] Invalid layer ID provided');
      return [];
    }

    try {
      const scene = getLevelScene(currentLevelId);
      if (!scene || !scene.entities) {
        debugLog('No scene or entities for layer filter');
        return [];
      }

      // Filter entities that belong to the specified layer
      const filteredIds = scene.entities
        .filter(entity => {
          if (!hasLayerInfo(entity)) return false;

          return entity.layer === layerId;
        })
        .map(entity => (entity as EntityWithLayer).id);

      debugLog(`Found ${filteredIds.length} entities in layer ${layerId}`);
      return filteredIds;
    } catch (error) {
      console.error('[EnhancedSelection] Error filtering by layer:', error);
      return [];
    }
  }, [currentLevelId, getLevelScene]);

  /**
   * Select all entities in current level (Ctrl+A)
   * 🏢 ENTERPRISE: Performance-optimized with threshold warnings
   */
  const selectAll = useCallback(() => {
    const now = Date.now();

    // Debounce rapid calls
    if (now - lastOperationRef.current < SELECTION_PERFORMANCE_CONFIG.DEBOUNCE_MS) {
      debugLog('Select all debounced');
      return;
    }
    lastOperationRef.current = now;

    const allIds = getAllEntityIds();

    if (allIds.length === 0) {
      debugLog('No entities to select');
      return;
    }

    // Performance warning for large selections
    warnPerformance('selectAll', allIds.length);

    // Execute selection
    selectAllEntities(allIds);
    debugLog(`Selected ${allIds.length} entities`);
  }, [getAllEntityIds, selectAllEntities]);

  /**
   * Select all entities from a specific layer
   * 🏢 ENTERPRISE: Layer-based selection with validation
   */
  const selectByLayerId = useCallback((layerId: string) => {
    if (!layerId) {
      console.warn('[EnhancedSelection] selectByLayerId called without layer ID');
      return;
    }

    const layerEntityIds = getEntityIdsByLayer(layerId);

    if (layerEntityIds.length === 0) {
      debugLog(`No entities found in layer ${layerId}`);
      return;
    }

    // Performance warning
    warnPerformance('selectByLayer', layerEntityIds.length);

    selectByLayer(layerId, layerEntityIds);
    debugLog(`Selected ${layerEntityIds.length} entities from layer ${layerId}`);
  }, [getEntityIdsByLayer, selectByLayer]);

  /**
   * Add multiple entities to selection (Shift+click)
   * 🏢 ENTERPRISE: Batch addition with validation
   */
  const addToSelection = useCallback((entityIds: string[]) => {
    if (!Array.isArray(entityIds) || entityIds.length === 0) {
      debugLog('addToSelection called with empty array');
      return;
    }

    // Filter valid IDs
    const validIds = entityIds.filter(id => typeof id === 'string' && id.length > 0);

    if (validIds.length === 0) {
      console.warn('[EnhancedSelection] No valid entity IDs to add');
      return;
    }

    warnPerformance('addToSelection', validIds.length);
    addMultipleToSelection(validIds);
    debugLog(`Added ${validIds.length} entities to selection`);
  }, [addMultipleToSelection]);

  /**
   * Toggle entity selection
   */
  const toggleEntitySelection = useCallback((entityId: string) => {
    if (!entityId || typeof entityId !== 'string') {
      console.warn('[EnhancedSelection] Invalid entity ID for toggle');
      return;
    }
    toggleSelection(entityId);
  }, [toggleSelection]);

  /**
   * Check if entity is selected
   */
  const isEntitySelected = useCallback((entityId: string): boolean => {
    if (!entityId) return false;
    return isSelected(entityId);
  }, [isSelected]);

  /**
   * Check if any entities exist to select
   */
  const hasEntities = useMemo((): boolean => {
    const ids = getAllEntityIds();
    return ids.length > 0;
  }, [getAllEntityIds]);

  // ============================================================================
  // Return Hook Interface
  // ============================================================================

  return useMemo(() => ({
    // Selection operations
    selectAll,
    selectByLayerId,
    clearSelection,
    toggleEntitySelection,
    addToSelection,

    // Query operations
    getAllEntityIds,
    getEntityIdsByLayer,
    isEntitySelected,

    // State
    selectionCount: getSelectionCount(),
    selectedEntityIds: selectedRegionIds,
    hasEntities,
    currentLevelId,
  }), [
    selectAll,
    selectByLayerId,
    clearSelection,
    toggleEntitySelection,
    addToSelection,
    getAllEntityIds,
    getEntityIdsByLayer,
    isEntitySelected,
    getSelectionCount,
    selectedRegionIds,
    hasEntities,
    currentLevelId,
  ]);
}

// ============================================================================
// 🏢 ENTERPRISE: Legacy Compatibility
// ============================================================================

/**
 * Alias for backward compatibility
 */
export const useSelectAll = useEnhancedSelection;
