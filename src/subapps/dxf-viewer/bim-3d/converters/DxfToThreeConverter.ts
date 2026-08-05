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
import type { DxfScene, DxfText } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { SceneLayer } from '../../types/entities';
// N.7.1 split — the ByLayer/ACI/trueColor cascade lives in its own module (ADR-571 SSoT inside).
import { resolveEntityColor } from './dxf-overlay-entity-color';
import { sceneUnitsToMeters, resolveSceneUnits } from '../../utils/scene-units';
// ADR-645 Φάση B — shared glyph atlas + merged, atlas-sampled text mesh (replaces the per-text
// `CanvasTexture` path: 1 atlas + one draw call per floor instead of thousands of textures).
import { GlyphAtlas } from './glyph-atlas';
import { AtlasTextMeshBuilder, countTextGlyphCapacity } from './glyph-atlas-text-mesh';
import { registerPostFxOverlay } from '../scene/post-fx-overlay-pass';
import { finiteBox3FromObject } from '../scene/finite-bounds';
// ADR-665 Φ2 — δηλώνει ρητά ότι το υπόστρωμα DXF ανήκει στο scope `'default'` (βλ. seat παρακάτω).
import { lockClipScope } from '../systems/section/clip-scope-guard';
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
// ADR-650 M10d — topo contours are drawn once (draped) by TerrainContourLayer, never per-floor here.
import { isTopoContourEntity } from '../../systems/topography/contour-entity-ids';
// ADR-739 Φ.Θ — ο πίνακας αποδομείται στις ΙΔΙΕΣ γραμμές + κείμενα που παράγει η εξαγωγή.
import { appendTableToUnderlay } from './dxf-table-3d-decompose';
import { useDrawingScaleStore } from '../../state/drawing-scale-store';
// N.7.1 — η τεσελίωση οντότητας→τμήματα ζει δίπλα, ώστε ο converter να κρατά μόνο κύκλο ζωής.
import { appendEntitySegments } from './dxf-underlay-segments';

// ── Constants ─────────────────────────────────────────────────────────────────
const WIREFRAME_OPACITY = 0.65;
/** ADR-645 Φάση A — one active streaming build per converter; a re-sync replaces it under this id. */
const DXF3D_STREAM_BUILD_ID = 'dxf3d-text-stream';

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

/**
 * ADR-739 Φ.Θ / ADR-040 — η ζωντανή κλίμακα σχεδίασης με **getter τη στιγμή της κλήσης**,
 * ποτέ συνδρομή: ο converter δεν είναι React και δεν επιτρέπεται να αποκτήσει συνδρομή σε
 * store. Την καλεί ο `sync` / `syncMultiFloor` **μία φορά**, στην αρχή.
 */
function currentDrawingScale(): number {
  return useDrawingScaleStore.getState().drawingScale;
}


export class DxfToThreeConverter {
  private readonly scene: THREE.Scene;
  /** ADR-645 Φάση A — invoked per streamed batch so the frame scheduler repaints the fill-in. */
  private readonly onSceneDirty: () => void;
  private root: THREE.Group | null = null;
  /**
   * Τα υλικά του τρέχοντος root, για ρητό `dispose()`. ADR-739 Φ.Θ — `Material` και όχι
   * `LineBasicMaterial`: το υπόστρωμα απέκτησε και `MeshBasicMaterial` (γεμίσματα κελιών).
   * Ένας στενότερος τύπος εδώ θα σήμαινε **διαρροή GPU** για κάθε βαμμένο κελί που ζει και
   * πεθαίνει με τον πίνακά του.
   */
  private readonly activeMaterials: THREE.Material[] = [];
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
  /** ADR-399 Φάση Ε — the elevation the last single-floor `sync` rendered at; part of its
   *  idempotency identity (mirror of `lastMultiKey`'s per-floor `elev`), so an unchanged plan
   *  moved to another storey still rebuilds instead of being skipped as "same input". */
  private lastSyncElevationMm = 0;
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

