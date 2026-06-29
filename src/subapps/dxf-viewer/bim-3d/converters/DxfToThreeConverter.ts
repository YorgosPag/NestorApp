/**
 * DxfToThreeConverter — SPEC-3D-001 (ADR-366 Phase 3).
 *
 * Converts DxfScene entities into Three.js geometry for the 3D viewport.
 * Supersedes DxfFloorPlanOverlay (single-color MVP, no layer colors).
 *
 * Strategy:
 *   Groups entities by resolved color — one LineSegments per unique color.
 *   BIM wrappers (wall / beam / slab / stair / dimension) are skipped;
 *   they are rendered by BimSceneLayer + BimToThreeConverter.
 *   Coordinate mapping: DXF (x, y) → Three.js (x, 0, −y) [Y-up, floor plane].
 *
 * Color cascade per entity:
 *   colorTrueColor > colorAci > concrete entity.color > ByLayer cascade:
 *   layer.colorTrueColor > layer.colorAci > layer.color hex > 0xffffff.
 *
 * Lifecycle: owned by ThreeJsSceneManager. sync() called on scene changes;
 * dispose() on component unmount.
 */

import * as THREE from 'three';
import type { Point2D } from '../../rendering/types/Types';
import type { DxfScene, DxfEntityUnion } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { SceneLayer } from '../../types/entities';
import { ACI_PALETTE } from '../../settings/standards/aci';
import { sceneUnitsToMeters, resolveSceneUnits } from '../../utils/scene-units';
import { circlePolyline, arcPolyline } from './dxf-arc-circle-sample';
import { buildDxfTextMesh } from './dxf-text-3d';
import { registerPostFxOverlay } from '../scene/post-fx-overlay-pass';
import {
  toDxfOverlaySyncKey,
  isSameDxfOverlaySync,
  isSameMultiKey,
  type DxfOverlaySyncKey,
  type DxfOverlayFloorKey,
} from './dxf-overlay-sync-guard';

// ── Constants ─────────────────────────────────────────────────────────────────
const DEFAULT_COLOR = 0xffffff;
const WIREFRAME_OPACITY = 0.65;

// ACI_PALETTE values are CSS hex strings '#RRGGBB'. Cast for numeric index access.
const ACI_MAP = ACI_PALETTE as unknown as Record<number, string | undefined>;

// ── Color helpers ─────────────────────────────────────────────────────────────

function aciToInt(aci: number): number {
  const hex = ACI_MAP[aci];
  if (!hex) return DEFAULT_COLOR;
  return parseInt(hex.slice(1), 16);
}

function hexCssToInt(hex: string): number {
  const v = parseInt(hex.startsWith('#') ? hex.slice(1) : hex, 16);
  return isNaN(v) ? DEFAULT_COLOR : v;
}

function resolveLayer(
  entity: DxfEntityUnion,
  layersById: Record<string, SceneLayer> | undefined,
): SceneLayer | undefined {
  // ADR-358 Phase 9D-5a: id-only resolution (entity-layer-id-canonical SSoT).
  // Legacy `entity.layer` name backref forbidden in new code.
  if (!layersById || !entity.layerId) return undefined;
  return layersById[entity.layerId];
}

function layerColorToInt(layer: SceneLayer): number {
  if (layer.colorTrueColor != null) return layer.colorTrueColor & 0xFFFFFF;
  if (layer.colorAci !== undefined) return aciToInt(layer.colorAci);
  if (layer.color) return hexCssToInt(layer.color);
  return DEFAULT_COLOR;
}

/** Resolve final Three.js color integer for a DXF entity.
 *  Exported for unit testing. */
export function resolveEntityColor(
  entity: DxfEntityUnion,
  layersById: Record<string, SceneLayer> | undefined,
): number {
  if (entity.colorTrueColor != null) return entity.colorTrueColor & 0xFFFFFF;

  const byLayer = entity.colorMode === 'ByLayer'
    || entity.colorMode === 'ByBlock'
    || (!entity.color && entity.colorAci === undefined);

  if (!byLayer) {
    if (entity.colorAci !== undefined) return aciToInt(entity.colorAci);
    if (entity.color) return hexCssToInt(entity.color);
  }

  const layer = resolveLayer(entity, layersById);
  return layer ? layerColorToInt(layer) : DEFAULT_COLOR;
}

// ── Geometry helpers ──────────────────────────────────────────────────────────

function pushSeg(buf: number[], ax: number, az: number, bx: number, bz: number): void {
  buf.push(ax, 0, az, bx, 0, bz);
}

/** Push a plan-mm poly-line (from the canonical sampler) as consecutive line segments,
 *  applying the DXF y → −Z floor-plane mapping. */
