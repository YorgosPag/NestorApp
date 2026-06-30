/**
 * post-fx-overlay-pass.ts — Revit/Maxon-grade post-FX UI/reference overlay pass (ADR-537).
 *
 * PROBLEM (generalised from the DXF underlay): any overlay that lives in the MAIN scene — the raw
 * DXF underlay (translucent wireframe + text) AND the edit gizmo (translucent negative axes /
 * plane handles / markers) — is corrupted by the idle render path. At settle the SSAO composer
 * multiplies the ambient-occlusion term over the whole frame and the warm sun/ground lighting
 * blends through the translucent fragments → the lines / gizmo axes turn "mustard" (and during
 * fast raster navigation translucent fragments accumulate to white). The opaque parts stay
 * correct, the translucent ones flip white-in-motion → mustard-at-settle. Plain `depthTest:false`
 * does NOT help: the corruption is the post-FX composite, not z-fighting.
 *
 * SOLUTION (how Revit / Cinema 4D draw CAD linework + manipulators): these are NOT shaded
 * geometry — they are reference/UI overlays drawn in a DEDICATED FORWARD PASS *after* the lit
 * scene + post-FX, depth-tested against the scene depth but never touched by SSAO / GI / tone-
 * mapping. Each overlay root is kept `visible = false` by its owner (so the MAIN render skips it);
 * this pass renders ONLY those roots, on top of the already-laid scene depth, into whichever
 * target the caller has bound:
 *   • composer path  → `PostFxOverlayPass` inserted before the final CopyPass renders into the
 *                      composer readBuffer (which still holds the RenderPass scene depth).
 *   • raster/section → `renderPostFxOverlays()` after the direct scene render (screen depth intact).
 *
 * Per-root MATERIALS decide depth behaviour in the SAME pass: the underlay uses `depthTest:true`
 * (occluded by walls, drawn on top of coplanar bases via the `LessEqualDepth` win), the gizmo uses
 * `depthTest:false` (always-on-top manipulator). One pass, mixed depth, all AO-immune.
 *
 * REGISTRY SSoT: owners (`DxfToThreeConverter`, `BimGizmoOverlay`) live in different layers
 * (scene-manager vs React) and recreate their roots, so they REGISTER a provider (keyed by the
 * scene they belong to) instead of being threaded through constructors. The pass reads the
 * registry — one mechanism for every "overlay that must bypass post-FX", scene-scoped so multiple
 * viewports never cross-talk.
 */

import type * as THREE from 'three';
import { Pass } from 'three/addons/postprocessing/Pass.js';

/** Returns the overlay roots to draw THIS frame (empty = nothing shown right now). */
export type OverlayRootsProvider = () => readonly THREE.Object3D[];

/**
 * ADR-516 Phase 2 — overlay class, so the frozen-DXF-backdrop (`dxf-backdrop-cache.ts`) can render
 * the static `'underlay'` once into its cache and the live `'gizmo'` on top every drag frame, while
 * the normal raster/composer paths still draw BOTH (kind filter omitted).
 */
export type PostFxOverlayKind = 'underlay' | 'gizmo';

/**
 * Z-order WITHIN the overlay collection: lower = drawn first = further back. Overlays that share a
 * kind can be coplanar with `depthWrite:false` (the C4D ground grid and the DXF wireframe are BOTH
 * `'underlay'`, both on the Y=0 plane), so neither wins on depth — DRAW ORDER alone decides which
 * paints on top. The grid is the reference GROUND and must sit beneath all content; it registers at
 * `GROUND`, every other overlay stays at `CONTENT`. Explicit z-order (Figma z-index / Revit draw-
 * order / C4D object-order), never accidental construction order. (ADR-558 — DXF-above-grid fix.)
 */
export const OVERLAY_ORDER = { GROUND: -100, CONTENT: 0 } as const;

/** A registered overlay: its depth/AO class + its z-order within the collection. */
interface OverlayEntry {
  readonly kind: PostFxOverlayKind;
  readonly order: number;
}

/** Per-scene map of overlay provider → its entry (scene-scoped → no cross-viewport bleed). */
const registries = new WeakMap<THREE.Object3D, Map<OverlayRootsProvider, OverlayEntry>>();

