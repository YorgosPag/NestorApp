'use client';

/**
 * ADR-618 — createPlacementGhostClass SSoT factory.
 *
 * The 7 point-placement ghosts (column / electrical-panel / mep-fixture /
 * mep-boiler / mep-radiator / mep-water-heater / mep-manifold) repeated the SAME
 * scene-management body verbatim, differing ΜΟΝΟ σε: the ghost tint + layer id,
 * the `*ToolBridgeStore`, and the three SSoT calls that turn a cursor point into a
 * mesh (`buildDefault*Params` → `compute*Geometry` → `build*Entity` → `*ToMesh`).
 * This factory is that single source — one class that owns the whole lifecycle
 * (build-on-update, id-stable rebuild, replace-not-accumulate, non-pickable via the
 * shared `PlacementGhostOverlay` SSoT, ADR-537), delegating ONLY the parametric
 * pieces to the config. Sibling of the `createBim3DPointPlacementHook` factory
 * (ADR-605) that de-duplicated the placement *hooks*.
 *
 * Each concrete ghost file becomes a one-expression `createPlacementGhostClass({…})`
 * whose config values reference the entity's own SSoT builders — so the preview is
 * exactly what the click creates (WYSIWYG) and no scene-plumbing is duplicated.
 *
 * Pure Three.js leaf: no React, no store subscription (the placement hook drives it).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-618-bim3d-placement-ssot.md
 * @see ./placement-ghost-overlay.ts — the material/scene/registration/disposal SSoT (ADR-537)
 * @see ./create-bim3d-point-placement-hook.ts — the sibling hook factory (ADR-605)
 */

import type * as THREE from 'three';
import type { Point2D } from '../../rendering/types/Types';
import type { SceneUnits } from '../../utils/scene-units';
import { PlacementGhostOverlay } from './placement-ghost-overlay';

/** Default ghost opacity (matches every migrated ghost's explicit `0.45`). */
const DEFAULT_GHOST_OPACITY = 0.45;

/**
 * The minimal shape a placement ghost's entity must expose so the factory can do the
 * id-stable rebuild (`{ ...prev, params, geometry }`) without knowing the concrete type.
 */
export interface PlacementGhostEntity<TParams> {
  readonly params: TParams;
  readonly geometry: unknown;
}

/** The minimal shape the factory needs from a `*-tool-bridge-store` handle. */
export interface PlacementGhostBridgeHandle {
  getSceneUnits(): SceneUnits;
}

/**
 * The discriminated result every `build*Entity` SSoT returns — validation may fail
 * (bad params → no ghost this frame). Structurally satisfied by the richer concrete
 * results (which carry an `error` on the failure branch), so config passes them raw.
 */
export type PlacementGhostBuildResult<TEntity> =
  | { readonly ok: true; readonly entity: TEntity }
  | { readonly ok: false };

/**
 * The public contract of a placement ghost — the API every `use-bim3d-*-placement`
 * hook drives, unchanged from the hand-written classes.
 */
export interface PlacementGhost {
  /** Rebuild the ghost at `scenePoint` (active scene units) on the active floor. */
  update(scenePoint: Readonly<Point2D>, floorElevationMm: number, levelId: string | undefined): void;
  setVisible(visible: boolean): void;
  dispose(): void;
}

export interface PlacementGhostConfig<
  TEntity extends PlacementGhostEntity<TParams>,
  TParams,
  THandle extends PlacementGhostBridgeHandle,
> {
  /** Base translucent tint (may be overridden per-frame by {@link resolveColor}). */
  readonly color: THREE.ColorRepresentation;
  /** Ghost opacity (default `0.45`). */
  readonly opacity?: number;
  /** Layer id stamped on the throwaway ghost entity (never persisted). */
  readonly layerId: string;
  /** The tool bridge store published by the 2D tool hook. */
  readonly bridgeStore: { get(): THandle | null };
  /** Build the default params for `scenePoint` from the (possibly null) bridge handle. */
  buildParams(scenePoint: Readonly<Point2D>, handle: THandle | null, units: SceneUnits): TParams;
  /** Derive the entity geometry from its params. */
  computeGeometry(params: TParams): TEntity['geometry'];
  /** Validate + assign an enterprise id on the FIRST build (its raw `{ ok, entity }` result). */
  buildEntity(params: TParams, layerId: string, units: SceneUnits): PlacementGhostBuildResult<TEntity>;
  /** Convert the ghost entity to a scene object (`null` → hide this frame). */
  toMesh(entity: TEntity, floorElevationMm: number, levelId: string | undefined): THREE.Object3D | null;
  /** Optional per-frame recolour (e.g. MEP water/drainage classification palette). */
  resolveColor?(entity: TEntity): THREE.ColorRepresentation | undefined;
}

/**
 * Build a placement-ghost class for a point-placed BIM entity. The returned class is
 * the parametric SSoT for all 7 `*PlacementGhost.ts` cells: `new Ghost(scene)` then
 * `update` / `setVisible` / `dispose` — same public API as the hand-written classes.
 */
export function createPlacementGhostClass<
  TEntity extends PlacementGhostEntity<TParams>,
  TParams,
  THandle extends PlacementGhostBridgeHandle,
>(config: PlacementGhostConfig<TEntity, TParams, THandle>): new (scene: THREE.Scene) => PlacementGhost {
  return class GeneratedPlacementGhost implements PlacementGhost {
    private readonly overlay: PlacementGhostOverlay;
    /** Retained so its enterprise id/IFC fields stay stable across cursor moves. */
    private entity: TEntity | null = null;

    constructor(scene: THREE.Scene) {
      this.overlay = new PlacementGhostOverlay(scene, config.color, config.opacity ?? DEFAULT_GHOST_OPACITY);
    }

    update(scenePoint: Readonly<Point2D>, floorElevationMm: number, levelId: string | undefined): void {
      if (this.overlay.isDisposed) return;
      const entity = this.buildGhostEntity(scenePoint);
      if (!entity) {
        this.overlay.setVisible(false);
        return;
      }
      this.entity = entity;
      const color = config.resolveColor?.(entity);
      if (color !== undefined) this.overlay.setColor(color);
      this.overlay.setObject(config.toMesh(entity, floorElevationMm, levelId));
    }

    setVisible(visible: boolean): void {
      this.overlay.setVisible(visible);
    }

    dispose(): void {
      this.overlay.dispose();
    }

    /**
     * Build the throwaway ghost entity from the bridge store's overrides. The first
     * call validates + assigns an id (one `build*Entity`); later calls reuse that id
     * and only swap params + geometry (no id churn).
     */
    private buildGhostEntity(scenePoint: Readonly<Point2D>): TEntity | null {
      const handle = config.bridgeStore.get();
      const units = handle?.getSceneUnits() ?? 'mm';
      const params = config.buildParams(scenePoint, handle, units);
      const geometry = config.computeGeometry(params);
      if (this.entity) return { ...this.entity, params, geometry } as TEntity;
      const result = config.buildEntity(params, config.layerId, units);
      return result.ok ? result.entity : null;
    }
  };
}
