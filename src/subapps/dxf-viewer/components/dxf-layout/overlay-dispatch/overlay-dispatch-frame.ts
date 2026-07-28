/**
 * ⚠️  ARCHITECTURE-CRITICAL — READ ADR-040 + ADR-552 + ADR-554 + ADR-726 BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 * docs/centralized-systems/reference/adrs/ADR-552-analytical-overlay-dispatch-canvas.md
 * docs/centralized-systems/reference/adrs/ADR-554-proposal-dispatch-canvas.md
 * docs/centralized-systems/reference/adrs/ADR-726-frame-budget-instrumentation-and-attribution.md
 *
 * Overlay frame renderer — ο ΕΝΑΣ pull-model frame renderer κάθε overlay `<canvas>` του 2D
 * viewer. Καλύπτει και τα δύο σχήματα:
 *   • **dispatch canvas** (N overlays → 1 καμβάς, ADR-551 §5.3): analytical (ADR-552),
 *     MEP proposal ghosts (ADR-554).
 *   • **single-painter overlay** (1 overlay → 1 καμβάς): envelope, floor-underlay, mep-wires,
 *     grid, topo-grid, container gizmo, missing-font, floorplan background — ADR-726 Φ2.
 *
 * **Pull model:** ο renderer κάνει sizing (DPR-aware) + clear **ΜΙΑ** φορά, μετά καλεί κάθε
 * ενεργό painter με σειρά (z-). Ένας painter ΠΟΤΕ δεν κάνει clear/resize (αλλιώς οι painters
 * θα σβήνανε ο ένας τον άλλον — ο λόγος που το imperative push του `PreviewCanvas` δεν ταιριάζει
 * σε multi-painter καμβά).
 *
 * ## 🚦 Η πύλη πριν το clear (ADR-726 Φ2) — γιατί ζει ΕΔΩ και όχι σε 9 αρχεία
 *
 * Το εύρημα ADR-726 §4.Γ: 9 καμβάδες εξέδιδαν 131–148 `clearRect` ο καθένας **με μηδέν draw ops**.
 * Ένα `clearRect` σε ήδη-άδειο καμβά ακυρώνει ολόκληρο το compositor layer (βλ. τεκμηρίωση στο
 * `overlay-canvas-clear-state.ts` — Blink `HTMLCanvasElement::DidDraw`, χωρίς σύγκριση pixels).
 *
 * Η πύλη είναι **ΕΝΑ** primitive, εδώ, επειδή το ακριβώς αντίστοιχο λάθος έχει ήδη γίνει στο
 * έργο: το `if (options.grips) renderGrips()` αντιγράφηκε σε **7** BIM renderers αντί να ζήσει
 * σε `BaseEntityRenderer.finalizeRender()` (N.0.2). Κάθε overlay εκφράζει «έχω περιεχόμενο;»
 * με το μόνο πράγμα που ήδη ξέρει — έναν `painter` ή `null` — και **δεν ξέρει τίποτα** για το
 * clear, το DPR sizing ή το ledger.
 *
 * ⚠️ **ΜΗΝ** αντιγράψεις την πύλη σε call site. Το `npm run jscpd:diff` (CHECK 3.28) θα σε πιάσει.
 */

import { CanvasUtils } from '../../../rendering/canvas/utils/CanvasUtils';
import type { ViewTransform, Viewport } from '../../../rendering/types/Types';
import {
  isOverlayCanvasClear,
  markOverlayCanvasCleared,
  markOverlayCanvasPainted,
} from './overlay-canvas-clear-state';

