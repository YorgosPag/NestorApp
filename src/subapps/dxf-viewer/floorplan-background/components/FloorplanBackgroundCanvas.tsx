'use client';

/**
 * ⚠️  ARCHITECTURE-CRITICAL FILE — READ ADR-040 + ADR-732 BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 * docs/centralized-systems/reference/adrs/ADR-732-2d-canvas-layer-consolidation.md
 *
 * useFloorplanBackgroundPainter — η raster κάτοψη ως pass του κοινού καμβά ζώνης Α.
 *
 * ADR-732 Batch 2 — δεν κατέχει `<canvas>`: επιστρέφει «painter ή null» (ADR-726 Φ2)
 * για τον `UnderlayDispatchCanvas`, ΠΑΝΩ από το grid pass (Giorgio 2026-06-05: ο κάναβος
 * ΚΑΤΩ από την κάτοψη). Η βαθμονόμηση (calibration point picking) είναι η ΜΟΝΗ διάδραση
 * της ζώνης Α — εκτίθεται ως `isCalibrating` + `onCalibrationClick` ώστε ο κοινός καμβάς
 * να γίνεται interactive ΜΟΝΟ όσο διαρκεί η συνεδρία βαθμονόμησης (σπάνιο, user-triggered).
 *
 * Ο μετασχηματισμός view διαβάζεται `getImmediateTransform()` στο draw/click time
 * (ADR-040 XXII.B) — ο painter αγνοεί το `t` όρισμα του primitive (η κάτοψη κουβαλά τον
 * δικό της BackgroundTransform μέσα στο `worldToCanvas`).
 */

import { useCallback, useMemo } from 'react';
import type { OverlayDispatchPainter } from '../../components/dxf-layout/overlay-dispatch/overlay-dispatch-frame';
import { useFloorplanBackground } from '../hooks/useFloorplanBackground';
import { useFloorplanBackgroundStore } from '../stores/floorplanBackgroundStore';
import { getImmediateTransform } from '../../systems/cursor/ImmediateTransformStore';
import type { CadCoordinateAdaptation } from '../providers/types';
import type { CalibrationSession } from '../stores/floorplanBackgroundStore';
import type { Point2D } from '../providers/types';

// ── Public API ────────────────────────────────────────────────────────────────

export interface FloorplanBackgroundPainterResult {
  /** «Painter ή null» για τον κοινό καμβά ζώνης Α (κάτοψη + σημάδια βαθμονόμησης). */
  readonly painter: OverlayDispatchPainter | null;
  /** true όσο τρέχει calibration session για ΑΥΤΟΝ τον όροφο — ο καμβάς γίνεται interactive. */
  readonly isCalibrating: boolean;
  /** Click handler του calibration point picking — δένεται στον κοινό καμβά μόνο όσο isCalibrating. */
  readonly onCalibrationClick: (e: React.MouseEvent<HTMLCanvasElement>) => void;
}

/**
 * @param floorId null ⇒ κανένας ενεργός όροφος ⇒ painter null (η ζώνη δεν πληρώνει τίποτα).
 * @param cad Optional CAD adaptation (Y-flip + margins). Required for DXF integration.
 *   Πέρνα σταθερή αναφορά (module const / useMemo) — είναι dep του painter memo.
 */
