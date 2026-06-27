'use client';

/**
 * BeamFromWallGhost — translucent 3D preview of the beam «Δοκάρι από τοίχο»
 * (ADR-363) is about to create on the hovered wall's axis.
 *
 * Scene-side leaf object (the BimGizmoOverlay / ColumnPlacementGhost pattern,
 * ADR-403): follows the hovered wall via `showForWall`, hidden when no wall is
 * under the cursor, removed on `dispose`. Pure Three.js — no React, no store
 * subscription (the hook drives it).
 *
 * The ghost mesh is built by the SAME SSoT the commit path uses
 * (`buildBeamFromWall` → `beamToMesh`) and reads overrides + scene units from
 * the SAME `beamToolBridgeStore` the 2D `useBeamTool` publishes — so the preview
 * is exactly the beam the click will create (WYSIWYG). Translucent material +
 * post-FX overlay + non-pickable + disposal live in the shared
 * `PlacementGhostOverlay` SSoT (ADR-537). `beamToMesh` builds a FRESH per-piece
 * material (multi-piece cutback Group, ADR-458), so the overlay swap disposes the
 * replaced materials (`disposePrevMaterials`) to avoid a leak.
 *
 * Unlike ColumnPlacementGhost (cursor-driven), this ghost depends only on the
 * hovered wall, so it is rebuilt only when the wall reference changes — after a
 * commit + resync the store hands a fresh WallEntity, so the stale preview
 * (built from the pre-shorten params) is correctly discarded.
 */

import * as THREE from 'three';
import type { WallEntity } from '../../bim/types/wall-types';
import { buildBeamFromWall } from '../../bim/beams/beam-from-wall';
import { beamToolBridgeStore } from '../../bim/beams/beam-tool-bridge-store';
import { beamToMesh } from '../converters/BimToThreeConverter';
import { useBim3DEntitiesStore } from '../stores/Bim3DEntitiesStore';
import { resolveActiveFloorElevationMm } from './raycast-floor-point';
import { PlacementGhostOverlay } from './placement-ghost-overlay';

/** Layer id stamped on the throwaway ghost beam (never persisted). */
const GHOST_LAYER_ID = '__ghost-beam__';
const MM_TO_M = 0.001;

export class BeamFromWallGhost {
  private readonly overlay: PlacementGhostOverlay;
  /** Wall the current ghost was built for — rebuild only when the ref changes. */
  private wall: WallEntity | null = null;

  constructor(scene: THREE.Scene) {
    this.overlay = new PlacementGhostOverlay(scene, 0x3b82f6, 0.45);
  }

  /** Build (or reuse) the ghost beam on `wall`'s axis and show it. */
  showForWall(wall: WallEntity): void {
    if (this.overlay.isDisposed) return;
    // Same wall object as last frame → keep the existing ghost shown (no churn).
    if (this.wall === wall) {
      this.overlay.setVisible(true);
      return;
    }
    const handle = beamToolBridgeStore.get();
    const units = handle?.getSceneUnits() ?? 'mm';
    const overrides = handle?.overrides ?? {};
    const levelId = useBim3DEntitiesStore.getState().activeLevelId ?? undefined;
    const result = buildBeamFromWall(wall, overrides, levelId ?? GHOST_LAYER_ID, units);
    if (!result.ok) {
      this.hide();
      return;
    }
    // Active-floor datum (m) — mirrors BimSceneLayer.syncBeams base elevation so
    // the ghost sits exactly where the committed beam will render.
    const baseElevationM = resolveActiveFloorElevationMm() * MM_TO_M;
    const mesh = beamToMesh(result.entity, levelId, baseElevationM);
    if (!mesh) {
      this.hide();
      return;
    }
    // The converter builds a fresh material per piece — dispose it on the override
    // so it doesn't leak (the shared ghost material is disposed once in dispose()).
    this.overlay.setObject(mesh, { disposePrevMaterials: true });
    this.overlay.setVisible(true);
    this.wall = wall;
  }

  hide(): void {
    // Keep `wall` + the built object so a re-hover of the SAME wall reuses it (no churn);
    // the flag just stops the post-FX pass from drawing it.
    this.overlay.setVisible(false);
  }

  dispose(): void {
    this.overlay.dispose();
    this.wall = null;
  }
}
