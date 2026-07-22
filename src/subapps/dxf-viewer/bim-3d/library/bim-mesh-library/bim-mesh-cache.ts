/**
 * bimMeshCache — entity-agnostic glTF cache (ADR-411, Option A from ADR-410).
 *
 * The bridge between the SYNCHRONOUS 3D sync loop (`BimSceneLayer.sync*`) and the
 * ASYNC glTF loader, shared by ALL mesh-based BIM entities (furniture, light
 * fixtures, …). A module-level singleton keyed by `category/assetId`:
 *
 *   - `preload(category, assetId)`   → async; resolves the Storage URL + loads
 *     the glTF + caches the template `THREE.Group` (and its 2D silhouette +
 *     top-edges). Idempotent (de-dups in-flight loads).
 *   - `getInstance(category, assetId)` → SYNC; returns a fresh clone of the
 *     cached template (or null on a cache miss).
 *   - `getSilhouette` / `getTopEdges`  → SYNC; the cached 2D plan projection.
 *
 * On a cache miss the sync loop draws a bounding-box placeholder and fires
 * `preload`; when the load resolves we bump the shared `meshAssetVersion` in the
 * entities store, whose `BimViewport3D` subscriber re-runs `resyncBimScene` (the
 * placeholder is replaced by the real mesh), and `markAllCanvasDirty()` repaints
 * the 2D canvas (rectangle → silhouette). One resync signal for every category
 * (ADR-411 Δ5).
 *
 * Generalises `furniture-gltf-cache.ts` (ADR-410), which now delegates here.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-411-bim-mesh-library.md
 * @see docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { resolveMeshUrl, meshAssetKey } from './bim-mesh-url-resolver';
import { recentreMeshFootprint } from './mesh-footprint-recentre';
import { collectAddressableGltfNodes } from '../../scene/gltf-addressable-nodes';
import { useBim3DEntitiesStore } from '../../stores/Bim3DEntitiesStore';
import {
  computeTopSilhouette,
  computeTopFillTriangles,
  computeTopEdges,
  type SilPoint,
  type SilSegment,
} from '../../../bim/mesh-library/mesh-silhouette';
import {
  computeTopFillContours,
  flatRingsToFilteredContours,
} from '../../../bim/mesh-library/mesh-fill-contours';
import { requestExactFillRings } from './mesh-fill-union-client';
import {
  computeTopSilhouettePerSlot,
  type SlotSilhouette,
} from '../../../bim/mesh-library/mesh-silhouette-slots';
import { markAllCanvasDirty } from '../../../rendering/core/frame-scheduler-api';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('BimMeshCache');

type CacheState = 'loading' | 'error';

/**
 * Η κατάσταση φόρτωσης ενός asset, όπως τη βλέπει το UI (ADR-683 §mesh-load-missing-file):
 *  - `ready`   → template φορτωμένο (κανονικό πλέγμα)·
 *  - `loading` → σε εξέλιξη (placeholder κουτί προσωρινά)·
 *  - `error`   → η λήψη απέτυχε, π.χ. **λείπει το `.glb`** (placeholder κουτί ΜΟΝΙΜΑ → το UI το σημαίνει)·
 *  - `idle`    → δεν ζητήθηκε ακόμη.
 */
export type MeshAssetLoadState = 'idle' | 'loading' | 'error' | 'ready';

const loader = new GLTFLoader();

/** key (`category/assetId`) → loaded template group (clone per instance). */
const templates = new Map<string, THREE.Group>();
/** key → in-flight / error marker (so we never double-load). */
const status = new Map<string, CacheState>();
/** key → top-view silhouette (plan meters) for the 2D footprint. */
const silhouettes = new Map<string, readonly SilPoint[]>();
/** key → faithful top-view fill triangles (flat CCW plan coords) — ADR-683 §10.9 (legacy raw path). */
const fillTriangles = new Map<string, Float32Array>();
/** key → cached simplified fill contours (outer components + holes) — ADR-683 §10.9 (cheap-zoom path). */
const fillContours = new Map<string, readonly (readonly SilPoint[])[]>();
/** key → top-view feature edges (plan meters) for 2D interior detail. */
const edges = new Map<string, readonly SilSegment[]>();
/** key → per-material-slot silhouettes (ADR-683 Φ5) for the 2D material poché. */
const slotSilhouettes = new Map<string, readonly SlotSilhouette[]>();

/**
 * Kick off (or no-op) an async load. Resolves silently; the loaded mesh becomes
 * available via `getInstance()` and the entities store is bumped to trigger a 3D
 * resync. Safe to call from a synchronous sync loop (fire-and-forget).
 */
