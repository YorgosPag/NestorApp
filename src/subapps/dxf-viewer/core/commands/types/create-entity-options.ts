/**
 * COMMAND OPTIONS — entity creation
 *
 * Extracted from `core/commands/interfaces.ts` (ADR-031) to keep that file
 * under the Google file-size limit while staying inside the types/ tier
 * exempted from line-count enforcement. See ADR-057 for the `existingId`
 * usage contract.
 */

import type { LineweightMm } from '../../../types/entities';

export interface CreateEntityOptions {
  /**
   * @deprecated ADR-358 Phase 9D — Layer NAME. Transitional dual-write alongside `layerId`.
   * Phase 9D-5b removes this field; new callers MUST prefer `layerId` (stable `lyr_<UUID-v4>`).
   */
  layer?: string;
  /**
   * Stable layer identifier — `lyr_<UUID-v4>` matching `SceneLayer.id` (ADR-358 Phase 9C v2.13).
   * Resolved at execute() time via `LayerStore.getLayer(id)?.name` for the legacy `layer` write
   * until Phase 9D-5b drops the dual-write.
   */
  layerId?: string;
  color?: string;
  lineweight?: number;
  opacity?: number;
  /**
   * ADR-358 §G7 Phase 6.5 — sentinel-aware entity creation. When
   * `colorMode === 'ByLayer'` (or 'ByBlock'), `CreateEntityCommand` forwards
   * the sentinel to the entity and SKIPS the concrete `color` flatten so the
   * renderer's `resolveStyleForRender()` cascades through `layersById`.
   */
  colorMode?: 'ByLayer' | 'ByBlock' | 'Concrete';
  /** ACI 1-255 — DXF group 62 (Phase 6.5 sentinel forward). */
  colorAci?: number;
  /** TrueColor 0xRRGGBB — DXF group 420 (Phase 6.5 sentinel forward). */
  colorTrueColor?: number | null;
  /** Linetype DXF name — 'ByLayer'/'ByBlock' opt into inheritance (Phase 6.5). */
  linetypeName?: string;
  /** Lineweight mm — accepts -3/-2/-1 sentinels (Phase 6.5). */
  lineweightMm?: LineweightMm;
  /** Transparency 0-90 — DXF group 1071 (Phase 6.5 sentinel forward). */
  transparency?: number;
  /**
   * Preserve a pre-existing entity ID instead of generating a new one.
   * Used by `completeEntity()` (ADR-057) so the entity id assigned at
   * tool-completion time survives through the command into the scene —
   * keeping grip selection, AI tools, and overlay persistence consistent.
   */
  existingId?: string;
}
