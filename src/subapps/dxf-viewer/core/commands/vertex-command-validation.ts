/**
 * @module core/commands/vertex-command-validation
 * @description Shared `validate()` prologues for vertex-edit commands.
 *
 * The entity-vertex commands (`Move`/`Remove`) and the overlay-vertex commands
 * (`Move`/`Delete`) each repeated the same target/index guard. Because the move
 * variants extend `DragVertexEditCommand` while the delete/remove variants extend
 * `BaseCommand` directly, a shared class base would need a diamond — so the guard
 * lives here as a free function each `validate()` delegates to (then layers its
 * own command-specific check on top).
 *
 * @see ./interfaces.ts (ICommand.validate)
 */

import type { Overlay } from '../../overlays/types';

/**
 * Guard for an entity-vertex command: entity id present + non-negative index.
 * Returns an i18n-agnostic error string, or `null` when the target is valid.
 */
export function validateEntityVertexTarget(entityId: string, vertexIndex: number): string | null {
  if (!entityId) {
    return 'Entity ID is required';
  }
  if (vertexIndex < 0) {
    return 'Vertex index must be non-negative';
  }
  return null;
}

/**
 * Guard for an overlay-vertex command: overlay id present + non-negative index +
 * the overlay exists in the store. Callers layer their own polygon-bounds /
 * min-vertex check after a `null` result.
 */
export function validateOverlayVertexTarget(
  overlayId: string,
  vertexIndex: number,
  overlays: Record<string, Overlay>,
): string | null {
  if (!overlayId) {
    return 'Overlay ID is required';
  }
  if (vertexIndex < 0) {
    return 'Vertex index must be non-negative';
  }
  if (!overlays[overlayId]) {
    return `Overlay ${overlayId} not found`;
  }
  return null;
}