function pushPolyline(buf: number[], pts: readonly Point2D[]): void {
  for (let i = 0; i < pts.length - 1; i++) {
    pushSeg(buf, pts[i].x, -pts[i].y, pts[i + 1].x, -pts[i + 1].y);
  }
}

/** Append line-segment pairs for a single entity into a flat position buffer.
 *  Coordinate mapping: DXF x → X, DXF y → −Z (Y-up floor plane).
 *  Exported for unit testing. */
export function appendEntitySegments(buf: number[], entity: DxfEntityUnion): void {
  switch (entity.type) {
    case 'line': {
      pushSeg(buf, entity.start.x, -entity.start.y, entity.end.x, -entity.end.y);
      break;
    }

    case 'circle': {
      // Canonical tessellation SSoT (shared with hover-outline + grip-ghost).
      pushPolyline(buf, circlePolyline(entity.center, entity.radius));
      break;
    }

    case 'arc': {
      pushPolyline(buf, arcPolyline(
        entity.center, entity.radius, entity.startAngle, entity.endAngle, entity.counterclockwise,
      ));
      break;
    }

    case 'polyline': {
      const { vertices, closed } = entity;
      if (vertices.length < 2) break;
      const count = closed ? vertices.length : vertices.length - 1;
      for (let i = 0; i < count; i++) {
        const a = vertices[i];
        const b = vertices[(i + 1) % vertices.length];
        pushSeg(buf, a.x, -a.y, b.x, -b.y);
      }
      break;
    }

    // BIM: wall/beam/slab → BimSceneLayer; text/stair/dimension/xline/ray/others → skip.
    default:
      break;
  }
}

// ── DxfToThreeConverter ───────────────────────────────────────────────────────

/** One floor's DXF underlay scene + its datum-relative elevation (mm). */
export interface DxfOverlayFloorEntry {
  readonly scene: DxfScene;
  /** Datum-relative vertical offset, in millimetres (ADR-399 Phase B). */
  readonly floorElevationMm: number;
}

const MM_TO_M = 0.001;

