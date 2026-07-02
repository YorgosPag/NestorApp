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

import { useEffect, useMemo, useRef } from 'react';
import { DxfRenderer } from '../../canvas-v2/dxf-canvas/DxfRenderer';
import { getDevicePixelRatio } from '../../systems/cursor/utils';
import { CanvasUtils } from '../../rendering/canvas/utils/CanvasUtils';
import { useViewMode3DStore } from '../../bim-3d/stores/ViewMode3DStore';
import { useFloors2DUnderlay } from '../../hooks/data/useFloors2DUnderlay';
import type { DxfScene } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { ViewTransform, Viewport } from '../../rendering/types/Types';

/**
 * Fraction of each underlay pixel's alpha removed via `destination-out` →
 * remaining ~35% opacity (AutoCAD xref fade, απόφαση Giorgio). Tunable.
 */
const UNDERLAY_FADE = 0.65;

export interface FloorUnderlayOverlayProps {
  readonly transform: ViewTransform;
  readonly viewport: Viewport;
}

export function FloorUnderlayOverlay({ transform, viewport }: FloorUnderlayOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<DxfRenderer | null>(null);

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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 🏢 SSoT sizing — DPR-aware backing store from the authoritative viewport, via the SAME
    // primitive as DxfCanvas/LayerCanvas/Preview (no getBoundingClientRect → no size desync).
    CanvasUtils.sizeCanvasToViewport(canvas, viewport);
    const dpr = getDevicePixelRatio();
    ctx.clearRect(0, 0, viewport.width, viewport.height);

    if (!active || !merged) return;

    if (!rendererRef.current) rendererRef.current = new DxfRenderer(canvas);
    rendererRef.current.render(merged, transform, viewport, {
      showGrid: false,
      showLayerNames: false,
      wireframeMode: false,
      selectedEntityIds: [],
      skipInteractive: true,
    });

    // AutoCAD xref fade — uniform alpha reduction that preserves colours and keeps
    // empty areas transparent (destination-out) so the active floor (above) and the
    // floorplan background (below) composite correctly.
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.globalAlpha = UNDERLAY_FADE;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, viewport.width, viewport.height);
    ctx.restore();
  }, [active, merged, transform, viewport]);

  return (
    <canvas
      ref={canvasRef}
      data-dxf-overlay="floor-underlay"
      className="pointer-events-none absolute inset-0 h-full w-full z-[5]"
      aria-hidden="true"
    />
  );
}
