/**
 * TopoBreaklineLayer — the COMMITTED breaklines in the 3D viewport (ADR-920 Β4.8 Β2.4).
 *
 * The fifth {@link TopoSceneLayer}. The plan has shown committed breaklines since Β1; the model showed
 * only the proposals (`TopoAutoBreaklineCandidateLayer`). This layer draws the constraints the TIN was
 * actually built from, in the SAME sentence as the plan (`topo-breakline-style`): a yellow line on a dark
 * casing, its pattern telling where the z came from, a ringed disc at every vertex.
 *
 * ### What it draws
 * {@link topoBreaklinesToGeometries} does the projection — the terrain mesh's projector + datum + crop
 * ring, each breakline at its OWN z (so a crossing conflict shows as a gap from the ground instead of
 * being draped away). This layer adds the passes: one casing under everything, one core per line
 * pattern (≤ 3), disc outline, disc fill. `depthWrite:false` everywhere, so `renderOrder` IS the
 * painter's order and must be > 0 (ADR-375 C.7).
 *
 * ### Why it cuts itself (and nobody else does it)
 * The terrain under these lines is cut on the GPU at the active level (ADR-665), but neither
 * `LineMaterial` nor `PointsMaterial` accepts clip planes on this build (`section-clip-applicator`).
 * The ADR-452 CPU trim of the building's edges cannot be borrowed either: it runs inside
 * `renderFrameWithCaps`, i.e. ONLY while a BUILDING cut is live — a terrain-only level cut (the common
 * case: change floor) never reaches it. So the layer trims its own buffers to
 * {@link resolveTopoHorizontalCutWorldY} — the SAME two planes the GPU applies to the hill — with the
 * shared `edge-cut-trim` primitives. Known limit, same as the building's edges (ADR-452/455): the
 * vertical X/Y cuts and the section box do not trim fat lines.
 *
 * ### Visibility
 * Inherited from the base: a breakline is a constraint ON the ground, judged against it, so it hides
 * with the terrain (same rule as contours and candidates).
 *
 * Owner + reactivity: constructed once by `createTopoSceneLayers`, imperative, zero React state (ADR-040).
 *
 * @module bim-3d/scene/terrain/TopoBreaklineLayer
 * @enterprise ADR-920 — Topography breaklines · ADR-650 — Topography · ADR-665 — Terrain clip
 */

