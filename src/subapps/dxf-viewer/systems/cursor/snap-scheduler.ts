/**
 * SNAP SCHEDULER — decoupled draw-snap detection (ADR-040 cursor-lag Φ11, Revit/AutoCAD-grade)
 *
 * THE PROBLEM: `findSnapPoint` is heavy synchronous main-thread work. While it
 * ran INSIDE the `mousemove` event handler it kept the event handler busy, so the
 * compositor could not present the freshly-written crosshair `translate3d` until
 * the handler returned → the crosshair trailed the physical cursor under load.
 *
 * THE FIX (how the big CAD apps do it): the cursor/crosshair channel and the snap
 * channel are DECOUPLED. The mousemove handler only ARMS this scheduler with the
 * latest pointer state (cheap) and returns immediately — the crosshair updates
 * synchronously and presents without waiting for snap. The heavy snap detection
 * then runs in a SEPARATE frame slot on the EXISTING RAF SSoT
 * (`UnifiedFrameScheduler` — NOT a new requestAnimationFrame loop), at most once
 * per frame, coalescing intermediate moves, and writes the snap SSoT
 * (`ImmediateSnapStore`). The snap marker therefore lands ≤1 frame later, which
 * is imperceptible, while the crosshair stays 1:1.
 *
 * ⚠️ ΠΟΣΟ ΑΚΡΙΒΩΣ ΚΟΣΤΙΖΕΙ — ΜΕΤΡΗΜΕΝΟ, ΟΧΙ ΕΙΚΑΣΙΑ. Η κεφαλίδα αυτή έγραφε «1-5ms»
 * από το ADR-040 Φ11 και ΔΕΝ ξαναμετρήθηκε ποτέ, ενώ στο μεταξύ προστέθηκαν engines
 * (ADR-597 BIM ×3, ADR-378 TEXT, ADR-408 MEP, ADR-580 grips, ADR-642 complex ×3) και το
 * σχέδιο μεγάλωσε. Μέτρηση 2026-07-29 με το όργανο του ADR-726 (`__dxfPerf`), σχέδιο
 * 2.910 οντοτήτων στο 1:1361, ορατή+εστιασμένη καρτέλα, `pan-pending` 60/60:
 * `frame:snap-detection` **avg 24,2ms · min 22,1ms**, δηλαδή **75-88%** του `frame:TOTAL`.
 * Ένας αριθμός σε σχόλιο χωρίς ημερομηνία και χωρίς όργανο είναι παγίδα για τον επόμενο
 * (ADR-728 §2.1 / §7.3) — γι' αυτό εδώ υπάρχουν και τα τρία.
 *
 * ΑΝΑΣΤΟΛΗ ΚΑΤΑ ΤΗ ΠΛΟΗΓΗΣΗ (ADR-728 Φ1): αυτή η δουλειά ΔΕΝ τρέχει όσο ο χρήστης
 * μετακινεί την οθόνη — βλ. τον guard στο `onSnapFrame` και το `NavigationGestureStore`.
 *
 * SSoT: this module is the SOLE owner of draw-snap detection scheduling + the
 * snap-dedup state. `ImmediateSnapStore` remains the snap-RESULT SSoT (read by
 * `SnapIndicatorSubscriber`). Grip-drag snap stays synchronous in the handler
 * (it needs a 1:1 ghost) and is intentionally NOT routed here.
 *
 * @module systems/cursor/snap-scheduler
 */

import { registerRenderCallback, RENDER_PRIORITIES } from '../../rendering';
import { PANEL_LAYOUT } from '../../config/panel-tokens';
import { setImmediateSnap, clearImmediateSnap, setFullSnapResult } from './ImmediateSnapStore';
// ADR-560 — grip-drag ownership guard: skip the decoupled scheduler while a grip drag owns the snap.
import { getActiveDragGrip } from './GripDragStore';
// ADR-728 Φ1 — SSoT «είμαστε σε χειρονομία πλοήγησης;» (ΕΝΑ ερώτημα, όχι σκόρπιο isPanning).
import { isNavigationGesture } from '../navigation/NavigationGestureStore';
import { findColumnDrawCornerSnap } from '../../bim/columns/column-corner-snap';
import { resolveColumnDrawSnap } from '../../bim/columns/column-placement-snap-context';
import { clearColumnGhostStatus } from './ColumnPlacementGhostStatusStore';
import { columnToolBridgeStore } from '../../ui/ribbon/hooks/bridge/column-tool-bridge-store';
import type { ProSnapResult } from '../../snapping/extended-types';
import type { SnapResultItem } from './mouse-handler-types';
import type { Point2D } from '../../rendering/types/Types';

/** Inputs the scheduler needs to compute one snap detection pass. */
export interface SnapDetectionInput {
  readonly worldPos: Point2D;
  /** Active tool id; optional to mirror `CentralizedMouseHandlersProps.activeTool` (only `=== 'column'` is read). */
  readonly activeTool: string | undefined;
  readonly findSnapPoint: (x: number, y: number) => ProSnapResult | null;
  /** Gated React snap-state setter (LayerCanvas draw); a no-op for opted-out consumers. */
  readonly setSnapResults: (results: SnapResultItem[]) => void;
}