export function useFloorplanBackgroundPainter(
  floorId: string | null,
  cad?: CadCoordinateAdaptation,
): FloorplanBackgroundPainterResult {
  // '' = ανύπαρκτο slot ⇒ background null (rules-of-hooks: η κλήση είναι άνευ όρων).
  const { background, provider } = useFloorplanBackground(floorId ?? '');
  const calibrationSession = useFloorplanBackgroundStore((s) => s.calibrationSession);
  const isCalibrating = floorId != null && calibrationSession?.floorId === floorId;

  // Reference-stable painter: νέα ταυτότητα ΜΟΝΟ σε πραγματική αλλαγή περιεχομένου.
  // ADR-726 Φ2 — χωρίς ορατή κάτοψη ΚΑΙ χωρίς σημάδια βαθμονόμησης: null (ο καμβάς άθικτος).
  const painter = useMemo<OverlayDispatchPainter | null>(() => {
    if (floorId == null) return null;
    // `const` bindings ⇒ το narrowing επιβιώνει μέσα στο closure του painter (χωρίς `!`, N.2).
    const visibleBackground = background?.visible ? background : null;
    const activeProvider = visibleBackground ? provider : null;
    const showsMarkers = hasCalibrationMarkers(calibrationSession, floorId);
    if (!(visibleBackground && activeProvider) && !showsMarkers) return null;

    return (ctx, _t, vp) => {
      if (visibleBackground && activeProvider) {
        activeProvider.render(ctx, {
          transform: visibleBackground.transform,
          // Zero-lag view transform από το SSoT στο draw time (XXII.B).
          worldToCanvas: getImmediateTransform(),
          viewport: vp,
          opacity: visibleBackground.opacity,
          cad,
        });
      }
      _drawCalibrationMarkers(ctx, calibrationSession, floorId);
    };
  }, [floorId, background, provider, calibrationSession, cad]);

  // Click handler for calibration point picking — reads fresh store state.
  // Event-time transform read (cardinal rule #2) — όχι από snapshot.
  const onCalibrationClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const { calibrationSession: session, setCalibrationPoint } =
      useFloorplanBackgroundStore.getState();
    if (floorId == null || session?.floorId !== floorId) return;
    if (session.pointA && session.pointB) return; // both already set, waiting for dialog
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    // CSS-space coords — the ctx is DPR-scaled (sizeCanvasToViewport), so markers are drawn in CSS
    // units. `rect` is CSS px → the raw offset already IS the CSS coordinate (no dpr scaling here,
    // else the marker would double under the ctx transform).
    setCalibrationPoint(
      { x: e.clientX - rect.left, y: e.clientY - rect.top },
      getImmediateTransform().scale,
    );
  }, [floorId]);

  return { painter, isCalibrating, onCalibrationClick };
}

// ── Canvas drawing helpers (module-level, no closure captures) ────────────────

/**
 * ADR-726 Φ2 — ΜΙΑ πηγή για την ερώτηση «θα ζωγραφιστεί σημάδι βαθμονόμησης;». Την ρωτά και η
 * πύλη (μέσω του painter-null) και ο ίδιος ο painter, ώστε οι δύο απαντήσεις να μην μπορούν να
 * ξεσυγχρονιστούν και να αφήσουν φάντασμα ή κενό.
 */
function hasCalibrationMarkers(
  session: CalibrationSession | null,
  floorId: string,
): session is CalibrationSession {
  if (!session || session.floorId !== floorId) return false;
  return !!session.pointA || !!session.pointB;
}

function _drawCalibrationMarkers(
  ctx: CanvasRenderingContext2D,
  session: CalibrationSession | null,
  floorId: string,
): void {
  if (!hasCalibrationMarkers(session, floorId)) return;
  ctx.save();
  if (session.pointA && session.pointB) _drawCalibrationLine(ctx, session.pointA, session.pointB);
  if (session.pointA) _drawCrosshair(ctx, session.pointA, '#00D4FF');
  if (session.pointB) _drawCrosshair(ctx, session.pointB, '#FF6B6B');
  ctx.restore();
}

function _drawCrosshair(ctx: CanvasRenderingContext2D, pt: Point2D, color: string): void {
  const size = 10;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(pt.x - size, pt.y);
  ctx.lineTo(pt.x + size, pt.y);
  ctx.moveTo(pt.x, pt.y - size);
  ctx.lineTo(pt.x, pt.y + size);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
  ctx.stroke();
}

function _drawCalibrationLine(ctx: CanvasRenderingContext2D, a: Point2D, b: Point2D): void {
  ctx.strokeStyle = '#00D4FF';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.setLineDash([]);
}