function preload(category: string, assetId: string): void {
  const key = meshAssetKey(category, assetId);
  if (templates.has(key) || status.has(key)) return;
  status.set(key, 'loading');

  // ADR-683 Φ3 — «bundle» asset (`<uploadId>#<nodeName>`): ένα ανεβασμένο `.glb` κουβαλά ΠΟΛΛΑ
  // αντικείμενα (Revit linked-model). Κατεβαίνει **μία** φορά και ευρετηριάζεται ανά κόμβο.
  const bundle = splitBundleAssetId(assetId);

  loadScene(category, bundle ? bundle.bundleId : assetId)
    .then((scene) => {
      if (bundle) indexBundleNodes(category, bundle.bundleId, scene);
      else indexTemplate(key, scene);
      // Ο ζητούμενος κόμβος μπορεί να μην υπάρχει στο αρχείο (μετονομάστηκε/διαγράφηκε στον
      // επόμενο γύρο): σβήνουμε το 'loading' ούτως ή άλλως, αλλιώς θα κολλούσε για πάντα.
      status.delete(key);
      // One shared resync signal: 3D rebuild (bbox placeholder → real mesh) AND
      // 2D repaint (rectangle → silhouette). The 2D canvas is dirtied directly
      // since it does not subscribe to the entities store.
      useBim3DEntitiesStore.getState().bumpMeshAssetVersion();
      markAllCanvasDirty();
    })
    .catch((err) => {
      // Leave an 'error' marker so we don't hammer Storage on every resync; the
      // bbox placeholder remains as the visible fallback.
      status.set(key, 'error');
      // ADR-683 §mesh-load-missing-file — ΟΧΙ σιωπηλή αποτυχία. Ένα εισαγόμενο πλέγμα του οποίου το
      // `.glb` λείπει (404 / Storage wiped) αλλιώς γινόταν αόρατο μόνιμο κουτί, χωρίς κανένα ίχνος —
      // ώρες debugging στη βάση. Τώρα ΦΩΝΑΖΕΙ στο console (πρακτική Revit «linked model not found»).
      logger.warn('mesh asset unavailable — placeholder box shown', {
        category,
        assetId,
        key,
        error: err instanceof Error ? err.message : String(err),
      });
      // Ίδιο σήμα με το success path, ώστε το πάνελ/renderer να αντικατοπτρίσει την κατάσταση (badge
      // «αρχείο μη διαθέσιμο»). Μία φορά ανά asset: το `status='error'` μπλοκάρει επόμενο preload → no loop.
      useBim3DEntitiesStore.getState().bumpMeshAssetVersion();
      markAllCanvasDirty();
    });
}

/**
 * Ευρετηριάζει ΕΝΑ φορτωμένο αντικείμενο ως template + 2Δ περίγραμμα.
 *
 * Recentre the footprint (X/Z) on the local origin so the mesh sits on its insertion point
 * regardless of where the artist placed the glTF origin. The SAME recentred template feeds the 3D
 * placement (getInstance clone) AND the 2D silhouette → the two views can never desync
 * (ADR-411 2D polish, issue #2).
 */
function indexTemplate(key: string, object: THREE.Object3D): void {
  const template = recentreMeshFootprint(object);
  templates.set(key, template);
  // Derive the 2D plan silhouette + interior edges from the actual mesh (per-asset
  // representative footprint). Computed once; failures fall back to the rectangle in the renderer.
  try {
    // ADR-683 §10.9 (revised) — INSTANT cheap-zoom placeholder: simplified, cached, multi-component
    // + hole-aware raster fill contours (few points → cheap even-odd fill on every zoom).
    const contours = computeTopFillContours(template);
    if (contours.length > 0) fillContours.set(key, contours);
    // Legacy raw projected-triangle fill (exact shadow, up to ~42k triangles) — kept as a temporary
    // fallback below the contour fill until the new path is verified in the browser (Giorgio 2026-07-22).
    const fill = computeTopFillTriangles(template);
    if (fill.length >= 6) {
      fillTriangles.set(key, fill);
      // ADR-683 §10.9.2 — kick the EXACT vector union on a worker thread (big-player precision without
      // freezing the load). When it resolves, swap the raster placeholder → exact contours + repaint.
      // Fire-and-forget: any failure resolves null and the raster placeholder simply stays.
      requestExactFillRings(key, fill)
        .then((rings) => {
          if (!rings || rings.length === 0) return;
          const exact = flatRingsToFilteredContours(rings);
          if (exact.length === 0) return;
          fillContours.set(key, exact);
          useBim3DEntitiesStore.getState().bumpMeshAssetVersion();
          markAllCanvasDirty();
        })
        .catch(() => { /* keep the raster placeholder */ });
    }
    const sil = computeTopSilhouette(template);
    if (sil.length >= 3) silhouettes.set(key, sil);
    const eg = computeTopEdges(template);
    if (eg.length > 0) edges.set(key, eg);
    // ADR-683 Φ5 — per-slot material poché (μόνο για multi-material κόμβους· single-slot → 1 entry
    // ισοδύναμο με τη single silhouette, οπότε ο renderer πέφτει στο mono μονοπάτι).
    const slots = computeTopSilhouettePerSlot(template);
    if (slots.length > 1) slotSilhouettes.set(key, slots);
  } catch {
    /* non-fatal — renderer falls back to the authored/measured rectangle */
  }
}

