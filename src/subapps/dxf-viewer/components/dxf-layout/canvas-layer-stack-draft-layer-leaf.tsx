'use client';

/**
 * ⚠️  ARCHITECTURE-CRITICAL FILE — READ ADR-040 BEFORE EDITING
 * docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md
 * After any architectural change → update the ADR changelog (same commit).
 *
 * DRAFT LAYER LEAF — ο micro-leaf του `LayerCanvas` (ADR-040 Phase E) με
 * **mount-on-demand** (ADR-732 §3 «Επιπλέον unmount-when-empty»).
 *
 * Σχήμα outer gate / inner canvas — ίδιο ιδίωμα με `SnapIndicatorSubscriber` (XXII.B)
 * και `FloorUnderlayOverlay` (Batch 3):
 *
 *  - **Outer** (`DraftLayerSubscriber`): κρατά ΜΟΝΟ low-freq σήματα (marquee boolean,
 *    dev debug toggle) + props. Αποφασίζει με το ρητό predicate
 *    `hasLayerCanvasContent` (SSoT: `canvas-v2/layer-canvas/layer-canvas-content.ts`).
 *    Χωρίς περιεχόμενο ΔΕΝ υπάρχει canvas element στο DOM — ούτε compositor στρώμα,
 *    ούτε `clearRect`-ανά-καρέ (ο LayerRenderer είναι ο ΕΝΑΣ που έμεινε εκτός της
 *    Φ2 πύλης του ADR-726, `LayerRenderer.ts:189`).
 *  - **Inner** (`DraftLayerCanvasLeaf`): κατέχει τα high-freq subscriptions
 *    (`useDraftPolygonLayer` → `useCursorWorldPosition`, `useHoveredOverlay`,
 *    `useTransformScale`). Σε άδειο σχέδιο δεν mount-άρονται ΚΑΘΟΛΟΥ — δηλαδή το
 *    mousemove δεν αγγίζει πια αυτό το υποδέντρο.
 *
 * ⚠️ Το `showLayerCanvas` του `CanvasSection` (overlayMode draw/edit ή debug toggle)
 * ΜΕΝΕΙ ΩΣ ΕΧΕΙ — η πύλη εδώ είναι **επιπλέον** συνθήκη, όχι αντικατάστασή του.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-732-2d-canvas-layer-consolidation.md §3
 */

import React, { useMemo, useSyncExternalStore } from 'react';
import { LayerCanvas } from '../../canvas-v2';
import { useDraftPolygonLayer } from '../../hooks/layers/useDraftPolygonLayer';
import { useHoveredOverlay } from '../../systems/hover/useHover';
import { useTransformScale } from '../../systems/cursor/ImmediateTransformStore';
import { SelectionStore } from '../../systems/cursor/SelectionStore';
import { hasLayerCanvasContent } from '../../canvas-v2/layer-canvas/layer-canvas-content';
import type { ColorLayer } from '../../canvas-v2/layer-canvas/layer-types';

// LayerCanvas pass-through props (layers injected by the leaf after computing draft)
export type LayerCanvasPassthroughProps = Omit<React.ComponentPropsWithoutRef<typeof LayerCanvas>, 'layers'>;

export interface DraftLayerSubscriberProps {
  // React 18 useRef returns RefObject<T | null>; forwardRef expects RefObject<T>.
  // Cast is safe — the underlying ref object is identical at runtime.
  canvasRef: React.RefObject<HTMLCanvasElement | null> | React.RefObject<HTMLCanvasElement>;
  colorLayers: ColorLayer[];
  draftPolygon: Array<[number, number]>;
  currentStatus: string;
  overlayMode: 'select' | 'draw' | 'edit';
  layerCanvasPassthroughProps: LayerCanvasPassthroughProps;
}

// ─── (β) marquee: το ΖΩΝΤΑΝΟ σήμα του selection box ─────────────────────────────
// Ο `layer-canvas-hooks.renderLayers` παρακάμπτει τα props `showSelectionBox/selectionBox`
// με το SelectionStore σε κάθε καρέ — άρα ΑΥΤΟ είναι το σήμα που πρέπει να δει η πύλη,
// και μάλιστα ΠΡΙΝ το πρώτο ζωγράφισμα (marquee σε ΑΔΕΙΟ σχέδιο ⇒ mount μέσα στη
// χειρονομία). Το store ειδοποιεί ανά mousemove, αλλά το snapshot εδώ είναι boolean →
// `Object.is` ⇒ re-render ΜΟΝΟ στα δύο flips (start / end) της χειρονομίας.
const subscribeMarquee = (onChange: () => void): (() => void) => SelectionStore.subscribe(onChange);
const getMarqueeActive = (): boolean => SelectionStore.getIsSelecting();
const getMarqueeActiveServer = (): boolean => false;

