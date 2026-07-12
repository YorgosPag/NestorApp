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
import type { DxfScene, DxfEntityUnion, DxfText } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { SceneLayer } from '../../types/entities';
import { ACI_PALETTE } from '../../settings/standards/aci';
// 🏢 ADR-571: hex→int SSoT (μηδέν local parseInt duplicate)
import { hexToTrueColor } from '../../utils/dxf-true-color';
import { sceneUnitsToMeters, resolveSceneUnits } from '../../utils/scene-units';
import { circlePolyline, arcPolyline } from './dxf-arc-circle-sample';
// ADR-644 Φάση B — shared glyph atlas + merged, atlas-sampled text mesh (replaces the per-text
// `CanvasTexture` path: 1 atlas + one draw call per floor instead of thousands of textures).
import { GlyphAtlas } from './glyph-atlas';
import { AtlasTextMeshBuilder, countTextGlyphCapacity } from './glyph-atlas-text-mesh';
import { registerPostFxOverlay } from '../scene/post-fx-overlay-pass';
import { finiteBox3FromObject } from '../scene/finite-bounds';
// ADR-645 Φάση A — time-sliced text streaming (freeze fix) + its progress SSoT.
import { runIncrementalBuild, type IncrementalBuildHandle } from '../scene/incremental-scene-builder';
import { setDxf3dStreamProgress, clearDxf3dStreamProgress } from '../stores/Dxf3dStreamProgressStore';
// ADR-645 Φάση A — gate: below this many text entities the build stays synchronous (no loader flash).
import { DXF_IMPORT_THRESHOLDS } from '../../config/dxf-import-thresholds';
// ADR-645 Φάση A — view-priority ordering reuses the 2D per-entity bbox SSoT (ADR-040 Phase IX).
import { getEntityBBox } from '../../canvas-v2/dxf-canvas/dxf-viewport-culling';
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
/** ADR-645 Φάση A — one active streaming build per converter; a re-sync replaces it under this id. */
const DXF3D_STREAM_BUILD_ID = 'dxf3d-text-stream';

// ACI_PALETTE values are CSS hex strings '#RRGGBB'. Cast for numeric index access.
const ACI_MAP = ACI_PALETTE as unknown as Record<number, string | undefined>;

// ── Color helpers ─────────────────────────────────────────────────────────────

function aciToInt(aci: number): number {
  const hex = ACI_MAP[aci];
  if (!hex) return DEFAULT_COLOR;
  return hexToTrueColor(hex); // ADR-571 SSoT
}

