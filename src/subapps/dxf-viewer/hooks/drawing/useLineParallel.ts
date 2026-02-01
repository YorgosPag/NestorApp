/**
 * 🏢 ENTERPRISE (2026-01-31): Line Parallel Tool (Offset) - ADR-060
 *
 * Hook for managing the Parallel Line (Offset) tool state and entity selection.
 * This tool requires entity picking mode (selecting a reference line) instead of point collection.
 *
 * Usage Flow:
 * 1. User activates 'line-parallel' tool
 * 2. User clicks on reference line → highlighted yellow
 * 3. User clicks a point → parallel line is created at that offset distance
 * 4. Reset and ready for next selection
 *
 * Algorithm: Create line parallel to reference at the clicked point's offset distance
 * Reference: geometry-utils.ts → createParallelLine()
 */

import { useState, useCallback, useRef } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import type { LineEntity, PolylineEntity, AnySceneEntity } from '../../types/scene';
import { isLineEntity, isPolylineEntity, generateEntityId } from '../../types/scene';
// 🏢 ADR-XXX: Centralized geometry utils - pointToLineDistance replaces local pointToLineDistance
import { createParallelLine, pointToLineDistance } from '../../rendering/entities/shared/geometry-utils';
import { EventBus } from '../../systems/events';
import { UI_COLORS } from '../../config/color-config';

// ============================================================================
// TYPES
// ============================================================================

/** A selected line for Parallel tool (LINE or POLYLINE segment) */
export interface ParallelSelectedLine {
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

export interface LineParallelState {
  /** Whether tool is active */
  isActive: boolean;
  /** Reference line (if selected) */
  referenceEntity: ParallelSelectedLine | null;
  /** Current step: 0=waiting for reference, 1=waiting for offset point */
  currentStep: 0 | 1;
  /** Error message if any */
  error: string | null;
}

export interface LineParallelResult {
  /** Current state */
  state: LineParallelState;
  /** Activate tool */
  activate: () => void;
  /** Deactivate tool */
  deactivate: () => void;
  /** Handle entity click - returns true if entity was accepted */
  onEntityClick: (entity: AnySceneEntity, clickPoint?: Point2D) => boolean;
  /** Handle canvas click (for offset point) - returns true if line was created */
  onCanvasClick: (point: Point2D) => boolean;
  /** Reset selection (start over) */
  reset: () => void;
  /** Get highlighted entity IDs for visual feedback */
  getHighlightedEntityIds: () => string[];
  /** Check if tool is waiting for entity selection */
  isWaitingForEntitySelection: boolean;
  /** Check if tool is waiting for offset point */
  isWaitingForPoint: boolean;
  /** Get status text for UI */
  getStatusText: () => string;
  // 🏢 ENTERPRISE (2026-01-31): Top-level accessors for CanvasSection integration
  /** Whether tool is currently active */
  isActive: boolean;
  /** Current step: 0=waiting for reference, 1=waiting for offset-point */
  currentStep: 0 | 1;
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

export function useLineParallel(options: {
  /** Callback when line is created */
  onLineCreated?: (line: LineEntity) => void;
  /** Current level ID for entity creation */
  currentLevelId?: string;
} = {}): LineParallelResult {

  const { onLineCreated, currentLevelId = '0' } = options;

  // State
  const [state, setState] = useState<LineParallelState>({
    isActive: false,
    referenceEntity: null,
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
      referenceEntity: null,
      currentStep: 0,
      error: null,
    });
    console.log('⫽ [LineParallel] Activated - waiting for reference line');
  }, []);

  const deactivate = useCallback(() => {
    setState({
      isActive: false,
      referenceEntity: null,
      currentStep: 0,
      error: null,
    });
    console.log('⫽ [LineParallel] Deactivated');
  }, []);

  const reset = useCallback(() => {
    setState(prev => ({
      ...prev,
      referenceEntity: null,
      currentStep: 0,
      error: null,
    }));
    console.log('⫽ [LineParallel] Reset - waiting for reference line');
  }, []);

  // ============================================================================
  // POLYLINE SEGMENT DETECTION
  // ============================================================================

