/**
 * 🏢 ENTERPRISE (2026-01-31): Circle Tangent to 3 Lines (AutoCAD TTT Command)
 *
 * Hook for managing the Circle TTT tool state and entity selection.
 * This tool requires entity picking mode (selecting lines) instead of point collection.
 *
 * Usage Flow:
 * 1. User activates 'circle-ttt' tool
 * 2. User clicks on 1st line → highlighted yellow
 * 3. User clicks on 2nd line → highlighted yellow
 * 4. User clicks on 3rd line → circle is calculated and created
 * 5. Reset and ready for next selection
 *
 * Algorithm: Incircle of triangle formed by 3 lines
 * Reference: geometry-utils.ts → circleTangentTo3Lines()
 */

import { useState, useCallback, useRef } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import type { AnySceneEntity, CircleEntity } from '../../types/scene';
import { isLineEntity, isPolylineEntity, generateEntityId } from '../../types/scene';
import { circleTangentTo3Lines } from '../../rendering/entities/shared/geometry-utils';
import { nearestPolylineSegment } from '../../rendering/entities/shared/geometry-rendering-utils';
import { EventBus } from '../../systems/events';
import { createModuleLogger } from '@/lib/telemetry';

// SSoT logger — gated by NEXT_PUBLIC_LOG_LEVEL (replaces raw console.* that always
// flooded the console regardless of level).
const logger = createModuleLogger('CircleTTT');

// ============================================================================
// TYPES
// ============================================================================

/** A selected line for TTT tool (can be a LINE entity or a segment of POLYLINE) */
export interface TTTSelectedLine {
  /** Original entity ID */
  entityId: string;
  /** Entity type */
  entityType: 'line' | 'polyline';
  /** Start point of the line/segment */
  start: Point2D;
  /** End point of the line/segment */
  end: Point2D;
  /** For polylines: which segment index was selected */
  segmentIndex?: number;
}

export interface CircleTTTState {
  /** Whether TTT tool is active */
  isActive: boolean;
  /** Currently selected lines (0-3) */
  selectedLines: TTTSelectedLine[];
  /** Current step: 0=waiting for 1st line, 1=waiting for 2nd, 2=waiting for 3rd */
  currentStep: number;
  /** Error message if any */
  error: string | null;
}