export class DxfToThreeConverter {
  private readonly scene: THREE.Scene;
  private root: THREE.Group | null = null;
  private readonly activeMaterials: THREE.LineBasicMaterial[] = [];
  /** ADR-537 underlay-depth — unregister the post-FX overlay provider on dispose. */
  private readonly unregisterOverlay: () => void;
  // 🚀 PERF (ADR-040, 2026-06-28) — idempotency guards. `sync()`/`syncMultiFloor()`
  // skip the full teardown + GPU re-upload when handed an overlay-equivalent input
  // (e.g. a BIM column moved but no DXF line/text changed). Cross-mode: each path
  // nulls the OTHER's key so a single↔multi scope switch always rebuilds.
  private lastSyncKey: DxfOverlaySyncKey | null = null;
  private lastMultiKey: readonly DxfOverlayFloorKey[] | null = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    // ADR-537 underlay-depth — the wireframe/text underlay is drawn by the dedicated post-FX
    // overlay pass (`post-fx-overlay-pass.ts`), never the lit scene. Register the current root as
    // a provider (kept `visible=false`); the pass draws it on top of the scene depth, AO-immune.
    // ADR-516 Phase 2 — class `'underlay'` so the frozen-DXF-backdrop caches it once per entity drag
    // (the thousands of static line segments = the GPU back-pressure root) instead of re-drawing it.
    this.unregisterOverlay = registerPostFxOverlay(scene, () => (this.root ? [this.root] : []), 'underlay');
  }

  /** Single-floor overlay sitting on the floor plane (Y=0). */
  sync(dxfScene: DxfScene | null): void {
    // 🚀 PERF (ADR-040) — idempotent: identical overlay input ⇒ identical output ⇒
    // keep the existing geometry + GPU textures (no `texSubImage2D` re-upload).
    const key = toDxfOverlaySyncKey(dxfScene);
    if (this.lastMultiKey === null && isSameDxfOverlaySync(this.lastSyncKey, key)) return;
    this.lastSyncKey = key;
    this.lastMultiKey = null; // leaving multi-floor mode
    this.disposeRoot();
    const group = dxfScene ? this.buildColorGroup(dxfScene) : null;
    if (!group) return;

    // Flat structure (named group holds the LineSegments directly) — unchanged
    // from the pre-multi-floor layout so existing consumers / tests keep working.
    group.name = 'dxf-wireframe';
    // ADR-537 underlay-depth — drawn by the dedicated post-FX overlay pass (`post-fx-overlay-pass.ts`),
    // not the lit scene. `visible=false` hides it from the main render; the pass reads the root
    // via `getRoot()` (the owner accessor, mirror of `getBounds`) and flips it on for its own pass.
    group.visible = false;
    this.root = group;
    this.scene.add(group);
  }

  /**
   * ADR-399 Phase B — stacked per-floor overlays. Each floor's DXF wireframe
   * sits at its own datum-relative elevation so the «Όλοι οι όροφοι» 3D view
   * shows every floor's plan aligned with the stacked BIM geometry (mirror of
   * `BimSceneLayer.syncMultiFloor`).
   */
  syncMultiFloor(entries: readonly DxfOverlayFloorEntry[]): void {
    // 🚀 PERF (ADR-040) — idempotent stacked variant: skip the rebuild when every
    // floor's overlay input AND elevation is unchanged since the last multi sync.
    const keys = entries.map((e) => ({ key: toDxfOverlaySyncKey(e.scene), elev: e.floorElevationMm }));
    if (this.lastSyncKey === null && isSameMultiKey(this.lastMultiKey, keys)) return;
    this.lastMultiKey = keys;
    this.lastSyncKey = null; // leaving single-floor mode
    this.disposeRoot();
    const root = new THREE.Group();
    root.name = 'dxf-wireframe-multifloor';
    for (const entry of entries) {
      const group = this.buildColorGroup(entry.scene);
      if (!group) continue;
      group.position.y = entry.floorElevationMm * MM_TO_M;
      root.add(group);
    }
    if (root.children.length === 0) return;
    // ADR-537 underlay-depth — same dedicated underlay pass for the stacked multi-floor root.
    root.visible = false;
    this.root = root;
    this.scene.add(root);
  }

  /**
   * Build a colour-bucketed `THREE.Group` for one DXF scene (scaled to metres),
   * or null when there is nothing to draw. Shared by `sync` + `syncMultiFloor`.
   */
  private buildColorGroup(dxfScene: DxfScene): THREE.Group | null {
    if (dxfScene.entities.length === 0) return null;

    const layersById = dxfScene.layersById as Record<string, SceneLayer> | undefined;
    const colorBuckets = new Map<number, number[]>();

    for (const entity of dxfScene.entities) {
      if (!entity.visible) continue;
      const color = resolveEntityColor(entity, layersById);
      let bucket = colorBuckets.get(color);
      if (!bucket) {
        bucket = [];
        colorBuckets.set(color, bucket);
      }
      appendEntitySegments(bucket, entity);
    }

    const group = new THREE.Group();
    group.name = 'dxf-wireframe-floor';

    for (const [color, positions] of colorBuckets) {
      if (positions.length === 0) continue;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
      // ADR-537 underlay-depth — drawn in the dedicated underlay pass: depth-TESTED (walls in
      // front occlude it) but `depthWrite:false` so overlapping linework never self-z-fights.
      const mat = new THREE.LineBasicMaterial({
        color, transparent: true, opacity: WIREFRAME_OPACITY, depthWrite: false,
      });
      this.activeMaterials.push(mat);
      group.add(new THREE.LineSegments(geo, mat));
    }

    // ADR-537 β — text entities have no stroke; render each as a flat textured plane (laid on
    // the floor plane in native units) so it is visible + selectable/hoverable in 3D.
    for (const entity of dxfScene.entities) {
      if (entity.type !== 'text' || !entity.visible) continue;
      const bundle = buildDxfTextMesh(entity, resolveEntityColor(entity, layersById));
      if (bundle) group.add(bundle.mesh);
    }

    if (group.children.length === 0) return null;

    // Scale the wireframe overlay from DXF world units → metres so it aligns
    // with BIM geometry. appendEntitySegments stores raw DXF coordinates;
    // the group-level transform converts them to the Three.js metre world.
    // Scene-units → metres via the SSoT (`scene-units.ts`); declared unit, else mm default.
    const unitScale = sceneUnitsToMeters(resolveSceneUnits({ units: dxfScene.units }));
    group.scale.set(unitScale, 1, unitScale);
    return group;
  }

  getBounds(): THREE.Box3 | null {
    if (!this.root) return null;
    const box = new THREE.Box3().setFromObject(this.root);
    return box.isEmpty() ? null : box;
  }

  private disposeRoot(): void {
    if (!this.root) return;
    this.root.traverse((obj) => {
      if (obj instanceof THREE.LineSegments) obj.geometry.dispose();
      // ADR-537 β — text meshes own their geometry + material + CanvasTexture.
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        const mat = obj.material as THREE.Material & { map?: THREE.Texture | null };
        mat.map?.dispose();
        mat.dispose();
      }
    });
    for (const mat of this.activeMaterials) mat.dispose();
    this.activeMaterials.length = 0;
    this.scene.remove(this.root);
    this.root = null;
  }

  dispose(): void {
    this.unregisterOverlay();
    this.disposeRoot();
    this.lastSyncKey = null;
    this.lastMultiKey = null;
  }
}