  const findPolylineSegment = useCallback((
    polyline: PolylineEntity,
    clickPoint: Point2D
  ): { start: Point2D; end: Point2D; segmentIndex: number } | null => {
    const vertices = polyline.vertices;
    if (!vertices || vertices.length < 2) return null;

    let closestSegment: { start: Point2D; end: Point2D; segmentIndex: number } | null = null;
    let minDistance = Infinity;

    for (let i = 0; i < vertices.length - 1; i++) {
      const start = vertices[i];
      const end = vertices[i + 1];
      const dist = pointToLineDistance(clickPoint, start, end);
      if (dist < minDistance) {
        minDistance = dist;
        closestSegment = { start, end, segmentIndex: i };
      }
    }

    if (polyline.closed && vertices.length > 2) {
      const start = vertices[vertices.length - 1];
      const end = vertices[0];
      const dist = pointToLineDistance(clickPoint, start, end);
      if (dist < minDistance) {
        closestSegment = { start, end, segmentIndex: vertices.length - 1 };
      }
    }

    return closestSegment;
  }, []);

  // ============================================================================
  // ENTITY CLICK HANDLER (Step 1: Select reference line)
  // ============================================================================

  const onEntityClick = useCallback((entity: AnySceneEntity, clickPoint?: Point2D): boolean => {
    const currentState = stateRef.current;

    if (!currentState.isActive || currentState.currentStep !== 0) {
      return false;
    }

    // Only accept LINE or POLYLINE entities
    if (!isLineEntity(entity) && !isPolylineEntity(entity)) {
      setState(prev => ({ ...prev, error: 'Επιλέξτε γραμμή (LINE ή POLYLINE)' }));
      console.warn('⫽ [LineParallel] Rejected entity - not a line:', entity.type);
      return false;
    }

    let selectedLine: ParallelSelectedLine;

    if (isLineEntity(entity)) {
      selectedLine = {
        entityId: entity.id,
        entityType: 'line',
        start: entity.start,
        end: entity.end,
      };
    } else if (isPolylineEntity(entity)) {
      if (!clickPoint) {
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
        const segment = findPolylineSegment(entity, clickPoint);
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

    console.log('⫽ [LineParallel] Reference line selected:', selectedLine);

    setState(prev => ({
      ...prev,
      referenceEntity: selectedLine,
      currentStep: 1,
      error: null,
    }));

    return true;
  }, [findPolylineSegment]);

  // ============================================================================
  // CANVAS CLICK HANDLER (Step 2: Select offset point)
  // ============================================================================

  const onCanvasClick = useCallback((point: Point2D): boolean => {
    const currentState = stateRef.current;

    if (!currentState.isActive || currentState.currentStep !== 1 || !currentState.referenceEntity) {
      return false;
    }

    const ref = currentState.referenceEntity;

    // Create parallel line at the offset distance indicated by the click point
    const result = createParallelLine(
      ref.start,
      ref.end,
      point
    );

    if (!result) {
      setState(prev => ({
        ...prev,
        error: 'Δεν ήταν δυνατή η δημιουργία παράλληλης γραμμής',
      }));
      return false;
    }

    // Create line entity
    const lineEntity: LineEntity = {
      id: generateEntityId(),
      type: 'line',
      start: result.start,
      end: result.end,
      visible: true,
      layer: currentLevelId,
      color: UI_COLORS.BRIGHT_GREEN, // 🏢 ENTERPRISE: Consistent green color for new entities
    };

    console.log('⫽ [LineParallel] Line created:', lineEntity);

    // Notify via callback
    onLineCreated?.(lineEntity);

    // Emit event for entity creation pipeline
    EventBus.emit('line-parallel:completed', {
      line: lineEntity as unknown as Record<string, unknown>,
      referenceEntity: {
        entityId: ref.entityId,
        entityType: ref.entityType,
        start: ref.start,
        end: ref.end,
        segmentIndex: ref.segmentIndex,
      },
      offsetPoint: point,
    });

    // Reset for next selection
    setState({
      isActive: true,
      referenceEntity: null,
      currentStep: 0,
      error: null,
    });

    return true;
  }, [onLineCreated, currentLevelId]);

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  const getHighlightedEntityIds = useCallback((): string[] => {
    const ref = stateRef.current.referenceEntity;
    return ref ? [ref.entityId] : [];
  }, []);

  const getStatusText = useCallback((): string => {
    const currentState = stateRef.current;
    if (!currentState.isActive) return '';

    if (currentState.error) {
      return `⚠️ ${currentState.error}`;
    }

    switch (currentState.currentStep) {
      case 0: return 'Επιλέξτε γραμμή αναφοράς';
      case 1: return 'Κλικ για απόσταση παράλληλης';
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
    onCanvasClick,
    reset,
    getHighlightedEntityIds,
    isWaitingForEntitySelection: state.isActive && state.currentStep === 0,
    isWaitingForPoint: state.isActive && state.currentStep === 1,
    getStatusText,
    // 🏢 ENTERPRISE (2026-01-31): Top-level accessors for CanvasSection integration
    isActive: state.isActive,
    currentStep: state.currentStep,
  };
}

