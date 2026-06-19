/**
 * @fileoverview Grip Temperature — Single Source of Truth (SSoT)
 * @description The ONE place that maps `(entityId, gripIndex, interaction state)`
 * → grip temperature (cold / warm / hot). Pure, zero-dependency. Every renderer
 * (GripPhaseRenderer, GripInteractionDetector, …) consumes this — no renderer
 * re-implements the priority logic.
 *
 * Before this SSoT the same logic lived in 3 places with 2 different state-field
 * naming conventions (`dragginGrip`/`selectedGrip`/`hoveredGrip` vs
 * `dragging`/`active`/`hovered`). That duplication caused the "press → hot does
 * not stick" rotation-handle bug (ADR-397). Flagged 🔴 DUPLICATE in
 * `docs/systems/grip-rendering.md`.
 *
 * @author Enterprise Architecture Team
 * @date 2026-06-11
 * @compliance CLAUDE.md Enterprise Standards — NO any, FULL SSoT
 * @see ADR-397 §15 (grip glyph / temperature SSoT)
 */

import type { GripTemperature } from './types';

// ============================================================================
// CANONICAL STATE TYPE
// ============================================================================

/**
 * Canonical reference to a single grip (entity + index).
 * The minimal identity both naming conventions agree on.
 */
export interface GripRef {
  readonly entityId: string;
  readonly gripIndex: number;
}

/**
 * Canonical grip-interaction state for temperature resolution.
 *
 * Field names are the de-duplicated, typo-free canonical form:
 * - `hovered` — cursor is over the grip → warm
 * - `active`  — pressed / dragged / hot-grip-armed (the "hot" grip) → hot
 * - `dragging`— alias-of-`active` for back-compat; same priority as `active`
 *
 * Both legacy shapes map onto this:
 * - `rendering/grips/types.ts GripInteractionState` ({hovered, active, dragging})
 *   is structurally assignable as-is (its `dragging` carries extra position
 *   fields — a superset of {@link GripRef}).
 * - `systems/phase-manager/types.ts GripInteractionState`
 *   ({hoveredGrip, selectedGrip, dragginGrip}) is mapped by its consumer.
 */
export interface GripTemperatureState {
  readonly hovered?: GripRef;
  readonly active?: GripRef;
  readonly dragging?: GripRef;
  /**
   * ADR-370 — grips the user CLICKED to select for a multi-grip move, keyed by
   * {@link gripKey}. They render orange ('armed') and stay so until cleared,
   * regardless of hover. The grip under active drag still wins ('hot'). Empty /
   * absent → no grip is armed.
   */
  readonly armedKeys?: ReadonlySet<string>;
  /**
   * Grips that are currently active SNAP TARGETS (ADR-397) — keyed by
   * {@link gripKey}. During a rotation operation every visible grip of the
   * rotated entity is a snap reference, so it renders cyan ('snappable') instead
   * of its hover/cold colour. Empty / absent → no grip is snappable.
   */
  readonly snappableKeys?: ReadonlySet<string>;
}

/** Canonical key for a grip identity, shared by the snappable-set producers. */
export function gripKey(entityId: string, gripIndex: number): string {
  return `${entityId}_${gripIndex}`;
}

// ============================================================================
// SSoT RESOLVER
// ============================================================================

/** Does `ref` identify the grip `(entityId, gripIndex)`? */
function matches(ref: GripRef | undefined, entityId: string, gripIndex: number): boolean {
  return ref?.entityId === entityId && ref?.gripIndex === gripIndex;
}

/**
 * Resolve the temperature of a single grip from the interaction state.
 *
 * Priority (AutoCAD / BricsCAD / Revit-grade):
 * 1. `dragging` or `active` (the pressed / manipulated grip)  → `hot`
 * 2. grip is in `armedKeys` (clicked-to-select, ADR-370)      → `armed` (orange)
 * 3. grip is in `snappableKeys` (active snap target, ADR-397) → `snappable` (cyan)
 * 4. `hovered` (cursor over the grip)                         → `warm`
 * 5. otherwise                                                → `cold`
 *
 * `hot` wins over `armed` so the grip under active drag turns red even though it is
 * still in the armed set. `armed` wins over `hovered` so a selected grip stays orange
 * while the cursor passes over it.
 *
 * @param entityId - Entity owning the grip
 * @param gripIndex - Index of the grip within the entity
 * @param state - Optional interaction state; absent → always `cold`
 */
export function resolveGripTemperature(
  entityId: string,
  gripIndex: number,
  state?: GripTemperatureState
): GripTemperature {
  if (!state) return 'cold';

  // Priority 1: pressed / dragged grip → hot (dragging and active are equal rank)
  if (
    matches(state.dragging, entityId, gripIndex) ||
    matches(state.active, entityId, gripIndex)
  ) {
    return 'hot';
  }

  // Priority 2: clicked-to-select grip (ADR-370) → armed (orange). Above snappable
  // and hover so a selected grip stays orange through hover.
  if (state.armedKeys?.has(gripKey(entityId, gripIndex))) {
    return 'armed';
  }

  // Priority 3: active snap target during rotation → snappable (cyan)
  if (state.snappableKeys?.has(gripKey(entityId, gripIndex))) {
    return 'snappable';
  }

  // Priority 4: hovered grip → warm
  if (matches(state.hovered, entityId, gripIndex)) {
    return 'warm';
  }

  // Default: cold
  return 'cold';
}