function hexCssToInt(hex: string): number {
  // ADR-571: delegate το parse στο hexToTrueColor SSoT· κρατά το DEFAULT_COLOR fallback σε άκυρο hex.
  return /^#?[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(hex.trim()) ? hexToTrueColor(hex) : DEFAULT_COLOR;
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
  // ADR-537 NaN-guard — ONE non-finite coordinate poisons the whole overlay `Box3`
  // (`getBounds` → `setFromObject`), which NaN-frames the SHARED camera → BOTH the DXF underlay
  // AND the lit BIM scene vanish (empty 3D). This is the SSoT chokepoint every line / circle /
  // arc / polyline segment flows through, so drop the bad segment here and keep the rest.
  if (!Number.isFinite(ax) || !Number.isFinite(az) || !Number.isFinite(bx) || !Number.isFinite(bz)) return;
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

/** ADR-645 Φάση A — one floor's built wireframe group + the text entities left to stream into it. */
interface BuiltFloorGroup {
  readonly group: THREE.Group;
  readonly layersById: Record<string, SceneLayer> | undefined;
  /** Visible text entities of this floor — deferred to the streamed pass (§text hotspot). */
  readonly textEntities: readonly DxfText[];
}

/** ADR-645 Φάση A — one deferred text mesh: which entity, into which floor group, with which layers. */
interface StreamTextItem {
  readonly group: THREE.Group;
  readonly entity: DxfText;
  readonly layersById: Record<string, SceneLayer> | undefined;
}

/**
 * ADR-645 Φάση A — view-priority: bigger text first (bbox area, descending) so titles /
 * prominent labels stream in before the fine print. Uses the 2D per-entity bbox SSoT
 * (`getEntityBBox`, ADR-040 Phase IX); non-finite areas sort last. Full frustum / screen-size
 * culling is Φάση C — this is the cheap, camera-free ordering the streamed build needs now.
 */
function textPriorityArea(entity: DxfText): number {
  const bb = getEntityBBox(entity);
  const area = (bb.maxX - bb.minX) * (bb.maxY - bb.minY);
  return Number.isFinite(area) ? area : 0;
}

export class DxfToThreeConverter {
  private readonly scene: THREE.Scene;
  /** ADR-645 Φάση A — invoked per streamed batch so the frame scheduler repaints the fill-in. */
  private readonly onSceneDirty: () => void;
  private root: THREE.Group | null = null;
  private readonly activeMaterials: THREE.LineBasicMaterial[] = [];
  /** ADR-537 underlay-depth — unregister the post-FX overlay provider on dispose. */
  private readonly unregisterOverlay: () => void;
  /** ADR-645 Φάση A — in-flight streamed text build; cancelled on every re-sync / dispose. */
  private activeBuild: IncrementalBuildHandle | null = null;
  /** ADR-645 Φάση B — shared glyph atlas (one texture, cells cached across syncs). Lazy. */
  private atlas: GlyphAtlas | null = null;
  /** ADR-645 Φάση B — per-floor atlas text mesh builders of the CURRENT root (disposed on re-sync). */
  private textBuilders: AtlasTextMeshBuilder[] = [];
  // 🚀 PERF (ADR-040, 2026-06-28) — idempotency guards. `sync()`/`syncMultiFloor()`
  // skip the full teardown + GPU re-upload when handed an overlay-equivalent input
  // (e.g. a BIM column moved but no DXF line/text changed). Cross-mode: each path
  // nulls the OTHER's key so a single↔multi scope switch always rebuilds.
  private lastSyncKey: DxfOverlaySyncKey | null = null;
  private lastMultiKey: readonly DxfOverlayFloorKey[] | null = null;

  constructor(scene: THREE.Scene, onSceneDirty: () => void = () => {}) {
    this.scene = scene;
    this.onSceneDirty = onSceneDirty;
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
    const built = dxfScene ? this.buildLineGroup(dxfScene) : null;
    if (!built) return;

    // Flat structure (named group holds the LineSegments directly) — unchanged
    // from the pre-multi-floor layout so existing consumers / tests keep working.
    built.group.name = 'dxf-wireframe';
    // ADR-537 underlay-depth — drawn by the dedicated post-FX overlay pass (`post-fx-overlay-pass.ts`),
    // not the lit scene. `visible=false` hides it from the main render; the pass reads the root
    // via `getRoot()` (the owner accessor, mirror of `getBounds`) and flips it on for its own pass.
    built.group.visible = false;
    this.root = built.group;
    this.scene.add(built.group);
    // ADR-645 Φάση A — lines are in the scene NOW → `getBounds()` frames the camera immediately;
    // the (expensive) text meshes stream in across the next frames without blocking.
    this.streamText(built.textEntities.map((entity) => (
      { group: built.group, entity, layersById: built.layersById }
    )));
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
    // ADR-645 Φάση A — text of EVERY floor is aggregated into ONE streamed build (multi-floor is
    // the real scale driver: text × floors → thousands). One runner, one progress bar, one budget.
    const textTasks: StreamTextItem[] = [];
    for (const entry of entries) {
      const built = this.buildLineGroup(entry.scene);
      if (!built) continue;
      built.group.position.y = entry.floorElevationMm * MM_TO_M;
      root.add(built.group);
      for (const entity of built.textEntities) {
        textTasks.push({ group: built.group, entity, layersById: built.layersById });
      }
    }
    if (root.children.length === 0) return;
    // ADR-537 underlay-depth — same dedicated underlay pass for the stacked multi-floor root.
    root.visible = false;
    this.root = root;
    this.scene.add(root);
    this.streamText(textTasks);
  }

  /**
   * ADR-645 Φάση A — build ONLY the cheap line color-buckets for one DXF scene (scaled to
   * metres) and collect its visible text entities for the deferred streamed pass. Returns null
   * when there is nothing visible/drawable. Shared by `sync` + `syncMultiFloor`.
   */
  private buildLineGroup(dxfScene: DxfScene): BuiltFloorGroup | null {
    if (dxfScene.entities.length === 0) return null;

    const layersById = dxfScene.layersById as Record<string, SceneLayer> | undefined;
    const colorBuckets = new Map<number, number[]>();
    const textEntities: DxfText[] = [];

    for (const entity of dxfScene.entities) {
      if (!entity.visible) continue;
      // ADR-645 Φάση A — text is deferred to the streamed pass (the §2.2 freeze hotspot).
      if (entity.type === 'text') { textEntities.push(entity); continue; }
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

    // Nothing visible at all (no line segments, no text) → no group, mirrors the old null return.
    if (group.children.length === 0 && textEntities.length === 0) return null;

    // Scale the wireframe overlay from DXF world units → metres so it aligns
    // with BIM geometry. appendEntitySegments stores raw DXF coordinates;
    // the group-level transform converts them to the Three.js metre world.
    // Scene-units → metres via the SSoT (`scene-units.ts`); declared unit, else mm default.
    const unitScale = sceneUnitsToMeters(resolveSceneUnits({ units: dxfScene.units }));
    group.scale.set(unitScale, 1, unitScale);
    return { group, layersById, textEntities };
  }

  /**
   * ADR-645 Φάση B — one atlas text task: append this entity's glyphs into its floor's merged
   * atlas mesh, tinted by the resolved entity colour. The layout is NaN-guarded per glyph
   * (`AtlasTextMeshBuilder.addEntity`), so a bad anchor drops that text without poisoning the Box3.
   */
  private appendTextGlyphs(item: StreamTextItem, builder: AtlasTextMeshBuilder): void {
    builder.addEntity(item.entity, this.requireAtlas(), resolveEntityColor(item.entity, item.layersById));
  }

  /** ADR-645 Φάση B — the shared glyph atlas, created lazily on first streamed text build. */
  private requireAtlas(): GlyphAtlas {
    if (!this.atlas) this.atlas = new GlyphAtlas();
    return this.atlas;
  }

  /**
   * ADR-645 Φάση B — one merged atlas text mesh PER floor group. Each floor's glyphs stream into
   * its own pre-sized BufferGeometry (added to the group NOW, empty), so the group's scale +
   * elevation transform still maps native units → the metre world. All floors share ONE atlas
   * texture → 1 atlas + one draw call per floor instead of thousands of `CanvasTexture` meshes.
   */
  private makeFloorBuilders(items: readonly StreamTextItem[]): Map<THREE.Group, AtlasTextMeshBuilder> {
    const byGroup = new Map<THREE.Group, StreamTextItem[]>();
    for (const item of items) {
      const list = byGroup.get(item.group);
      if (list) list.push(item); else byGroup.set(item.group, [item]);
    }
    const builders = new Map<THREE.Group, AtlasTextMeshBuilder>();
    for (const [group, groupItems] of byGroup) {
      const capacity = countTextGlyphCapacity(groupItems.map((it) => it.entity));
      const builder = new AtlasTextMeshBuilder(this.requireAtlas(), capacity);
      group.add(builder.mesh);
      this.textBuilders.push(builder);
      builders.set(group, builder);
    }
    return builders;
  }

  /**
   * ADR-645 Φάση A/B — stream the deferred text into the shared glyph atlas. Small scenes (< the
   * gate) build synchronously inline (no loader flash); large scenes stream the glyph layout across
   * frames on the `UnifiedFrameScheduler`, view-priority ordered, with % progress. Selectable /
   * hoverable is unaffected — the pick + hover glow read the entities, never the atlas mesh.
   */
  private streamText(items: StreamTextItem[]): void {
    if (items.length === 0) { this.onSceneDirty(); return; }
    // View-priority: bigger text first (descending bbox area).
    items.sort((a, b) => textPriorityArea(b.entity) - textPriorityArea(a.entity));
    const total = items.length;
    const builders = this.makeFloorBuilders(items);
    const builderFor = (item: StreamTextItem): AtlasTextMeshBuilder => builders.get(item.group)!;
    const flushAll = (): void => { for (const b of builders.values()) b.flush(); };

    if (total < DXF_IMPORT_THRESHOLDS.INCREMENTAL_3D_MIN_ENTITIES) {
      for (const item of items) this.appendTextGlyphs(item, builderFor(item));
      flushAll();
      this.onSceneDirty();
      return;
    }

    setDxf3dStreamProgress(0, total);
    this.onSceneDirty(); // paint the line wireframe immediately (frame 0)
    this.activeBuild = runIncrementalBuild({
      id: DXF3D_STREAM_BUILD_ID,
      total,
      processItem: (i) => this.appendTextGlyphs(items[i], builderFor(items[i])),
      onFrameProcessed: (done, tot) => { flushAll(); setDxf3dStreamProgress(done, tot); this.onSceneDirty(); },
      onComplete: () => { this.activeBuild = null; flushAll(); clearDxf3dStreamProgress(); this.onSceneDirty(); },
      onCancelled: () => { clearDxf3dStreamProgress(); },
    });
  }

  getBounds(): THREE.Box3 | null {
    if (!this.root) return null;
    // ADR-537 defense-in-depth — NaN-safe bounds SSoT: `Box3.isEmpty()` is NaN-BLIND, so a
    // non-finite bound would otherwise slip through and NaN-frame the shared camera. Returns null
    // (the caller's "no bounds → no-op" branch) on empty OR non-finite — belt to the source guards.
    return finiteBox3FromObject(this.root);
  }

  private disposeRoot(): void {
    // ADR-645 Φάση A — a new sync (re-sync / floor switch / dispose) aborts any in-flight streamed
    // text build BEFORE teardown, so no `processItem` can append a mesh to a group about to be
    // disposed (clean cancellation — the §Google-level race-free guarantee). `cancel()` clears the
    // progress overlay via `onCancelled`; the fresh `streamText` re-arms it if the new build streams.
    if (this.activeBuild) { this.activeBuild.cancel(); this.activeBuild = null; }
    // ADR-645 Φάση B — dispose the atlas text meshes' geometry + material (NOT the shared atlas
    // TEXTURE, which is converter-owned + reused across syncs — see `dispose`).
    for (const builder of this.textBuilders) builder.dispose();
    this.textBuilders.length = 0;
    if (!this.root) return;
    this.root.traverse((obj) => {
      if (obj instanceof THREE.LineSegments) obj.geometry.dispose();
    });
    for (const mat of this.activeMaterials) mat.dispose();
    this.activeMaterials.length = 0;
    this.scene.remove(this.root);
    this.root = null;
  }

  dispose(): void {
    this.unregisterOverlay();
    this.disposeRoot(); // ADR-645 Φάση A — cancels the in-flight streamed build (+ clears its progress).
    // ADR-645 Φάση B — the shared glyph atlas texture outlives individual roots; free it on unmount.
    this.atlas?.dispose();
    this.atlas = null;
    clearDxf3dStreamProgress(); // defensive: ensure the overlay never lingers after unmount.
    this.lastSyncKey = null;
    this.lastMultiKey = null;
  }
}
