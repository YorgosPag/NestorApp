'use client';

/**
 * ⚠️  ARCHITECTURE-CRITICAL FILE — READ ADR-040 BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 *
 * ADR-399 Phase D — 2D «Όλοι οι όροφοι» underlay (AutoCAD xref / Revit underlay).
 *
 * Dedicated **read-only** overlay canvas που ζωγραφίζει τις κατόψεις DXF των
 * ΑΛΛΩΝ ορόφων του κτιρίου, ξεθωριασμένες, ΠΙΣΩ από τον ενεργό όροφο (z-[5] <
 * DxfCanvas z-10). Ενεργό μόνο όταν `floor3DScope==='all'` ΚΑΙ `mode==='2d'`.
 *
 * ADR-040 micro-leaf: subscribes ΜΟΝΟ εδώ (ViewMode3DStore scope/mode +
 * useFloors2DUnderlay → floorVisibilityModes/levels). Ο shell `CanvasLayerStack`
 * δεν αποκτά νέο `useSyncExternalStore` (CHECK 6C safe). Repaint σε αλλαγή
 * scene/transform/viewport (anchored στο world μέσω transform → pan/zoom redraw).
 *
 * **Selection/persistence isolation (κρίσιμο):** ξεχωριστό canvas ΧΩΡΙΣ
 * mouse/hit-test/selection handlers + `pointer-events-none`. Ο interactive
 * `DxfCanvasSubscriber` ξέρει μόνο τον ενεργό όροφο → αδύνατο να επιλεγεί/σωθεί
 * entity άλλου ορόφου σε λάθος `floorplanId`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-399-dxf-floor-navigation-tabs.md §Phase D
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { DxfRenderer } from '../../canvas-v2/dxf-canvas/DxfRenderer';
import { getDevicePixelRatio } from '../../systems/cursor/utils';
// ADR-726 Φ2 — sizing + πύλη + clear ζουν στο ΕΝΑ primitive· εδώ δηλώνεται μόνο «painter ή null».
import {
  paintOverlayDispatchFrame,
  type OverlayDispatchPainter,
} from './overlay-dispatch/overlay-dispatch-frame';
// ADR-040 Phase XXII.B — zero-lag: transform από το SSoT στο draw time + scheduler frame
// αντί για React prop (ιδίωμα HomeRunWiresOverlay).
import { getImmediateTransform } from '../../systems/cursor/ImmediateTransformStore';
import { subscribeImmediateTransformFrame } from '../../rendering/core/immediate-transform-frame';
import { useViewMode3DStore } from '../../bim-3d/stores/ViewMode3DStore';
import { useFloors2DUnderlay } from '../../hooks/data/useFloors2DUnderlay';
import type { DxfScene } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { Viewport } from '../../rendering/types/Types';

/**
 * Fraction of each underlay pixel's alpha removed via `destination-out` →
 * remaining ~35% opacity (AutoCAD xref fade, απόφαση Giorgio). Tunable.
 */
const UNDERLAY_FADE = 0.65;

export interface FloorUnderlayOverlayProps {
  readonly viewport: Viewport;
}

/**
 * Outer gate (ADR-732 Batch 2 — mount-on-demand, ιδίωμα SnapIndicatorSubscriber):
 * κατέχει ΜΟΝΟ τα low-freq subscriptions· χωρίς ενεργό underlay ΔΕΝ υπάρχει καν
 * canvas element στο DOM — μηδέν compositor layer στη συνήθη περίπτωση (ένας όροφος
 * ή scope≠all). Το `destination-out` fade απαιτεί ΔΙΚΟ του καμβά (θα έσβηνε ό,τι
 * ζωγραφίστηκε από κάτω σε κοινό) — γι' αυτό ΔΕΝ συγχωνεύεται στη ζώνη Α (ADR-732 §3).
 */
export function FloorUnderlayOverlay({ viewport }: FloorUnderlayOverlayProps) {
  // Leaf subscriptions (ADR-040): scope + render mode. Underlay only in 2D «all».
  const scope = useViewMode3DStore((s) => s.floor3DScope);
  const mode = useViewMode3DStore((s) => s.mode);
  const active = scope === 'all' && mode === '2d';

  // Non-active visible building floors → converted DxfScenes (SSoT visibility).
  const floors = useFloors2DUnderlay(active);

  // Merge into one read-only scene (single clear + single render pass).
  const merged = useMemo<DxfScene | null>(() => {
    if (floors.length === 0) return null;
    const entities = floors.flatMap((f) => f.scene.entities);
    if (entities.length === 0) return null;
    const layersById = Object.assign({}, ...floors.map((f) => f.scene.layersById ?? {}));
    return {
      entities,
      layers: Object.keys(layersById),
      layersById,
      bounds: null,
      units: floors[0].scene.units,
    };
  }, [floors]);

  if (!active || !merged) return null;
  return <FloorUnderlayCanvas merged={merged} viewport={viewport} />;
}

/** Inner canvas — mounted ΜΟΝΟ όσο υπάρχει ενεργό underlay περιεχόμενο. */
function FloorUnderlayCanvas({
  merged,
  viewport,
}: {
  readonly merged: DxfScene;
  readonly viewport: Viewport;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<DxfRenderer | null>(null);

  // Volatile low-freq inputs μέσω ref (ιδίωμα HomeRunWires: ref bundle + 2 effects).
  const drawStateRef = useRef({ merged, viewport });
  drawStateRef.current = { merged, viewport };

  // ADR-726 Φ2 — «painter ή null» είναι ΟΛΗ η δήλωση περιεχομένου· το DPR sizing, η πύλη και το
  // clear ζουν στο ΕΝΑ primitive. (Με το mount-on-demand ο painter εδώ είναι πάντα ενεργός —
  // το unmount είναι πλέον η ισχυρότερη μορφή της πύλης: ούτε στρώμα, όχι απλώς όχι clear.)
  const repaint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { merged: mergedScene, viewport: vp } = drawStateRef.current;

    const painter: OverlayDispatchPainter | null =
      mergedScene
        ? (ctx, t, pvp) => {
            if (!rendererRef.current) rendererRef.current = new DxfRenderer(canvas);
            rendererRef.current.render(mergedScene, t, pvp, {
              showGrid: false,
              showLayerNames: false,
              wireframeMode: false,
              selectedEntityIds: [],
              skipInteractive: true,
            });

            // AutoCAD xref fade — uniform alpha reduction that preserves colours and keeps
            // empty areas transparent (destination-out) so the active floor (above) and the
            // floorplan background (below) composite correctly.
            const dpr = getDevicePixelRatio();
            ctx.save();
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.globalCompositeOperation = 'destination-out';
            ctx.globalAlpha = UNDERLAY_FADE;
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, pvp.width, pvp.height);
            ctx.restore();
          }
        : null;

    paintOverlayDispatchFrame(canvas, [painter], getImmediateTransform(), vp);
  }, []);

  // (α) Repaint σε content change (floors/viewport) με ΑΚΙΝΗΤΟ transform.
  useEffect(() => {
    repaint();
  }, [merged, viewport, repaint]);

  // (β) Zero-lag pan/zoom — scheduler frame gated στο immediate transform (XXII.B).
  useEffect(() => {
    return subscribeImmediateTransformFrame('floor-underlay', 'Floor Underlay', repaint);
  }, [repaint]);

  return (
    <canvas
      ref={canvasRef}
      data-dxf-overlay="floor-underlay"
      className="pointer-events-none absolute inset-0 h-full w-full z-[5]"
      aria-hidden="true"
    />
  );
}