  /**
   * Single-floor overlay, seated on its storey's floor plane.
   *
   * ADR-399 Φάση Ε — `floorElevationMm` is the **datum-relative** FFL of the active storey
   * (the SAME frame + the SAME value `BimSceneLayer.sync` already receives via `bim3d-resync`,
   * and the cut plane via `cut-plane-3d`). Defaults to 0 for the read-only Properties pipeline,
   * which has no storey context. Applied EXACTLY as in {@link syncMultiFloor} — one convention,
   * one formula, no second elevation path.
   *
   * Before Φάση Ε this path hardcoded Y=0 while every other single-floor consumer had already
   * migrated to the real FFL (ADR-448) → the plan of an upper storey sank to the ground.
   */
  sync(dxfScene: DxfScene | null, floorElevationMm = 0): void {
    // 🚀 PERF (ADR-040) — idempotent: identical overlay input ⇒ identical output ⇒
    // keep the existing geometry + GPU textures (no `texSubImage2D` re-upload).
    // ADR-739 Φ.Θ — ΜΙΑ ανάγνωση της κλίμακας ανά sync, μοιρασμένη ανάμεσα στο κλειδί και στο
    // χτίσιμο: αν τη διάβαζαν χωριστά, το κλειδί θα μπορούσε να δει άλλη τιμή από τη γεωμετρία.
    const drawingScale = currentDrawingScale();
    const key = toDxfOverlaySyncKey(dxfScene, drawingScale);
    if (
      this.lastMultiKey === null
      && this.lastSyncElevationMm === floorElevationMm
      && isSameDxfOverlaySync(this.lastSyncKey, key)
    ) return;
    this.lastSyncKey = key;
    this.lastSyncElevationMm = floorElevationMm;
    this.lastMultiKey = null; // leaving multi-floor mode
    this.disposeRoot();
    const built = dxfScene ? this.buildLineGroup(dxfScene, drawingScale) : null;
    if (!built) return;

    // Flat structure (named group holds the LineSegments directly) — unchanged
    // from the pre-multi-floor layout so existing consumers / tests keep working.
    built.group.name = 'dxf-wireframe';
    // ADR-399 Φάση Ε — seat the plan at its storey's real elevation (same line as the stacked
    // path). `group.scale.y` is 1, so the metre offset is unit-independent.
    built.group.position.y = floorElevationMm * MM_TO_M;
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
    // ADR-739 Φ.Θ — μία ανάγνωση κλίμακας για ΟΛΟΥΣ τους ορόφους: η κλίμακα σχεδίασης είναι
    // ιδιότητα του φύλλου, όχι του ορόφου, οπότε μια ανά όροφο θα ήταν και σπατάλη και ρίσκο.
    const drawingScale = currentDrawingScale();
    const keys = entries.map((e) => (
      { key: toDxfOverlaySyncKey(e.scene, drawingScale), elev: e.floorElevationMm }
    ));
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
      const built = this.buildLineGroup(entry.scene, drawingScale);
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
   * ADR-739 Φ.Θ / N.18 — **ένας buffer θέσεων ανά χρώμα → ένα αντικείμενο σκηνής.**
   *
   * Εξήχθη μόλις απέκτησε δεύτερο καλούντα: τα γεμίσματα κελιών χρειάζονται ακριβώς την ίδια
   * ακολουθία (buffer → `BufferAttribute` → `computeBoundingSphere` → καταγραφή υλικού →
   * `group.add`) με τις γραμμές, και **μόνο** το είδος του αντικειμένου διαφέρει. Το CHECK 3.28
   * το έπιασε ως sibling clone μέσα στο ίδιο commit (9 γραμμές / 55 tokens) — σωστά: δύο
   * σώματα που θα μπορούσαν κάποτε να διαφωνήσουν για το πότε υπολογίζεται η σφαίρα ορίων ή
   * ποιο υλικό καταγράφεται για dispose. Ένα σώμα, δύο εργοστάσια.
   *
   * Η `computeBoundingSphere` είναι κοινή επίτηδες (ADR-645 Φάση C): στατικά όρια ⇒ το native
   * frustum culling του three απορρίπτει έναν εκτός οθόνης όροφο **από το πρώτο καρέ**, χωρίς
   * κόστος πρώτης απόδοσης — και αυτό ισχύει για τα γεμίσματα όσο και για τις γραμμές.
   */
  private addColorBuckets(
    group: THREE.Group,
    buckets: ReadonlyMap<number, number[]>,
    make: (geometry: THREE.BufferGeometry, color: number) => THREE.Object3D & {
      readonly material: THREE.Material;
    },
  ): void {
    for (const [color, positions] of buckets) {
      if (positions.length === 0) continue;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
      geo.computeBoundingSphere();
      const object = make(geo, color);
      this.activeMaterials.push(object.material);
      group.add(object);
    }
  }

  /**
   * ADR-645 Φάση A — build ONLY the cheap line color-buckets for one DXF scene (scaled to
   * metres) and collect its visible text entities for the deferred streamed pass. Returns null
   * when there is nothing visible/drawable. Shared by `sync` + `syncMultiFloor`.
   */
  private buildLineGroup(dxfScene: DxfScene, drawingScale: number): BuiltFloorGroup | null {
    if (dxfScene.entities.length === 0) return null;

    const layersById = dxfScene.layersById as Record<string, SceneLayer> | undefined;
    const colorBuckets = new Map<number, number[]>();
    const textEntities: DxfText[] = [];
    // ADR-739 Φ.Θ — γεμίσματα κελιών (τρίγωνα). Άδειος για κάθε σκηνή χωρίς πίνακα.
    const fillBuckets = new Map<number, number[]>();
    // ADR-739 Φ.Θ — οι μονάδες της σκηνής, μία φορά: τις χρειάζεται η αποδόμηση του πίνακα
    // (annotative γεωμετρία) και ήταν ήδη ο ίδιος υπολογισμός στο τέλος της συνάρτησης.
    const sceneUnits = resolveSceneUnits({ units: dxfScene.units });

    for (const entity of dxfScene.entities) {
      if (!entity.visible) continue;
      // ADR-650 M10d — topo contours (lines + elevation labels) are NOT drawn by the per-floor
      // overlay: that stamped them flat at every storey's elevation → identical contours stacked
      // per floor. They render exactly once, draped at their real (datum-shifted) elevation, via
      // `TerrainContourLayer`. Skipped here (before the text/line split) so both are excluded.
      if (isTopoContourEntity(entity, layersById)) continue;
      // ADR-739 Φ.Θ — ΕΔΩ έπεφτε ο πίνακας στο `default: break` του `appendEntitySegments`, και
      // αυτός ήταν ΟΛΟΣ ο λόγος που δεν φαινόταν στο 3Δ. Αποδομείται στις ίδιες γραμμές +
      // κείμενα που παράγει η εξαγωγή, και από εδώ και πέρα ρέει στα ΥΠΑΡΧΟΝΤΑ δύο μονοπάτια.
      // **Μετά** το φίλτρο τοπογραφίας, ώστε ο αποκλεισμός ανά στρώμα να ισχύει ομοιόμορφα για
      // κάθε οντότητα — ένας πίνακας σε στρώμα ισοϋψών δεν επιτρέπεται να «ξεφύγει» επειδή
      // τυχαίνει να έχει δικό του κλάδο.
      if (entity.type === 'table') {
        appendTableToUnderlay(entity, {
          drawingScale, sceneUnits, colorBuckets, fillBuckets, textEntities, layersById,
        });
        continue;
      }
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
    // ADR-665 Φ2 — το υπόστρωμα DXF ανήκει ΠΑΝΤΑ στο scope `'default'`. Τα υλικά του είναι
    // `LineBasicMaterial`, που είναι clippable ΜΟΝΟ στο `'topo'`: αν αυτό το υποδέντρο βρεθεί ποτέ
    // κάτω από topo root, ολόκληρο το 2Δ σχέδιο αρχίζει να κόβεται από την κοπή του εδάφους —
    // σιωπηλά, ενώ τα Canvas2D overlays συνεχίζουν να σχεδιάζονται (δεν περνούν από GPU clipping).
    // Το κλείδωμα δεν αλλάζει συμπεριφορά· κάνει τη διαρροή ΟΡΑΤΗ. Μπαίνει εδώ (και όχι στα δύο
    // call sites) γιατί ΚΑΘΕ διαδρομή — single-floor και stacked multi-floor — περνά από εδώ.
    lockClipScope(group, 'default');

    // ADR-739 Φ.Θ — τα γεμίσματα ΠΡΩΤΑ, πριν από κάθε γραμμή και κάθε γράμμα: η ίδια σειρά που
    // επιβάλλει το `tableLayoutToPrimitives` σε καμβά και PDF, όπου «η σειρά ΕΙΝΑΙ το z-order».
    // Εδώ η σειρά δεν αρκεί (η GPU δεν την τιμά μόνη της), γι' αυτό μπαίνει και ρητό
    // `renderOrder = -1`: όλα τα υλικά του υποστρώματος είναι `depthWrite:false`, οπότε το βάθος
    // δεν τα διαχωρίζει και ένα γέμισμα ζωγραφισμένο αργότερα θα έσβηνε το πλέγμα του κελιού του.
    this.addColorBuckets(group, fillBuckets, (geo, color) => {
      // `DoubleSide`: ο πίνακας μπορεί να είναι περιστραμμένος ή ιδωμένος από κάτω — ένα
      // γέμισμα που εξαφανίζεται όταν ο χρήστης κοιτάξει από το υπόγειο θα ήταν το ίδιο
      // ελάττωμα «αόρατης κεφαλίδας», σε άλλη γωνία.
      const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: WIREFRAME_OPACITY, depthWrite: false,
        side: THREE.DoubleSide,
      }));
      mesh.renderOrder = -1;
      return mesh;
    });