/**
 * ADR-683 Φ3 — σπάει ένα φορτωμένο bundle σε **ένα template ανά κόμβο**, με κλειδί
 * `category/<bundleId>#<nodeName>`.
 *
 * Ευρετηριάζονται ΟΛΟΙ οι κόμβοι, όχι μόνο ο ζητούμενος: το αρχείο κατέβηκε ήδη ολόκληρο, οπότε
 * τα υπόλοιπα 11 κάγκελα είναι δωρεάν — και η επόμενη `preload` τους βρίσκει σε cache hit χωρίς
 * δεύτερη διαδρομή δικτύου. Αυτό είναι όλο το νόημα του linked-model μοντέλου.
 *
 * **Deep, όχι top-level** (ADR-683 §mesh-load-nesting): οι κόμβοι λαμβάνονται από τον **ίδιο** SSoT
 * walker (`collectAddressableGltfNodes`) που παράγει τα `nodeName` κατά το parse. Αν ευρετηρίαζε μόνο
 * `scene.children`, ένας nested κόμβος (π.χ. κάτω από armature/root group του συνεργάτη) θα αποκτούσε
 * `nodeName` αλλά **καμία** template → μόνιμο placeholder κουτί ακόμη και με σωστό URL. Οι δύο άξονες
 * (parse ↔ index) μένουν συνεπείς εξ ορισμού, γιατί περνούν από τον ίδιο walker.
 */
function indexBundleNodes(category: string, bundleId: string, scene: THREE.Object3D): void {
  scene.updateMatrixWorld(true);
  for (const node of collectAddressableGltfNodes(scene)) {
    const nodeName = node.name;
    if (!nodeName) continue;
    const key = meshAssetKey(category, `${bundleId}${BUNDLE_SEPARATOR}${nodeName}`);
    if (templates.has(key)) continue;
    // Ο κόμβος αποσπάται από το δέντρο: ψήνουμε τον world μετασχηματισμό του (γονείς
    // συμπεριλαμβανομένων) στο τοπικό του σύστημα, ώστε ένας nested κόμβος να στέκει σωστά μόνος
    // του. Top-level κόμβος υπό identity scene root → ταυτόσημο με την παλιά συμπεριφορά.
    indexTemplate(key, bakeNodeWorldTransform(node));
  }
}

/**
 * Κλώνος ενός (πιθανώς nested) κόμβου με τον **world** μετασχηματισμό του ψημένο στο τοπικό σύστημα,
 * τυλιγμένος σε φρέσκο Group στην αρχή των αξόνων. Έτσι το `recentreMeshFootprint` (μέσα στο
 * `indexTemplate`) και το clone του `getInstance` βλέπουν τη γεωμετρία στον σωστό προσανατολισμό/θέση
 * ανεξάρτητα από το πού την τοποθέτησε ο γονέας του στη σκηνή. Idempotent για top-level (world == local).
 */
function bakeNodeWorldTransform(node: THREE.Object3D): THREE.Group {
  const baked = node.clone(true);
  baked.matrix.copy(node.matrixWorld);
  baked.matrix.decompose(baked.position, baked.quaternion, baked.scale);
  baked.matrixAutoUpdate = true;
  const group = new THREE.Group();
  group.add(baked);
  group.updateMatrixWorld(true);
  return group;
}

/** Διαχωριστικό κλειδιού bundle (καθρέφτης του `IMPORTED_MESH_NODE_SEPARATOR`). */
const BUNDLE_SEPARATOR = '#';

/**
 * In-flight **λήψεις αρχείου**, keyed by `category/<fileId>` (ΟΧΙ ανά κόμβο).
 *
 * ⚠️ Χωρίς αυτό, ένα bundle με 12 κάγκελα θα προκαλούσε **12 παράλληλα `loadAsync`** του ΙΔΙΟΥ
 * αρχείου: το `status` guard παραπάνω κλειδώνει ανά *κόμβο* (`…#Rail_01`), οπότε καθένας από τους
 * 12 περνά τον έλεγχο και ξεκινά δική του λήψη. Το `resolveMeshUrl` de-dup-άρει μόνο το *URL*, όχι
 * το κατέβασμα των bytes. Ένα 20MB αρχείο × 12 = 240MB δικτύου και 12 φορές parse — γι' αυτό η
 * de-dup γίνεται **εδώ**, στο επίπεδο αρχείου.
 */
