/**
 * DXF BITMAP CACHE — ΤΟ ΔΟΜΙΚΟ ΚΛΕΙΔΙ (ADR-040 Phase D / ADR-726 Φ3)
 *
 * «Άλλαξε κάτι που αλλάζει τα ΙΔΙΑ ΤΑ PIXELS του cache;» — ένα ερώτημα, ένα αρχείο.
 *
 * Χωρίστηκε από το `dxf-bitmap-cache` (ADR-743 Φ1, N.7.1) γιατί είναι **άλλη ευθύνη** από την
 * προβολή του anchored raster: το κλειδί ρωτά «ίδια pixels;», η προβολή ρωτά «μπορούν αυτά τα
 * pixels να σερβίρουν την τρέχουσα όψη;». Το ένα διαβάζει stores, το άλλο είναι γεωμετρία.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * 🔴 Ο ΚΑΝΟΝΑΣ ΠΟΥ ΔΕΝ ΠΑΡΑΒΙΑΖΕΤΑΙ (ADR-040 cardinal rule #3)
 * ──────────────────────────────────────────────────────────────────────────────
 * Το κλειδί δέχεται **ΜΟΝΟ** δομικές εισόδους. `hoveredEntityId` / `selectedEntityIds` /
 * `gripInteractionState` / `dragPreview` **ΑΠΑΓΟΡΕΥΟΝΤΑΙ**: ακυρώνουν το cache στα ~60Hz κατά το
 * hover ⇒ πλήρης ανακατασκευή N οντοτήτων ανά καρέ ⇒ πάγωμα σελίδας (περιστατικό Phase D v1).
 *
 * **ADR-726 Φ3:** το view transform λείπει **σκόπιμα** — το αναλαμβάνει η προβολή της άγκυρας
 * (αλλαγή transform **επαναχρησιμοποιεί** το raster, δεν το ακυρώνει). Πριν από αυτό, κάθε καρέ
 * pan/zoom ήταν MISS εξ ορισμού: μετρημένο `frame:dxf-canvas` **min 32,7ms**, ~12 FPS.
 *
 * ⚠️ Οι αλλαγές εδώ **μόνο ΑΦΑΙΡΟΥΝ** εισόδους από το κλειδί. Κάθε προσθήκη interactive
 * κατάστασης επαναφέρει το πάγωμα.
 *
 * @module canvas-v2/dxf-canvas/dxf-bitmap-cache-key
 * @see canvas-v2/dxf-canvas/dxf-bitmap-cache — ο μοναδικός καταναλωτής
 */

import type { DxfScene, DxfRenderOptions } from './dxf-types';
import type { Viewport } from '../../rendering/types/Types';
// 🏢 ADR-344 Phase 11: bitmap cache must invalidate on viewport annotation scale change
import { getActiveScaleName } from '../../systems/viewport/ViewportStore';
// 🏢 ADR-375 Phase B: BIM render settings (drawingScale + viewRange + objectStyles)
//    affect per-entity line weight and cut-state — invalidate when they change.
import { useBimRenderSettingsStore } from '../../state/bim-render-settings-store';
// 🏢 ADR-376 Phase C.2: opening tag style mutations must bust the bitmap cache.
import { getCurrentOpeningTagStyle } from '../../bim/services/opening-tag-style-service';

/** Normal-state render toggles that change the cached pixels (ADR-040 Phase D wiring). */
export type BitmapCacheRenderInputs = Pick<DxfRenderOptions, 'showGrid' | 'showLayerNames' | 'wireframeMode'>;

/** STRUCTURAL cache key — inputs that change the cached PIXELS THEMSELVES. */
export interface CacheKey {
  sceneRef: object | null;
  width: number;
  height: number;
  dpr: number;
  /** ADR-344 Phase 11: invalidate cache when viewport annotation scale changes. */
  activeAnnotationScale: string;
  /** ADR-375 Phase B.1: invalidate cache when annotation scale denominator changes. */
  drawingScale: number;
  /** ADR-375 Phase B.2: viewRange/objectStyles hash — JSON snapshot of small structs. */
  bimSettingsHash: string;
  /** ADR-040 Phase D wiring (2026-06-11): wireframe / layer-name / grid toggles
   *  alter the cached normal-state pixels — they arrive via renderOptions, not a
   *  store the cache subscribes to, so they must live in the key. */
  showGrid: boolean;
  showLayerNames: boolean;
  wireframeMode: boolean;
}