    // ADR-537 underlay-depth — drawn in the dedicated underlay pass: depth-TESTED (walls in
    // front occlude it) but `depthWrite:false` so overlapping linework never self-z-fights.
    this.addColorBuckets(group, colorBuckets, (geo, color) => new THREE.LineSegments(
      geo, new THREE.LineBasicMaterial({
        color, transparent: true, opacity: WIREFRAME_OPACITY, depthWrite: false,
      }),
    ));

    // Nothing visible at all (no line segments, no text) → no group, mirrors the old null return.
    if (group.children.length === 0 && textEntities.length === 0) return null;

    // Scale the wireframe overlay from DXF world units → metres so it aligns
    // with BIM geometry. appendEntitySegments stores raw DXF coordinates;
    // the group-level transform converts them to the Three.js metre world.
    // Scene-units → metres via the SSoT (`scene-units.ts`); declared unit, else mm default.
    const unitScale = sceneUnitsToMeters(sceneUnits);
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
    // ADR-645 Φάση C — build complete: bounds are final → re-enable three's native frustum culling
    // so off-screen floors' text is skipped by the underlay pass. (Kept OFF while streaming.)
    const finalizeAll = (): void => { for (const b of builders.values()) b.finalize(); };

    if (total < DXF_IMPORT_THRESHOLDS.INCREMENTAL_3D_MIN_ENTITIES) {
      for (const item of items) this.appendTextGlyphs(item, builderFor(item));
      flushAll();
      finalizeAll();
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
      onComplete: () => {
        this.activeBuild = null; flushAll(); finalizeAll(); clearDxf3dStreamProgress(); this.onSceneDirty();
      },
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
      // ADR-739 Φ.Θ — ΚΑΙ τα `Mesh` των γεμισμάτων. Ο έλεγχος ήταν `LineSegments`-only όσο το
      // υπόστρωμα είχε μόνο γραμμές· τα atlas text meshes τα καθαρίζει ο δικός τους builder.
      if (obj instanceof THREE.LineSegments || obj instanceof THREE.Mesh) obj.geometry.dispose();
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
    this.lastSyncElevationMm = 0;
    this.lastMultiKey = null;
  }
}