const inFlightScenes = new Map<string, Promise<THREE.Object3D>>();

/** Κατεβάζει + κάνει parse ένα αρχείο **μία φορά**· ταυτόχρονοι καλούντες μοιράζονται το Promise. */
function loadScene(category: string, fileId: string): Promise<THREE.Object3D> {
  const fileKey = meshAssetKey(category, fileId);
  const existing = inFlightScenes.get(fileKey);
  if (existing) return existing;

  const promise = resolveMeshUrl(category, fileId)
    .then((url) => loader.loadAsync(url))
    .then((gltf) => gltf.scene)
    .finally(() => { inFlightScenes.delete(fileKey); });
  inFlightScenes.set(fileKey, promise);
  return promise;
}

/** `<bundleId>#<nodeName>` → τα δύο μέρη, ή `null` για απλό (μη-bundle) assetId. */
function splitBundleAssetId(
  assetId: string,
): { readonly bundleId: string; readonly nodeName: string } | null {
  const at = assetId.indexOf(BUNDLE_SEPARATOR);
  if (at <= 0 || at === assetId.length - 1) return null;
  return { bundleId: assetId.slice(0, at), nodeName: assetId.slice(at + 1) };
}

/** Return a fresh clone of the cached template, or null on a miss. */
function getInstance(category: string, assetId: string): THREE.Group | null {
  const template = templates.get(meshAssetKey(category, assetId)) ?? null;
  return template ? (template.clone(true) as THREE.Group) : null;
}

/** Top-view silhouette (plan meters) for an asset, or null if not yet computed. */
function getSilhouette(category: string, assetId: string): readonly SilPoint[] | null {
  return silhouettes.get(meshAssetKey(category, assetId)) ?? null;
}

/** Top-view feature edges (plan meters) for an asset, or null if not computed. */
function getTopEdges(category: string, assetId: string): readonly SilSegment[] | null {
  return edges.get(meshAssetKey(category, assetId)) ?? null;
}

/**
 * ADR-683 §10.9 — faithful top-view fill triangles (flat CCW plan coords) for an asset, or null if
 * not computed. The exact projected footprint (all disjoint regions + holes); the 2D renderer fills
 * these instead of the lossy single-contour silhouette.
 */
function getFillTriangles(category: string, assetId: string): Float32Array | null {
  return fillTriangles.get(meshAssetKey(category, assetId)) ?? null;
}

/**
 * ADR-683 §10.9 (revised) — cached simplified fill contours (outer components + holes, plan meters)
 * for an asset, or null if not computed. The cheap-zoom PRIMARY 2D footprint: the renderer fills these
 * few-point rings with even-odd on every zoom instead of ~42k raw triangles.
 */
function getFillContours(category: string, assetId: string): readonly (readonly SilPoint[])[] | null {
  return fillContours.get(meshAssetKey(category, assetId)) ?? null;
}

/**
 * ADR-683 Φ5 — per-material-slot silhouettes (plan meters) for the 2D material poché, ordered
 * lowest→highest for painters draw. `null` for single-material assets (caller uses the mono path).
 */
function getSlotSilhouettes(category: string, assetId: string): readonly SlotSilhouette[] | null {
  return slotSilhouettes.get(meshAssetKey(category, assetId)) ?? null;
}

/**
 * ADR-683 §mesh-load-missing-file — η κατάσταση φόρτωσης ενός asset, ώστε το UI να **σημάνει** ένα
 * πλέγμα του οποίου το `.glb` λείπει (`'error'`) αντί να δείχνει σιωπηλά μόνιμο κουτί. Σύγχρονο,
 * χωρίς παρενέργεια — ασφαλές για κλήση σε render. Αντανακλά αλλαγές μέσω του `meshAssetVersion`.
 */
function getLoadState(category: string, assetId: string): MeshAssetLoadState {
  const key = meshAssetKey(category, assetId);
  if (templates.has(key)) return 'ready';
  return status.get(key) ?? 'idle';
}

export const bimMeshCache = {
  preload,
  getInstance,
  getSilhouette,
  getFillTriangles,
  getFillContours,
  getTopEdges,
  getSlotSilhouettes,
  getLoadState,
};

/** Test-only — reset cache between specs. */
export function __resetBimMeshCacheForTests(): void {
  templates.clear();
  status.clear();
  silhouettes.clear();
  fillTriangles.clear();
  fillContours.clear();
  edges.clear();
  slotSilhouettes.clear();
  inFlightScenes.clear();
}
