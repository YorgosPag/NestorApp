/**
 * @fileoverview Grip Interaction Detector - Temperature State Detection
 * @description Detects grip temperature based on interaction state
 * @author Enterprise Architecture Team
 * @date 2027-01-27
 * @version 1.0.0
 * @compliance CLAUDE.md Enterprise Standards
 */

import type { GripTemperature, GripInteractionState } from './types';

// ============================================================================
// GRIP INTERACTION DETECTOR CLASS
// ============================================================================

/**
 * Enterprise Grip Interaction Detector
 * Detects grip temperature (cold/warm/hot) based on interaction state
 *
 * Temperature detection priority:
 * 1. Dragging → hot (highest priority)
 * 2. Active/selected → hot
 * 3. Hovered → warm
 * 4. None → cold (default)
 *
 * @example
 * ```typescript
 * const detector = new GripInteractionDetector();
 * const state: GripInteractionState = {
 *   hovered: { entityId: 'line-1', gripIndex: 0 }
 * };
 *
 * // Hovered grip
 * detector.detectTemperature('line-1', 0, state); // 'warm'
 *
 * // Non-hovered grip
 * detector.detectTemperature('line-1', 1, state); // 'cold'
 * ```
 */
export class GripInteractionDetector {
  /**
   * Detect grip temperature based on interaction state
   *
   * @param entityId - Entity ID of the grip
   * @param gripIndex - Index of the grip within entity
   * @param interactionState - Optional current interaction state
   * @returns Grip temperature (cold/warm/hot)
   */
  detectTemperature(
    entityId: string,
    gripIndex: number,
    interactionState?: GripInteractionState
  ): GripTemperature {
    // No interaction state → cold
    if (!interactionState) {
      return 'cold';
    }

    // Priority 1: Dragging (highest priority) → hot
    if (this.isDragging(entityId, gripIndex, interactionState)) {
      return 'hot';
    }

    // Priority 2: Active/selected → hot
    if (this.isActive(entityId, gripIndex, interactionState)) {
      return 'hot';
    }

    // Priority 3: Hovered → warm
    if (this.isHovered(entityId, gripIndex, interactionState)) {
      return 'warm';
    }

    // Default: cold
    return 'cold';
  }

  /**
   * Check if grip is hovered
   */
  private isHovered(
    entityId: string,
    gripIndex: number,
    state: GripInteractionState
  ): boolean {
    return (
      state.hovered?.entityId === entityId &&
      state.hovered?.gripIndex === gripIndex
    );
  }

  /**
   * Check if grip is active/selected
   */
  private isActive(
    entityId: string,
    gripIndex: number,
    state: GripInteractionState
  ): boolean {
    return (
      state.active?.entityId === entityId &&
      state.active?.gripIndex === gripIndex
    );
  }

  /**
   * Check if grip is being dragged
   */
  private isDragging(
    entityId: string,
    gripIndex: number,
    state: GripInteractionState
  ): boolean {
    return (
      state.dragging?.entityId === entityId &&
      state.dragging?.gripIndex === gripIndex
    );
  }
}