/** Οι είσοδοι του BIM store που ανήκουν στο κλειδί — διαβάζονται τη στιγμή της σύγκρισης. */
export function readBimCacheInputs(): { drawingScale: number; bimSettingsHash: string } {
  const s = useBimRenderSettingsStore.getState();
  return {
    drawingScale: s.drawingScale,
    // ADR-452 — `cpa` (cutPlaneActive) busts the cache when the cut-plane hide
    // gate toggles; `viewRange.cutPlaneMm` (in `vr`) covers slider drag.
    // ADR-455 — the vertical X/Y cuts are NOT in this key: the cut-away side is faded by a
    // translucent overlay rect drawn ABOVE the bitmap (axis-cut-line-renderer), not baked
    // into entity pixels, so the bitmap is identical regardless of cut position. The
    // bim-render-settings subscription still marks the canvas dirty → the overlay repaints
    // on drag/flip/toggle without an (expensive) full entity-bitmap rebuild.
    // ADR-449/456 — `fs` (showFinishSkin) + `rebar` (showReinforcement) bust the cache:
    // both overlays are baked into the cached normal-state bitmap (scene-level passes in
    // `DxfRenderer.render`), so toggling them must rebuild it (they arrive via the store the
    // cache does NOT subscribe to — they must live in the key, like the ADR-040 Phase D toggles).
    // ADR-375 — `dxf` (dxfImport: «DXF Σχέδιο» V/G row) busts the cache: visibility +
    // colour + lineweight overrides for every raw DXF entity are baked into the cached
    // normal-state bitmap (DxfRenderer.isEntityLayerSkipped + resolveStyleForRender), so
    // toggling/recolouring/reweighting the imported drawing must rebuild it. Same rule as
    // fs/rebar — a per-view setting that alters normal-state pixels MUST live in the key.
    bimSettingsHash: JSON.stringify({ vr: s.viewRange, cpa: s.cutPlaneActive, os: s.objectStyles, ts: getCurrentOpeningTagStyle(), fs: s.showFinishSkin, rebar: s.showReinforcement, dxf: s.dxfImport }),
  };
}

/**
 * Το κλειδί που αντιστοιχεί στα pixels που μόλις γράφτηκαν.
 *
 * `viewport` = το **ΟΡΑΤΟ** viewport· το (overscanned) μέγεθος του ίδιου του raster παράγεται
 * από αυτό, άρα δεν αποθηκεύεται χωριστά.
 */
export function buildCacheKey(
  scene: DxfScene | null,
  viewport: Viewport,
  inputs: BitmapCacheRenderInputs,
  dpr: number,
): CacheKey {
  const { drawingScale, bimSettingsHash } = readBimCacheInputs();
  return {
    sceneRef: scene,
    width: viewport.width,
    height: viewport.height,
    dpr,
    activeAnnotationScale: getActiveScaleName(),
    drawingScale,
    bimSettingsHash,
    showGrid: !!inputs.showGrid,
    showLayerNames: !!inputs.showLayerNames,
    wireframeMode: !!inputs.wireframeMode,
  };
}

/**
 * Άλλαξε δομική είσοδος από τότε που χτίστηκε το `key`;
 *
 * ⚠️ **ΠΟΤΕ δεν αναστέλλεται μέσα σε χειρονομία** (ADR-726 Φ3.1): αν άλλαξαν τα pixels, το παλιό
 * raster δείχνει κάτι που **δεν υπάρχει πια** — αυτό δεν είναι θολούρα, είναι λάθος περιεχόμενο.
 */
export function isStructurallyStale(
  key: CacheKey | null,
  scene: DxfScene | null,
  viewport: Viewport,
  inputs: BitmapCacheRenderInputs,
  dpr: number,
): boolean {
  if (!key) return true;
  const { drawingScale, bimSettingsHash } = readBimCacheInputs();
  return (
    key.sceneRef !== scene ||
    key.width !== viewport.width ||
    key.height !== viewport.height ||
    key.dpr !== dpr ||
    key.activeAnnotationScale !== getActiveScaleName() ||
    key.drawingScale !== drawingScale ||
    key.bimSettingsHash !== bimSettingsHash ||
    key.showGrid !== !!inputs.showGrid ||
    key.showLayerNames !== !!inputs.showLayerNames ||
    key.wireframeMode !== !!inputs.wireframeMode
  );
}
