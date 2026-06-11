/**
 * @fileoverview Grip Interaction Detector — thin façade over the temperature SSoT
 * @description Detects grip temperature based on interaction state. The priority
 * logic is NOT implemented here — it lives in the single source of truth
 * `resolveGripTemperature` (grip-temperature.ts). This class remains only as the
 * object `UnifiedGripRenderer` instantiates; it forwards to the SSoT so there is
 * exactly ONE place that decides cold/warm/hot/snappable.
 * @author Enterprise Architecture Team
 * @date 2027-01-27
 * @version 2.0.0
 * @compliance CLAUDE.md Enterprise Standards — FULL SSoT (ADR-397)
 */

import type { GripTemperature, GripInteractionState } from './types';
import { resolveGripTemperature } from './grip-temperature';

// ============================================================================
// GRIP INTERACTION DETECTOR CLASS
// ============================================================================

/**
 * Grip Interaction Detector (façade).
 * Forwards to `resolveGripTemperature` — the SSoT. `GripInteractionState`
 * ({hovered, active, dragging}) is structurally a `GripTemperatureState`, so it
 * passes straight through.
 *
 * @example
 * ```typescript
 * const detector = new GripInteractionDetector();
 * detector.detectTemperature('line-1', 0, { hovered: { entityId: 'line-1', gripIndex: 0 } }); // 'warm'
 * ```
 */
export class GripInteractionDetector {
  /**
   * Detect grip temperature based on interaction state.
   *
   * @param entityId - Entity ID of the grip
   * @param gripIndex - Index of the grip within entity
   * @param interactionState - Optional current interaction state
   * @returns Grip temperature (cold/warm/hot/snappable)
   */
  detectTemperature(
    entityId: string,
    gripIndex: number,
    interactionState?: GripInteractionState
  ): GripTemperature {
    return resolveGripTemperature(entityId, gripIndex, interactionState);
  }
}
