/**
 * scene-manager-tick — τι ακριβώς σχεδιάζεται σε ΕΝΑ καρέ της 3D σκηνής (ADR-549 Φ4).
 *
 * Εξαγωγή από τον `ThreeJsSceneManager` (N.7.1 — 510/500 γραμμές): ο manager κρατά την **κατάσταση**
 * (`_redraw`, `lastTickTime`) και το lifecycle· εδώ ζει η **απόφαση διαδρομής** ενός καρέ, που είναι
 * καθαρή συνάρτηση των ορισμάτων της και δοκιμάζεται χωρίς να στηθεί ολόκληρος manager.
 *
 * ⚠️ Ο καλών οφείλει να έχει ΗΔΗ μηδενίσει το `RedrawLevel` του πριν μπει εδώ (consume-before-render,
 * ADR-549 Φ4) — ώστε ένα `markSceneDirty` που πυροδοτείται ΜΕΣΑ στο render (subscription/callback) να
 * επιβιώνει για το επόμενο καρέ αντί να καταπίνεται από reset στο τέλος.
 *
 * @see ./scene-redraw-level.ts — το ordered επίπεδο· ./scene-render-frame.ts — οι δύο διαδρομές render
 * @see docs/centralized-systems/reference/adrs/ADR-549-3d-cursor-swim-render-loop.md §Φ4
 */

import { renderSceneFrame, renderHoverOnlyFrame, type RenderFrameContext } from './scene-render-frame';
import { isOverlayOnlyRedraw, type RedrawLevel } from './scene-redraw-level';
import { recordRender, type Bim3DRenderSample } from './bim3d-perf-diag';

/**
 * 🔬 ADR-549 Φ0 (revertible) — `dxf-no-render`='1' κόβει ΟΛΟ το scene render, ώστε να μετρηθεί A/B
 * το κόστος του. Απομονωμένο εδώ ώστε η αφαίρεση του διαγνωστικού να είναι μία διαγραφή.
 */
export function isSceneRenderDisabledByDiagFlag(): boolean {
  return typeof window !== 'undefined' && window.localStorage.getItem('dxf-no-render') === '1';
}

/**
 * Σχεδίασε ένα καρέ στο επίπεδο που ζητήθηκε.
 *
 * `OVERLAY` → φθηνή διαδρομή: blit του cached beauty + επανασχεδίαση μόνο του outline (~1-2ms αντί
 * ~40ms, ADR-549 Φ3). Σε **cache miss** πέφτει στο πλήρες render — γι' αυτό το `renderHoverOnlyFrame`
 * επιστρέφει boolean αντί να πετάει. Το `isOverlayOnlyRedraw` αποκλείει το `FULL` **by construction**:
 * δεν υπάρχει χειροκίνητο `&& !sceneDirty` guard που να μπορεί να ξεχαστεί (ήταν πηγή race).
 */
export function renderTickFrame(
  frameContext: RenderFrameContext,
  level: RedrawLevel,
  now: number,
  delta: number,
  diagSample: Bim3DRenderSample,
): void {
  if (isOverlayOnlyRedraw(level) && renderHoverOnlyFrame(frameContext)) return;
  const diagStart = performance.now();
  renderSceneFrame(frameContext, now, delta);
  recordRender(performance.now() - diagStart, diagSample);
}

/**
 * ADR-366 §B.5 — το καρέ ως data-URL (HUD screenshot). Το σύγχρονο render και το `toDataURL` ΠΡΕΠΕΙ
 * να γίνουν στο **ίδιο task**: αλλιώς ο browser έχει ήδη καθαρίσει το drawing buffer και επιστρέφει
 * κενή εικόνα — γι' αυτό δεν αρκεί να διαβαστεί ο καμβάς μετά από έναν κανονικό tick, και γι' αυτό
 * δεν χρειάζεται το ακριβό `preserveDrawingBuffer` στον renderer.
 */
export function captureFrameDataURL(
  frameContext: RenderFrameContext,
  canvas: HTMLCanvasElement,
  type = 'image/png',
  quality?: number,
): string {
  renderSceneFrame(frameContext, performance.now(), 0);
  return canvas.toDataURL(type, quality);
}