// ── Module-level SSoT state (zero-React singleton, à la ImmediatePositionStore) ──
let latest: SnapDetectionInput | null = null;
let dirty = false;
let lastRunMs = 0;
let lastSnapX = NaN;
let lastSnapY = NaN;
let lastSnapFound = false;
let registered = false;

/** Reset the snap indicator + dedup state, clearing every snap SSoT channel. */
function clearSnapState(setSnapResults: (r: SnapResultItem[]) => void): void {
  if (!lastSnapFound) return;
  setSnapResults([]);
  setFullSnapResult(null);
  clearImmediateSnap();
  lastSnapFound = false;
  lastSnapX = NaN;
  lastSnapY = NaN;
}

/**
 * SSoT — δημοσιεύει ένα **ορατό** snap αποτέλεσμα (React marker + `fullSnapResult` για τη γλυφή/
 * ετικέτα του `SnapIndicatorOverlay`). Κοινό σε κύριο path ΚΑΙ column corner-projection (μηδέν διπλότυπο).
 */
function publishSnapMarker(input: SnapDetectionInput, snapResult: ProSnapResult): void {
  if (!snapResult.snappedPoint) return;
  input.setSnapResults([{
    point: snapResult.snappedPoint,
    type: snapResult.activeMode || 'default',
    entityId: snapResult.snapPoint?.entityId || null,
    distance: snapResult.snapPoint?.distance || 0,
    priority: 0,
  }]);
  setFullSnapResult(snapResult);
}

/** The heavy work — runs in the RAF slot, NEVER inside the mousemove handler. */
function runSnapDetection(input: SnapDetectionInput): void {
  const colHandle = input.activeTool === 'column' ? columnToolBridgeStore.get() : null;
  try {
    // ADR-398 §3.10 — το column **face-snap** (παρειές δοκαριού/τοίχου/κολώνας/πλάκας) υπολογίζεται
    // πλέον ΣΥΓΧΡΟΝΑ στο preview (`column-preview-helpers`) + στο commit (`mouse-handler-up`) από
    // τους pre-collected στόχους (`columnPreviewStore`), όπως ακριβώς τοίχος/δοκάρι. Ο scheduler
    // κρατά ΜΟΝΟ ό,τι χρειάζεται `findSnapPoint`: το corner-projection + τη δημοσίευση γλυφής/
    // ετικέτας + το `ImmediateSnap` (από όπου ο sync resolver παίρνει τον effective cursor —
    // BIM χαρακτηριστικό / corner-aligned / grid → μαγνητική έλξη ΔΩΡΕΑΝ, mirror τοίχου/δοκαριού).
    // ADR-398 — Column draw: the would-be column's corners project onto targets, AND the
    // crosshair queries the unified snap (BIM corner/mid/center + beam-axis). `resolveColumnDrawSnap`
    // picks Revit-grade: visible corner-projection > visible cursor characteristic > silent grid
    // alignment. (Bugfix: a corner-projection landing on a SILENT grid no longer hides the BIM
    // characteristic snap under the crosshair.) Non-column tools keep the plain cursor snap.
    let snapResult: ProSnapResult | null;
    let ghostPoint: Point2D | null;
    if (colHandle?.isActive) {
      const drawCorner = findColumnDrawCornerSnap(
        input.worldPos,
        { ...colHandle.overrides, kind: colHandle.kind, anchor: colHandle.anchor },
        colHandle.getSceneUnits(),
        input.findSnapPoint,
      );
      const resolved = resolveColumnDrawSnap(input.worldPos, drawCorner, input.findSnapPoint);
      snapResult = resolved?.snapResult ?? null;
      ghostPoint = resolved?.ghostPoint ?? null;
    } else {
      snapResult = input.findSnapPoint(input.worldPos.x, input.worldPos.y);
      ghostPoint = snapResult?.snappedPoint ?? null;
    }

    if (snapResult && snapResult.found && snapResult.snappedPoint && ghostPoint) {
      const sx = snapResult.snappedPoint.x;
      const sy = snapResult.snappedPoint.y;
      const snapMoved = Math.abs(sx - lastSnapX) > 0.001 || Math.abs(sy - lastSnapY) > 0.001;

      if (snapMoved || !lastSnapFound) {
        lastSnapX = sx;
        lastSnapY = sy;
        publishSnapMarker(input, snapResult);
        setImmediateSnap({
          found: true,
          // ADR-398 — ghost anchor follows the corner-aligned cursor (when a corner won).
          point: ghostPoint,
          mode: snapResult.activeMode || 'endpoint',
          entityId: snapResult.snapPoint?.entityId,
        });
      }
      lastSnapFound = true;
    } else {
      clearSnapState(input.setSnapResults);
    }

    // ADR-398 §3.10 — όχι column → καθάρισε το commit-handoff store (faceAnchor/status).
    if (!colHandle?.isActive) clearColumnGhostStatus();
  } catch {
    clearSnapState(input.setSnapResults);
    clearColumnGhostStatus();
  }
}