import * as THREE from 'three';
import type { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { getActiveCropRing, getTopoBreaklines } from '../../../systems/topography/TopoPointStore';
import type { Breakline } from '../../../systems/topography/topo-types';
import type { Point2D } from '../../../rendering/types/Types';
import {
  getActiveWorldToDisplayProjector,
  getGeoReference,
} from '../../../systems/geo-referencing/geo-reference-store';
import type { GeoReference } from '../../../systems/geo-referencing/geo-transform';
import { getActiveVerticalDatumMm } from '../../../systems/topography/vertical-datum';
import { useActiveStoreyStore } from '../../../systems/levels/active-storey-store';
import { useViewMode3DStore } from '../../stores/ViewMode3DStore';
import { useBimRenderSettingsStore } from '../../../state/bim-render-settings-store';
import { excludeFromSectionParity } from '../../systems/section/section-parity-overlay';
import {
  topoBreaklinesToGeometries,
  type TopoBreaklineGeometries,
} from '../../converters/topo-breakline-to-three';
import {
  getTopoBreaklineCasingMaterial3D,
  getTopoBreaklineCoreMaterial3D,
  getTopoBreaklineVertexMaterial3D,
} from '../../materials/topo-breakline-materials-3d';
import { createFatLineMesh } from '../../lines/scene-fat-line';
import { clipLineSegmentsToCutY, filterPointsBelowCutY } from '../edge-cut-trim';
import { disposeObjectTree } from '../dispose-object-tree';
import { TopoSceneLayer } from './topo-scene-layer-support';
import {
  getBreaklineDisplayState, subscribeBreaklineDisplay,
} from '../../../systems/topography/topo-breakline-display-store';
import { resolveTopoHorizontalCutWorldY } from './terrain-clip-plane';

/** Everything that changes what this layer draws. Compared by identity — see `sameInputs`. */
interface BreaklineInputs {
  /** Δ3 — only the surface the terrain mesh shows (`existing`). */
  readonly breaklines: readonly Breakline[];
  readonly cropRing: readonly Point2D[] | null;
  readonly datumMm: number;
  readonly geoRef: GeoReference | null;
  /** Three-world Y (m) of the topo scope's horizontal cut; `null` = uncut. */
  readonly cutY: number | null;
}

/** The inputs the PROJECTION depends on — every one except the cut. */
type ProjectionInputs = Omit<BreaklineInputs, 'cutY'>;

/** Painter's order of the passes (all `depthWrite:false`): casing under core, ring under fill. */
export const TOPO_BREAKLINE_RENDER_ORDER = { casing: 1, core: 2, discOutline: 3, discFill: 4 } as const;

/** `geometries` trimmed to `cutY` under `matrixWorld`; empty sets dropped. `null` cut = untouched. */
function trimToCut(
  geometries: TopoBreaklineGeometries,
  matrixWorld: THREE.Matrix4,
  cutY: number | null,
): TopoBreaklineGeometries {
  if (cutY === null) return geometries;
  const groups = geometries.groups
    .map((g) => ({ pattern: g.pattern, positions: clipLineSegmentsToCutY(g.positions, matrixWorld, cutY) }))
    .filter((g) => g.positions.length > 0);
  const vertices = geometries.vertices ? filterPointsBelowCutY(geometries.vertices, matrixWorld, cutY) : null;
  return { groups, vertices: vertices && vertices.length > 0 ? vertices : null };
}

/** All groups' segment pairs in one buffer — the casing is solid, so it needs no per-pattern split. */
function concatPositions(geometries: TopoBreaklineGeometries): Float32Array {
  const out = new Float32Array(geometries.groups.reduce((n, g) => n + g.positions.length, 0));
  let offset = 0;
  for (const g of geometries.groups) {
    out.set(g.positions, offset);
    offset += g.positions.length;
  }
  return out;
}

export class TopoBreaklineLayer extends TopoSceneLayer<BreaklineInputs> {
  /**
   * The last projection and what it was built from. A Z-cut slider drag fires the render-settings store
   * on every tick; with this, a cut-only change re-trims the cached segments instead of re-projecting
   * every breakline through the crop ring.
   */
  private projection: { readonly inputs: ProjectionInputs; readonly geometries: TopoBreaklineGeometries } | null = null;

  constructor(
    scene: THREE.Object3D,
    markDirty: () => void,
    onRebuilt: (root: THREE.Object3D) => void = () => {},
  ) {
    // On top of the shared survey / visibility / geo-reference set (which already covers the crop ring:
    // it lives in the survey store): the inputs of the horizontal cut — active storey + floor scope for
    // the terrain cut (as `TerrainCutCapLayer`), render settings for the building's Z cut — and (ADR-920 Β3.4)
    // the breakline «eye», which the base gates through `isLayerShown()`. A focus-only change of that store
    // lands in `rebuildGeometry` and stops at `sameInputs`: nothing re-derived.
    super(scene, 'topo-breaklines', markDirty, onRebuilt, [
      subscribeBreaklineDisplay,
      (rebuild) => useActiveStoreyStore.subscribe(rebuild),
      (rebuild) => useViewMode3DStore.subscribe(rebuild),
      (rebuild) => useBimRenderSettingsStore.subscribe(rebuild),
    ]);
    this.start();
  }

  /** ADR-920 Β3.4 — the same «eye» the 2D overlay and the ribbon toggle read. */
  protected override isLayerShown(): boolean {
    return getBreaklineDisplayState().visible;
  }

  protected rebuildGeometry(): void {
    const inputs: BreaklineInputs = {
      breaklines: getTopoBreaklines('existing'),
      cropRing: getActiveCropRing()?.vertices ?? null,
      datumMm: getActiveVerticalDatumMm(),
      geoRef: getGeoReference(),
      cutY: resolveTopoHorizontalCutWorldY(),
    };
    // Every other render-settings change (and every unrelated survey edit) lands here: nothing moved.
    if (this.sameInputs(inputs)) return;

    this.clearContent();
    this.root.updateMatrixWorld(true); // the root is dropped (`TERRAIN_DISPLAY_DROP_MM`): trim in WORLD Y
    const geometries = trimToCut(this.projectionFor(inputs), this.root.matrixWorld, inputs.cutY);
    if (geometries.groups.length > 0) {
      this.addFatPass(concatPositions(geometries), getTopoBreaklineCasingMaterial3D(), 'casing');
      for (const group of geometries.groups) {
        this.addFatPass(group.positions, getTopoBreaklineCoreMaterial3D(group.pattern), 'core');
      }
    }
    if (geometries.vertices) {
      this.addDiscs(geometries.vertices, 'outline');
      this.addDiscs(geometries.vertices, 'fill');
    }
    this.lastInputs = inputs;
    this.markDirty();
  }

  /** The projected (uncut) geometry — reused while only the cut moves. */
  private projectionFor(inputs: BreaklineInputs): TopoBreaklineGeometries {
    const cached = this.projection;
    if (
      cached
      && cached.inputs.breaklines === inputs.breaklines
      && cached.inputs.cropRing === inputs.cropRing
      && cached.inputs.datumMm === inputs.datumMm
      && cached.inputs.geoRef === inputs.geoRef
    ) {
      return cached.geometries;
    }
    const { breaklines, cropRing, datumMm, geoRef } = inputs;
    const geometries = topoBreaklinesToGeometries(breaklines, {
      // §M10f — the terrain mesh's WORLD→DISPLAY bridge, read here (impure) and passed into the pure converter.
      projector: getActiveWorldToDisplayProjector(),
      datumMm,
      cropRing,
    });
    this.projection = { inputs: { breaklines, cropRing, datumMm, geoRef }, geometries };
    return geometries;
  }

  /**
   * One fat-line pass. Its OWN geometry (`createFatLineMesh` uploads a fresh buffer) — a buffer shared
   * between casing and core would be freed twice by `clearContent`. Excluded from the stencil parity: a
   * `LineSegments2` IS a `Mesh`, tests depth and has no `bimId`, so it would otherwise count in the
   * closed-solid parity passes when a section box crosses the ground (ADR-665 M2.7).
   */
  private addFatPass(
    positions: Float32Array,
    material: LineMaterial,
    pass: 'casing' | 'core',
  ): void {
    const mesh = createFatLineMesh(positions, material);
    mesh.name = `topo-breaklines-${pass}`;
    mesh.renderOrder = TOPO_BREAKLINE_RENDER_ORDER[pass];
    excludeFromSectionParity(mesh);
    this.root.add(mesh);
  }

  /** One disc pass over the kept vertices (ring first, fill over it). */
  private addDiscs(positions: Float32Array, role: 'outline' | 'fill'): void {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.computeBoundingSphere();
    const points = new THREE.Points(geometry, getTopoBreaklineVertexMaterial3D(role));
    points.name = `topo-breaklines-disc-${role}`;
    points.renderOrder = role === 'outline'
      ? TOPO_BREAKLINE_RENDER_ORDER.discOutline
      : TOPO_BREAKLINE_RENDER_ORDER.discFill;
    this.root.add(points);
  }

  /** Remove + free the current passes. Geometry only — materials are catalog singletons. */
  protected clearContent(): void {
    disposeObjectTree(this.root);
    this.root.clear();
  }

  override dispose(): void {
    super.dispose();
    this.projection = null;
  }
}
