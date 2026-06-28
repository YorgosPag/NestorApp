/**
 * dxf-overlay-sync-guard.ts — pure idempotency key for the 3D DXF underlay (ADR-040 / ADR-537).
 *
 * THE PROBLEM (Chrome trace 2026-06-28): `DxfToThreeConverter.sync()` did a FULL
 * `disposeRoot()` + rebuild on EVERY call — recreating every line `BufferGeometry`
 * AND every text `CanvasTexture`. Each rebuild re-uploads the whole texture set to
 * the GPU (`texSubImage2D`, ~3.4s self-time in the trace). The converter is fed the
 * `dxfScene` via `useDxfOverlay3DSync` → store → `resyncDxfOverlay`, and `dxfScene`
 * is re-derived (a NEW wrapper object) whenever the underlying `SceneModel` changes
 * for ANY reason — e.g. a BIM column moves (which the DXF underlay does NOT draw),
 * or `applyBeamColumnCutback2D` churns beam refs. So the overlay was torn down and
 * re-uploaded even when not a single DXF line/text glyph had changed.
 *
 * THE FIX (Google-level idempotency, CLAUDE.md N.7.2 #3): compute a cheap key from
 * ONLY the inputs `buildColorGroup` actually consumes, and skip the rebuild when the
 * key is unchanged since the last sync. `buildColorGroup` is a pure function of
 * (drawn entities, layersById, units) — so an identical key ⇒ byte-identical output
 * ⇒ provably safe to keep the existing GPU resources.
 *
 * Only the entity types the overlay DRAWS participate in the key (mirror of
 * `appendEntitySegments` + the text pass): `line` / `circle` / `arc` / `polyline`
 * / `text`. BIM wrappers (wall / beam / column / slab / …) are rendered by
 * `BimSceneLayer` and SKIPPED here, so their reference churn must NOT invalidate the
 * underlay. Entity references are stable across re-conversions for unchanged source
 * entities (the `useDxfSceneConversion` WeakMap cache), so a shallow reference scan
 * is both precise and O(N)-cheap (zero GPU work) versus the full rebuild it guards.
 *
 * @module bim-3d/converters/dxf-overlay-sync-guard
 */

import type { DxfScene, DxfEntityUnion } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { SceneLayer } from '../../types/entities';

/**
 * Entity types the DXF underlay actually renders (mirror of `appendEntitySegments`
 * + the text pass in `DxfToThreeConverter.buildColorGroup`). Anything else (BIM
 * wrappers, dimensions, xline/ray, …) is skipped by the converter, so it must not
 * affect the idempotency key.
 */
const DRAWN_TYPES: ReadonlySet<DxfEntityUnion['type']> = new Set([
  'line', 'circle', 'arc', 'polyline', 'text',
]);

/** Immutable snapshot of the only inputs `buildColorGroup` reads. */
export interface DxfOverlaySyncKey {
  /** Visible, drawable entities in scene order (BIM wrappers excluded). */
  readonly drawn: readonly DxfEntityUnion[];
  /** Layer table — drives ByLayer colour resolution. Compared by reference. */
  readonly layersById: Readonly<Record<string, SceneLayer>> | undefined;
  /** Drawing units — drives the metre scale. */
  readonly units: DxfScene['units'];
}

/** Shared key for the null / nothing-to-draw case (so two empty syncs match). */
const EMPTY_KEY: DxfOverlaySyncKey = { drawn: [], layersById: undefined, units: undefined };

/**
 * Build the idempotency key for one DXF overlay scene. `null` → the shared
 * {@link EMPTY_KEY} so consecutive empty syncs compare equal.
 */
export function toDxfOverlaySyncKey(scene: DxfScene | null): DxfOverlaySyncKey {
  if (!scene) return EMPTY_KEY;
  const drawn: DxfEntityUnion[] = [];
  for (const entity of scene.entities) {
    if (entity.visible && DRAWN_TYPES.has(entity.type)) drawn.push(entity);
  }
  return {
    drawn,
    layersById: scene.layersById as Readonly<Record<string, SceneLayer>> | undefined,
    units: scene.units,
  };
}

/**
 * True when two keys would produce byte-identical overlay geometry — i.e. the same
 * units, the same layer table reference, and the same drawn entities (by reference,
 * in order). Reference comparison is sound because unchanged source entities keep a
 * stable converted reference (WeakMap cache upstream).
 */
export function isSameDxfOverlaySync(a: DxfOverlaySyncKey | null, b: DxfOverlaySyncKey): boolean {
  if (a === b) return true;
  if (a === null) return false;
  if (a.units !== b.units || a.layersById !== b.layersById) return false;
  const da = a.drawn;
  const db = b.drawn;
  if (da.length !== db.length) return false;
  for (let i = 0; i < da.length; i++) {
    if (da[i] !== db[i]) return false;
  }
  return true;
}

/** One stacked floor's overlay key plus its datum-relative elevation (mm). */
export interface DxfOverlayFloorKey {
  readonly key: DxfOverlaySyncKey;
  readonly elev: number;
}

/**
 * True when two stacked («Όλοι οι όροφοι») overlay snapshots are equivalent — same
 * floor count, and each floor's elevation + overlay key unchanged, in order.
 */
export function isSameMultiKey(
  a: readonly DxfOverlayFloorKey[] | null,
  b: readonly DxfOverlayFloorKey[],
): boolean {
  if (a === b) return true;
  if (a === null || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].elev !== b[i].elev) return false;
    if (!isSameDxfOverlaySync(a[i].key, b[i].key)) return false;
  }
  return true;
}