/**
 * Frame callback registered ONCE with the UnifiedFrameScheduler. Runs only when
 * `dirty` (gated by `isDirty` below); applies the snap throttle so detection
 * stays ~30fps regardless of frame rate. Keeps `dirty` set when throttled so the
 * scheduler retries on the next frame.
 */
function onSnapFrame(): void {
  const input = latest;
  if (!input) { dirty = false; return; }
  // ADR-560 — while a GRIP DRAG is active the synchronous grip handler owns the snap SSoT
  // (column-corner projection etc.). This decoupled scheduler MUST NOT run its generic
  // raw-cursor `findSnapPoint` here: it would overwrite the grip's VISIBLE corner snap with a
  // generic (often SILENT grid) cursor snap → the column-corner marker vanishes / the attraction
  // goes to grid. Column-specific symptom (lines have no corner-projection, so generic == expected).
  // Guard on the imperative `getActiveDragGrip()` (stable for the whole drag) — NOT the React
  // `isGripDragging` prop, which flickers and let stale-armed frames slip through. Bail WITHOUT
  // clearing the store, so the grip handler's result stands.
  if (getActiveDragGrip()) { dirty = false; return; }
  // ADR-728 Φ1 — ΑΝΑΣΤΟΛΗ ΚΑΤΑ ΤΗ ΧΕΙΡΟΝΟΜΙΑ ΠΛΟΗΓΗΣΗΣ (Revit/AutoCAD parity).
  // Όσο ο χρήστης μετακινεί την οθόνη δεν σχεδιάζει: τα σημεία έλξης που θα υπολογίζαμε
  // δεν τα βλέπει και δεν τα χρησιμοποιεί κανείς — και ο υπολογισμός κάθεται ΜΠΡΟΣΤΑ από
  // τη ζωγραφική στην ίδια σειριακή ουρά του `UnifiedFrameScheduler` (ADR-728 §3.6).
  // Μετρημένο στον browser 2026-07-29 (pan, 2.910 οντότητες, 1:1361, focus+visible,
  // `pan-pending` 60/60): `frame:snap-detection` avg 24,2ms / **min 22,1ms** = 75-88% του
  // `frame:TOTAL`· με OSNAP off (control group) το `frame:TOTAL` πέφτει 27,2 → 6,3ms.
  //
  // 🔴 Bail WITHOUT clearing the store — ΙΔΙΟ σχήμα με τον grip guard από πάνω, και εδώ
  // είναι ΚΡΙΣΙΜΟ: το `ImmediateSnapStore` ΔΕΝ είναι μόνο δείκτης, είναι το **σημείο
  // commit** για κολώνα/δοκάρι/τοίχο (`resolveEffectivePreviewCursor` → σιωπηλό fallback
  // στον raw cursor όταν είναι κενό· `mouse-handler-up` ΔΕΝ ξανακαλεί `findSnapPoint` εκεί
  // by design). Καθάρισμά του μέσα στο παράθυρο αναστολής ⇒ γεωμετρία τοποθετημένη ΕΚΤΟΣ
  // OSNAP, σιωπηλά. Ένα snap point ζει σε ΚΟΣΜΙΚΕΣ συντεταγμένες: δεν γίνεται λάθος επειδή
  // κινήθηκε η κάμερα. «Μην υπολογίζεις τώρα» ≠ «σβήσε ό,τι υπολογίστηκε» (ADR-728 §8.7).
  if (isNavigationGesture()) { dirty = false; return; }
  const now = performance.now();
  if (now - lastRunMs < PANEL_LAYOUT.TIMING.SNAP_DETECTION_THROTTLE) return; // retry next frame
  lastRunMs = now;
  dirty = false;
  runSnapDetection(input);
}

function ensureRegistered(): void {
  if (registered) return;
  registered = true;
  registerRenderCallback(
    'snap-detection',
    'Snap Detection (decoupled — ADR-040 Φ11)',
    RENDER_PRIORITIES.NORMAL,
    onSnapFrame,
    () => dirty,
  );
}

/**
 * Arm the scheduler with the latest pointer state. Called per move from the
 * mousemove handler — cheap (store + flag), the actual `findSnapPoint` runs later
 * in the RAF slot. Coalesces: only the latest armed state is ever computed.
 */
export function requestSnapDetection(input: SnapDetectionInput): void {
  ensureRegistered();
  latest = input;
  dirty = true;
}

/**
 * Clear the snap indicator (snap disabled / leaving snappable mode). Idempotent —
 * does nothing if no snap is currently shown.
 */
export function clearSnapDetection(setSnapResults: (r: SnapResultItem[]) => void): void {
  latest = null;
  dirty = false;
  clearColumnGhostStatus(); // ADR-398 §Column→Beam axis snap — reset ghost χρωματισμό
  clearSnapState(setSnapResults);
}