/**
 * One overlay layer's painter. Receives `transform`/`viewport` as args (not capture) so it stays
 * memoized on its own low-freq data and does not change identity on every pan/zoom. It only DRAWS
 * its content — never clears/resizes the shared canvas.
 *
 * **`null` ⇒ «δεν έχω τίποτα να ζωγραφίσω αυτό το καρέ»** — αυτή είναι ολόκληρη η δήλωση
 * περιεχομένου που χρειάζεται η πύλη (ADR-726 Φ2). Ένας painter που τρέχει και δεν ζωγραφίζει
 * τίποτα είναι έγκυρος αλλά υποβέλτιστος: ο καμβάς θα θεωρηθεί «με μελάνι» και το επόμενο άδειο
 * καρέ θα πληρώσει ένα (μοναδικό) περιττό clear. Προτίμησε να επιστρέψεις `null`.
 */
export type OverlayDispatchPainter = (
  ctx: CanvasRenderingContext2D,
  transform: ViewTransform,
  viewport: Viewport,
) => void;

/** `true` αν έστω ένας painter είναι ενεργός. Χωρίς allocation (καλείται ανά καρέ). */
function hasActivePainter(painters: ReadonlyArray<OverlayDispatchPainter | null>): boolean {
  for (const paint of painters) {
    if (paint) return true;
  }
  return false;
}

/**
 * Size (DPR-aware) → πύλη → clear → paint κάθε ενεργού painter με σειρά.
 *
 * Συμβόλαιο (ADR-726 Φ2):
 * | Κατάσταση | Πράξεις στον καμβά |
 * |---|---|
 * | ≥1 ενεργός painter | `clearRect` **μία** φορά, μετά οι painters |
 * | μηδέν painters, καμβάς **με** μελάνι | `clearRect` **μία** φορά· τίποτα άλλο |
 * | μηδέν painters, καμβάς ήδη **καθαρός** | **ΚΑΜΙΑ** — ο καμβάς δεν αγγίζεται καθόλου |
 *
 * Το sizing τρέχει **πάντα** (και όταν η πύλη κλείνει): είναι idempotent — το
 * `CanvasUtils.sizeCanvasToViewport` γράφει `canvas.width/height` μόνο σε πραγματική αλλαγή, και
 * το `setTransform` είναι state, όχι draw op (δεν καλεί `DidDraw`, δεν ακυρώνει layer). Έτσι ένας
 * κρυφός καμβάς παραμένει σωστά διαστασιολογημένος για τη στιγμή που θα αποκτήσει περιεχόμενο.
 *
 * No-op όταν το 2D context δεν είναι διαθέσιμο.
 */
export function paintOverlayDispatchFrame(
  canvas: HTMLCanvasElement,
  painters: ReadonlyArray<OverlayDispatchPainter | null>,
  transform: ViewTransform,
  viewport: Viewport,
): void {
  // 🏢 SSoT sizing — DPR-aware backing store via the ONE primitive (CanvasUtils.sizeCanvasToViewport),
  // shared with dxf/layer/preview/grid/floorplan. This block was byte-identical to the primitive; it
  // now delegates so there is a single source of truth for canvas-layer sizing.
  const ctx = CanvasUtils.sizeCanvasToViewport(canvas, viewport);
  if (!ctx) return;

  if (!hasActivePainter(painters)) {
    // 🚦 ADR-726 Φ2 — τίποτα να ζωγραφιστεί. Αν ο καμβάς είναι ήδη καθαρός, ΜΗΝ τον αγγίξεις:
    // ένα clearRect εδώ θα ακύρωνε ολόκληρο το compositor layer για μηδέν οπτική διαφορά.
    if (isOverlayCanvasClear(canvas)) return;
    ctx.clearRect(0, 0, viewport.width, viewport.height);
    markOverlayCanvasCleared(canvas);
    return;
  }

  ctx.clearRect(0, 0, viewport.width, viewport.height);
  // Σημειώνεται ΠΡΙΝ τρέξουν οι painters: αν κάποιος πετάξει, ο καμβάς μένει μερικώς
  // ζωγραφισμένος και το επόμενο άδειο καρέ ΟΦΕΙΛΕΙ να τον καθαρίσει.
  markOverlayCanvasPainted(canvas);

  for (const paint of painters) {
    if (paint) paint(ctx, transform, viewport);
  }
}