// ─── (δ) dev-only calibration grid (`window.rulerDebugOverlay`) ─────────────────
interface RulerDebugOverlayGlobal {
  readonly getStatus: () => { readonly enabled: boolean };
}
/** Ίδιο event με το dirty-flag listener του `layer-canvas-hooks` (SSoT του toggle). */
const RULER_DEBUG_TOGGLE_EVENT = 'ruler-debug-toggle';
const subscribeRulerDebug = (onChange: () => void): (() => void) => {
  window.addEventListener(RULER_DEBUG_TOGGLE_EVENT, onChange);
  return () => window.removeEventListener(RULER_DEBUG_TOGGLE_EVENT, onChange);
};
const getRulerDebugActive = (): boolean => {
  if (typeof window === 'undefined') return false;
  const debugWin = window as Window & { rulerDebugOverlay?: RulerDebugOverlayGlobal };
  const overlay = debugWin.rulerDebugOverlay;
  if (!overlay) return false;
  try {
    return overlay.getStatus().enabled === true;
  } catch {
    // FAIL-MOUNTED: ένα σπασμένο debug global δεν επιτρέπεται να κρύψει pixels.
    return true;
  }
};
const getRulerDebugActiveServer = (): boolean => false;

/**
 * Outer gate — ΜΗΔΕΝ high-frequency subscription. Χωρίς περιεχόμενο επιστρέφει `null`
 * (κανένα canvas element), αλλιώς mount-άρει το inner leaf.
 */
export const DraftLayerSubscriber = React.memo(function DraftLayerSubscriber({
  canvasRef,
  colorLayers,
  draftPolygon,
  currentStatus,
  overlayMode,
  layerCanvasPassthroughProps,
}: DraftLayerSubscriberProps) {
  const marqueeActive = useSyncExternalStore(subscribeMarquee, getMarqueeActive, getMarqueeActiveServer);
  const debugCalibrationGridActive = useSyncExternalStore(
    subscribeRulerDebug,
    getRulerDebugActive,
    getRulerDebugActiveServer,
  );

  // Οι default τιμές αντικατοπτρίζουν τα defaults του ίδιου του `LayerCanvas`
  // (`layersVisible = true`, `renderOptions = { showGrid: true, showSelectionBox: true, … }`)
  // ⇒ αν ο καλών παραλείψει prop, η πύλη γέρνει προς mounted (fail-mounted).
  const { layersVisible, renderOptions, gridSettings } = layerCanvasPassthroughProps;
  const hasContent = hasLayerCanvasContent({
    layers: colorLayers,
    draftVertexCount: draftPolygon.length,
    layersVisible: layersVisible ?? true,
    marqueeActive,
    renderOptions: {
      showGrid: renderOptions?.showGrid ?? true,
      showSelectionBox: renderOptions?.showSelectionBox ?? true,
      selectionBox: renderOptions?.selectionBox ?? null,
    },
    gridEnabled: gridSettings.enabled === true,
    debugCalibrationGridActive,
  });

  if (!hasContent) return null;

  return (
    <DraftLayerCanvasLeaf
      canvasRef={canvasRef}
      colorLayers={colorLayers}
      draftPolygon={draftPolygon}
      currentStatus={currentStatus}
      overlayMode={overlayMode}
      layerCanvasPassthroughProps={layerCanvasPassthroughProps}
    />
  );
});

/**
 * Inner leaf — mounted ΜΟΝΟ όσο υπάρχει περιεχόμενο. Κατέχει τα high-freq
 * subscriptions· μόνο αυτό re-renders στο mousemove, ποτέ ο orchestrator (ADR-040).
 */
function DraftLayerCanvasLeaf({
  canvasRef,
  colorLayers,
  draftPolygon,
  currentStatus,
  overlayMode,
  layerCanvasPassthroughProps,
}: DraftLayerSubscriberProps) {
  // ADR-040 Phase XXII.B — scale-only leaf subscription (πρώην prop από τον shell).
  const transformScale = useTransformScale();
  const { colorLayersWithDraft } = useDraftPolygonLayer({
    colorLayers,
    draftPolygon,
    currentStatus: currentStatus as import('../../types/overlay').RegionStatus,
    overlayMode,
    transformScale,
  });

  // 🚀 PERF (ADR-040 Phase II): useHoveredOverlay moved here from CanvasSection.
  // This leaf already re-renders every mousemove (useDraftPolygonLayer → useCursorWorldPosition),
  // so the subscription is free. CanvasSection no longer re-renders on overlay hover.
  const hoveredOverlayId = useHoveredOverlay();
  const finalLayers = useMemo(() => {
    if (!hoveredOverlayId) return colorLayersWithDraft;
    return colorLayersWithDraft.map(l =>
      l.id === hoveredOverlayId ? { ...l, isHovered: true } : l
    );
  }, [colorLayersWithDraft, hoveredOverlayId]);

  return (
    <LayerCanvas
      ref={canvasRef as React.RefObject<HTMLCanvasElement>}
      {...layerCanvasPassthroughProps}
      layers={finalLayers}
    />
  );
}