/**
 * Register a post-FX overlay provider for `scene`. The owner keeps its roots `visible=false` (so
 * the main render skips them) and returns, each frame, the subset that should currently be drawn.
 * `kind` defaults to `'gizmo'` (the always-on-top manipulator class); the DXF underlay owner passes
 * `'underlay'`. `order` (default `CONTENT`) sets the draw order within a kind — the ground grid
 * passes `GROUND` so it always paints beneath the coplanar DXF underlay. Returns an unregister
 * function (call it on dispose).
 */
export function registerPostFxOverlay(
  scene: THREE.Object3D,
  provider: OverlayRootsProvider,
  kind: PostFxOverlayKind = 'gizmo',
  order: number = OVERLAY_ORDER.CONTENT,
): () => void {
  let map = registries.get(scene);
  if (!map) {
    map = new Map();
    registries.set(scene, map);
  }
  map.set(provider, { kind, order });
  return () => { map?.delete(provider); };
}

/**
 * Collect every overlay root currently shown for `scene` (flattened across providers). When `kind`
 * is given, only that class is collected (undefined = all kinds — the normal render paths).
 */
export function collectPostFxOverlayRoots(scene: THREE.Object3D, kind?: PostFxOverlayKind): THREE.Object3D[] {
  const map = registries.get(scene);
  if (!map || map.size === 0) return [];
  // Filter by kind, then STABLE-sort by z-order (Array.prototype.sort is stable): GROUND first,
  // CONTENT after; equal orders keep registration order. This is what decides which coplanar same-
  // depth underlay paints on top — the grid (GROUND) beneath the DXF wireframe (CONTENT). (ADR-558.)
  const entries = [...map].filter(([, e]) => kind === undefined || e.kind === kind);
  entries.sort((a, b) => a[1].order - b[1].order);
  const out: THREE.Object3D[] = [];
  for (const [provider] of entries) {
    for (const root of provider()) out.push(root);
  }
  return out;
}

/**
 * Render the registered overlay roots for `scene` into the CURRENTLY BOUND render target, on top
 * of the existing depth, without clearing. No-op when nothing is registered/shown. Each root is
 * rendered standalone (`renderer.render(root, camera)`) so only its geometry is drawn — a Group
 * root carries no background/fog/overrideMaterial. Roots are kept `visible=false` by their owners;
 * this flips each on ONLY for its own draw, then restores it (so the main render keeps skipping it).
 */
export function renderPostFxOverlays(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Object3D,
  camera: THREE.Camera,
  kind?: PostFxOverlayKind,
): void {
  const roots = collectPostFxOverlayRoots(scene, kind);
  if (roots.length === 0) return;
  const prevAutoClear = renderer.autoClear;
  renderer.autoClear = false; // never wipe the lit scene already in the target
  for (const root of roots) {
    const prevVisible = root.visible;
    root.visible = true;
    renderer.render(root, camera);
    root.visible = prevVisible; // restore (false) → main render keeps skipping it
  }
  renderer.autoClear = prevAutoClear;
}

/**
 * EffectComposer pass that draws the post-FX overlays into the composer readBuffer AFTER SSAO but
 * before the final CopyPass. `needsSwap = false` keeps it on the same buffer the SSAO multiply
 * wrote (and whose depth attachment still holds the RenderPass scene depth), so the overlays are
 * depth-correct yet untouched by the AO composite.
 */
export class PostFxOverlayPass extends Pass {
  private readonly scene: THREE.Object3D;
  private readonly getCamera: () => THREE.Camera;

  constructor(scene: THREE.Object3D, getCamera: () => THREE.Camera) {
    super();
    this.scene = scene;
    this.getCamera = getCamera;
    this.needsSwap = false;
  }

  override render(
    renderer: THREE.WebGLRenderer,
    _writeBuffer: THREE.WebGLRenderTarget,
    readBuffer: THREE.WebGLRenderTarget,
  ): void {
    renderer.setRenderTarget(this.renderToScreen ? null : readBuffer);
    renderPostFxOverlays(renderer, this.scene, this.getCamera());
  }
}