export interface CircleTTTResult {
  /** Current state */
  state: CircleTTTState;
  /** Activate TTT tool */
  activate: () => void;
  /** Deactivate TTT tool */
  deactivate: () => void;
  /** Handle entity click - returns true if entity was accepted */
  onEntityClick: (entity: AnySceneEntity, clickPoint?: Point2D) => boolean;
  /** Reset selection (start over) */
  reset: () => void;
  /** Get highlighted entity IDs for visual feedback */
  getHighlightedEntityIds: () => string[];
  /** Check if TTT is waiting for entity selection */
  isWaitingForSelection: boolean;
  /** Get status text for UI */
  getStatusText: () => string;
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

export function useCircleTTT(options: {
  /** Callback when circle is created */
  onCircleCreated?: (circle: CircleEntity) => void;
  /** Current level ID for entity creation */
  currentLevelId?: string;
} = {}): CircleTTTResult {

  const { onCircleCreated, currentLevelId = '0' } = options;

  // State
  const [state, setState] = useState<CircleTTTState>({
    isActive: false,
    selectedLines: [],
    currentStep: 0,
    error: null,
  });

  // Ref for immediate access (bypasses React batching)
  const stateRef = useRef(state);
  stateRef.current = state;

  // ============================================================================
  // ACTIVATION / DEACTIVATION
  // ============================================================================

  const activate = useCallback(() => {
    setState({
      isActive: true,
      selectedLines: [],
      currentStep: 0,
      error: null,
    });
    logger.debug('🎯Activated - waiting for 1st line');
  }, []);

  const deactivate = useCallback(() => {
    setState({
      isActive: false,
      selectedLines: [],
      currentStep: 0,
      error: null,
    });
    logger.debug('🎯Deactivated');
  }, []);

  const reset = useCallback(() => {
    setState(prev => ({
      ...prev,
      selectedLines: [],
      currentStep: 0,
      error: null,
    }));
    logger.debug('🎯Reset - waiting for 1st line');
  }, []);

  // ============================================================================
  // ENTITY CLICK HANDLER
  // ============================================================================

  const onEntityClick = useCallback((entity: AnySceneEntity, clickPoint?: Point2D): boolean => {
    const currentState = stateRef.current;

    if (!currentState.isActive) {
      return false;
    }

    // Only accept LINE or POLYLINE entities
    if (!isLineEntity(entity) && !isPolylineEntity(entity)) {
      setState(prev => ({ ...prev, error: 'Επιλέξτε γραμμή (LINE ή POLYLINE)' }));
      logger.warn('🎯Rejected entity - not a line:', entity.type);
      return false;
    }

    let selectedLine: TTTSelectedLine;

    if (isLineEntity(entity)) {
      // LINE entity - use start/end directly
      selectedLine = {
        entityId: entity.id,
        entityType: 'line',
        start: entity.start,
        end: entity.end,
      };
    } else if (isPolylineEntity(entity)) {
      // POLYLINE entity - find which segment was clicked
      if (!clickPoint) {
        // No click point provided - use first segment
        const vertices = entity.vertices;
        if (!vertices || vertices.length < 2) {
          setState(prev => ({ ...prev, error: 'Η polyline δεν έχει αρκετές κορυφές' }));
          return false;
        }
        selectedLine = {
          entityId: entity.id,
          entityType: 'polyline',
          start: vertices[0],
          end: vertices[1],
          segmentIndex: 0,
        };
      } else {
        const segment = nearestPolylineSegment(entity.vertices, entity.closed ?? false, clickPoint);
        if (!segment) {
          setState(prev => ({ ...prev, error: 'Δεν βρέθηκε τμήμα polyline' }));
          return false;
        }
        selectedLine = {
          entityId: entity.id,
          entityType: 'polyline',
          start: segment.start,
          end: segment.end,
          segmentIndex: segment.segmentIndex,
        };
      }
    } else {
      return false;
    }

    // Check if same entity/segment already selected
    const isDuplicate = currentState.selectedLines.some(
      line => line.entityId === selectedLine.entityId &&
              line.segmentIndex === selectedLine.segmentIndex
    );

    if (isDuplicate) {
      setState(prev => ({ ...prev, error: 'Αυτή η γραμμή είναι ήδη επιλεγμένη' }));
      return false;
    }

    // Add to selection
    const newSelectedLines = [...currentState.selectedLines, selectedLine];
    const newStep = newSelectedLines.length;

    logger.debug(`🎯Line ${newStep}/3 selected:`, selectedLine);

    // If we have 3 lines, calculate and create the circle
    if (newSelectedLines.length === 3) {
      const result = circleTangentTo3Lines(
        { start: newSelectedLines[0].start, end: newSelectedLines[0].end },
        { start: newSelectedLines[1].start, end: newSelectedLines[1].end },
        { start: newSelectedLines[2].start, end: newSelectedLines[2].end }
      );

      if (!result) {
        setState(prev => ({
          ...prev,
          selectedLines: [],
          currentStep: 0,
          error: 'Οι γραμμές δεν σχηματίζουν έγκυρο τρίγωνο (παράλληλες ή συγγραμμικές)',
        }));
        logger.warn('🎯Failed - lines do not form valid triangle');
        return false;
      }

      // Create circle entity
      const circleEntity: CircleEntity = {
        id: generateEntityId(),
        type: 'circle',
        center: result.center,
        radius: result.radius,
        visible: true,
        layerId: currentLevelId,
      };

      logger.debug('🎯Circle created:', circleEntity);

      // Notify via callback
      onCircleCreated?.(circleEntity);

      // Emit event for entity creation pipeline
      EventBus.emit('circle-ttt:completed', {
        circle: circleEntity as unknown as Record<string, unknown>,
        selectedLines: newSelectedLines.map(line => ({
          entityId: line.entityId,
          entityType: line.entityType,
          start: line.start,
          end: line.end,
          segmentIndex: line.segmentIndex,
        })),
      });

      // Reset for next selection
      setState({
        isActive: true,
        selectedLines: [],
        currentStep: 0,
        error: null,
      });

      return true;
    }

    // Update state with new selection
    setState(prev => ({
      ...prev,
      selectedLines: newSelectedLines,
      currentStep: newStep,
      error: null,
    }));

    return true;
  }, [onCircleCreated, currentLevelId]);

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  const getHighlightedEntityIds = useCallback((): string[] => {
    return stateRef.current.selectedLines.map(line => line.entityId);
  }, []);

  const getStatusText = useCallback((): string => {
    const currentState = stateRef.current;
    if (!currentState.isActive) return '';

    if (currentState.error) {
      return `⚠️ ${currentState.error}`;
    }

    switch (currentState.currentStep) {
      case 0: return 'Επιλέξτε 1η γραμμή (0/3)';
      case 1: return 'Επιλέξτε 2η γραμμή (1/3)';
      case 2: return 'Επιλέξτε 3η γραμμή (2/3)';
      default: return '';
    }
  }, []);

  // ============================================================================
  // RETURN
  // ============================================================================

  return {
    state,
    activate,
    deactivate,
    onEntityClick,
    reset,
    getHighlightedEntityIds,
    isWaitingForSelection: state.isActive && state.selectedLines.length < 3,
    getStatusText,
  };
}

