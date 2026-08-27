/**
 * 🏢 ENTERPRISE: useFitToView Hook
 *
 * @description Fit-to-view and fit-to-overlay zoom functionality.
 * - fitToOverlay(): Zoom to a specific overlay's bounding box
 * - EventBus listener: Handles 'canvas-fit-to-view' events (Shift+1)
 *
 * EXTRACTED FROM: CanvasSection.tsx — ~75 lines of fit-to-view logic
 */

'use client';

import { useEffect, useRef, type RefObject } from 'react';
import { createCombinedBounds } from '../../systems/zoom/utils/bounds';
import { getPointerSnapshotFromElement } from '../../rendering/core/CoordinateTransforms';
import { getDrawingAreaRect } from '../../rendering/core/drawing-area';
import { getImmediateTransform } from '../../systems/cursor/ImmediateTransformStore';
import { EventBus } from '../../systems/events';
// ADR-375 Phase B.4 — explicit «Fit annotations» → recompute the fit-to-paper scale.
import { computeFitToPaperScale } from '../../systems/dimensions/auto-drawing-scale';
import { useBimRenderSettingsStore } from '../../state/bim-render-settings-store';
import { serviceRegistry } from '../../services';
// ADR-418 — «σε ποιες μονάδες ζει η σκηνή» SSoT: το 1:N διπλώνει μέσα του μονάδες + DPI.
import { resolveSceneUnits, type SceneUnits } from '../../utils/scene-units';
import { dwarn, derr } from '../../debug';
// ADR-641 — block-editor-aware zoom-extents: while a BEDIT session is open, every fit path targets
// the entered block's LOCAL bounds (via the scene-scope resolver SSoT), not the world scene.
import { getActiveBlockEditId } from '../../systems/block/ActiveBlockEditStore';
import { resolveBlockEditScene } from '../../systems/block/block-edit-scene';
import type { SceneModel } from '../../types/scene';
import type { DxfScene } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { ColorLayer } from '../../canvas-v2/layer-canvas/layer-types';
import type { Overlay } from '../../overlays/types';
import type { ViewTransform, Point2D } from '../../rendering/types/Types';

// ADR-400: payload type for canvas-restore-viewport event.
interface RestoreViewportPayload {
  transform: ViewTransform;
}

// ============================================================================
// TYPES
// ============================================================================

/** Subset of useZoom return type — only the methods used by this hook */
interface ZoomSystemLike {
  zoomToFit: (
    bounds: { min: Point2D; max: Point2D },
    viewport: { width: number; height: number },
    alignToOrigin?: boolean,
  ) => { transform: ViewTransform } | null;
  setTransform: (transform: ViewTransform) => void;
  /**
   * ADR-418 — ΑΠΟΛΥΤΗ μετάβαση σε κλίμακα 1:N. Ο ΕΝΑΣ δρόμος: ο ίδιος που ήδη χρησιμοποιεί
   * το μενού της γωνίας των χαράκων (`handleZoomToRatio`). ΜΗΝ τον αντικαταστήσεις με
   * `zoomToScale` μέσω `zoomAtScreenPoint` — εκείνος περνά από το clamp του ροδακιού.
   */
  zoomToRatio: (
    ratioN: number,
    sceneUnits: SceneUnits,
    center?: Point2D,
  ) => { transform: ViewTransform } | null;
}

export interface UseFitToViewParams {
  /** DXF scene data for combined bounds calculation */
  dxfScene: DxfScene | null;
  /**
   * ADR-641 — the raw WORLD scene model. While a Block Editor session is open, the fit handler
   * resolves the entered block's LOCAL bounds from this (via `resolveBlockEditScene`) instead of the
   * world `dxfScene`, so zoom-extents frames the block (AutoCAD/Revit BEDIT parity).
   */
  currentScene: SceneModel | null;
  /** Overlay color layers for combined bounds calculation */
  colorLayers: ColorLayer[];
  /** Zoom system for transform operations */
  zoomSystem: ZoomSystemLike;
  /** Transform setter from viewport manager */
  setTransform: (t: ViewTransform) => void;
  /** Container ref for viewport snapshot */
  containerRef: RefObject<HTMLDivElement | null>;
  /** Current level's overlays */
  currentOverlays: Overlay[];
}

export interface UseFitToViewReturn {
  /** Zoom to a specific overlay's bounding box */
  fitToOverlay: (overlayId: string) => void;
}

// ============================================================================
// HOOK
// ============================================================================

export function useFitToView({
  dxfScene,
  currentScene,
  colorLayers,
  zoomSystem,
  setTransform,
  containerRef,
  currentOverlays,
}: UseFitToViewParams): UseFitToViewReturn {

  // ADR-641 — the world scene, read at event time (the fit handlers fire from EventBus, not render).
  const currentSceneRef = useRef(currentScene);
  currentSceneRef.current = currentScene;

  // ADR-641 / N.18 — SSoT: capped content-fit (padding 10%, maxScale 20 via FitToViewService) applied
  // THROUGH the zoom system so the ZoomManager's internal transform stays in sync — a later
  // wheel/keyboard zoom then works from THIS view, not a stale one. Shared by `fitToOverlay` AND the
  // block-editor zoom-extents branch, so the two never drift into token-identical twins.
  const applyCappedFit = (bounds: { min: Point2D; max: Point2D }): void => {
    // 🏢 ENTERPRISE (2026-01-30): CANONICAL ELEMENT = containerRef (SSoT) for viewport calculations.
    const snap = getPointerSnapshotFromElement(containerRef.current);
    if (!snap) {
      dwarn('useFitToView', 'applyCappedFit: Cannot fit - viewport not ready');
      return; // 🏢 Fail-fast: Cannot fit without valid viewport
    }
    const result = serviceRegistry
      .get('fit-to-view')
      .calculateFitToViewFromBounds(bounds, snap.viewport, { padding: 0.1 });
    if (result.success && result.transform) {
      zoomSystem.setTransform(result.transform);
    }
  };

  // N.18 SSoT — uncapped zoom-to-fit that preserves the original origin (allow negative coordinates),
  // applied with a NaN guard. Shared by the world zoom-extents branch AND the fit-to-selection
  // handler so they never drift into token-identical twins. `label` distinguishes their error logs.
  const applyZoomToFit = (bounds: { min: Point2D; max: Point2D }, label: string): void => {
    // 🏢 ENTERPRISE (2026-01-30): CANONICAL ELEMENT = containerRef (SSoT) for viewport calculations.
    const snap = getPointerSnapshotFromElement(containerRef.current);
    if (!snap) {
      dwarn('useFitToView', `${label}: Cannot fit - viewport not ready`);
      return; // 🏢 Fail-fast: Cannot fit without valid viewport
    }
    try {
      const zoomResult = zoomSystem.zoomToFit(bounds, snap.viewport, false);
      if (zoomResult && zoomResult.transform) {
        const { scale, offsetX, offsetY } = zoomResult.transform;
        // 🛡️ GUARD: Check for NaN values before applying transform
        if (isNaN(scale) || isNaN(offsetX) || isNaN(offsetY)) {
          derr('useFitToView', `🚨 ${label} failed: Invalid transform (NaN values)`);
          return;
        }
        setTransform(zoomResult.transform);
      }
    } catch (error) {
      derr('useFitToView', `🚨 ${label} failed:`, error);
    }
  };

  // ✅ ΚΕΝΤΡΙΚΟΠΟΙΗΣΗ: FIT TO OVERLAY - Χρήση κεντρικής υπηρεσίας αντί για διάσπαρτη logic
  const fitToOverlay = (overlayId: string) => {
    const overlay = currentOverlays.find(o => o.id === overlayId);
    if (!overlay || !overlay.polygon || overlay.polygon.length < 3) {
      return;
    }

    // Calculate bounding box of overlay polygon
    const xs = overlay.polygon.map(([x]) => x);
    const ys = overlay.polygon.map(([, y]) => y);
    applyCappedFit({
      min: { x: Math.min(...xs), y: Math.min(...ys) },
      max: { x: Math.max(...xs), y: Math.max(...ys) },
    });
  };

  // Handle fit-to-view event from useCanvasOperations fallback
  // 🏢 ENTERPRISE: Unified EventBus.on — receives events from all dispatchers
  useEffect(() => {
    const handleFitToView = () => {
      // ADR-641 — inside a Block Editor, zoom-extents frames the entered block's LOCAL bounds (base @
      // origin), NEVER the world scene (which would push the members off-screen → «block disappears»).
      // Capped fit through the zoom system keeps the ZoomManager in sync so the next wheel zoom stays
      // on the block. This is the single chokepoint every zoom-extents trigger funnels through
      // (HOME/Shift+1, toolbar, middle-double-click, ruler button, BEDIT enter), so they all agree.
      const activeBlockId = getActiveBlockEditId();
      if (activeBlockId) {
        const blockBounds = resolveBlockEditScene(currentSceneRef.current, activeBlockId)?.bounds;
        if (blockBounds) {
          // Uncapped fit (like «F»/«Z» selection) — AutoCAD/Revit «zoom extents» in the block editor
          // has NO artificial maxScale: a small block must fill the viewport (a 20:1 cap left it
          // «far»). zoomToFit keeps the ZoomManager in sync, so the next wheel zoom stays on the block.
          applyZoomToFit({ min: blockBounds.min, max: blockBounds.max }, 'Shift+1 (block)');
        }
        return; // never fall through to the world combined-bounds fit while inside the editor
      }

      // 🚀 USE COMBINED BOUNDS - DXF + overlays
      // 🏢 FIX (2026-01-04): forceRecalculate=true includes dynamically drawn entities
      const combinedBounds = createCombinedBounds(dxfScene, colorLayers, true);
      if (combinedBounds) applyZoomToFit(combinedBounds, 'Shift+1');
    };

    // ADR-394: fit to the selection's pre-computed bounds (Z key). Bounds arrive
    // ready from useKeyboardShortcuts (DXF + BIM), so this only maps bounds→transform.
    const handleFitToViewSelected = (payload: { bounds: { min: Point2D; max: Point2D } }) => {
      const bounds = payload?.bounds;
      if (!bounds) return;
      applyZoomToFit(bounds, 'Z fit-to-selection');
    };

    /**
     * ADR-650 M5α.2 — pan so a world point lands in the middle, keeping the CURRENT scale.
     *
     * Inverts the `worldToScreen` formula (the SSoT in `CoordinateTransforms`) for the one
     * unknown, the offsets, with `scale` held fixed:
     *   screenX = left + wx·scale + offsetX          = width/2
     *   screenY = (height − top) − wy·scale − offsetY = height/2
     * Reading the live transform through `getImmediateTransform()` (event-time getter, never a
     * React snapshot) is what makes «current scale» actually current — a snapshot would restore
     * whatever the scale was when this effect last ran.
     */
    const handleCenterOnPoint = (payload: { point: Point2D }) => {
      const point = payload?.point;
      if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
      const snap = getPointerSnapshotFromElement(containerRef.current);
      if (!snap) {
        dwarn('useFitToView', 'center-on-point: viewport not ready');
        return;
      }
      const { scale } = getImmediateTransform();
      if (!Number.isFinite(scale) || scale <= 0) return;
      // 🔴 ΙΔΙΟ ελάττωμα με το σύμπτωμα Β: κέντραρε στο κέντρο του `<canvas>`, του οποίου τα
      // 30 px αριστερά και κάτω τα σκεπάζουν οι χάρακες. Τώρα κεντράρει στο κέντρο της ΟΡΑΤΗΣ
      // περιοχής — μετατόπιση (−left/2, +bottom/2), ανεξάρτητη από zoom/pan.
      const area = getDrawingAreaRect(snap.viewport);
      setTransform({
        scale,
        offsetX: area.centerX - area.x - point.x * scale,
        offsetY: area.bottom - point.y * scale - area.centerY,
      });
    };

    // ADR-400: Restore a persisted viewport transform (absolute, no bounds calc needed).
    const handleRestoreViewport = (payload: RestoreViewportPayload) => {
      const { scale, offsetX, offsetY } = payload.transform;
      if (!Number.isFinite(scale) || scale <= 0 || !Number.isFinite(offsetX) || !Number.isFinite(offsetY)) {
        derr('useFitToView', '🚨 canvas-restore-viewport: invalid transform, ignoring');
        return;
      }
      setTransform(payload.transform);
    };

    // ADR-375 Phase B.4 — «Fit annotations»: recompute the fit-to-paper 1:N from the
    // live combined bounds (mm) and FORCE it, overriding any manual scale on request.
    const handleFitAnnotationsToPaper = () => {
      const combinedBounds = createCombinedBounds(dxfScene, colorLayers, true);
      if (!combinedBounds) return;
      const scale = computeFitToPaperScale(combinedBounds);
      if (scale != null) {
        useBimRenderSettingsStore.getState().applyAutoDrawingScale(scale, { force: true });
      }
    };

    /**
     * ADR-418 — ΑΠΟΛΥΤΗ κλίμακα 1:N από το ribbon widget (`ZoomControlsWidget`), που ζει έξω από
     * το `CanvasLayerStack` και δεν βλέπει το `zoomSystem`. Καταλήγει στον ΙΔΙΟ `zoomToRatio` με
     * το μενού της γωνίας των χαράκων — ένα ερώτημα, ένας δρόμος, μία απάντηση.
     *
     * Οι μονάδες διαβάζονται σε χρόνο ΣΥΜΒΑΝΤΟΣ από το `currentSceneRef` — τον getter που αυτό
     * το αρχείο ήδη συντηρεί (ίδιο πρότυπο με τον handler του block-edit fit). Snapshot στα deps
     * θα ξανάδενε ΟΛΕΣ τις συνδρομές σε κάθε αλλαγή σκηνής, χωρίς κανένα κέρδος.
     */
    const handleZoomToRatio = (payload: { ratioN: number }) => {
      const ratioN = payload?.ratioN;
      if (!Number.isFinite(ratioN) || ratioN <= 0) {
        dwarn('useFitToView', 'zoom-to-ratio: μη έγκυρο N, αγνοείται', { ratioN });
        return;
      }
      zoomSystem.zoomToRatio(ratioN, resolveSceneUnits(currentSceneRef.current));
    };

    const cleanup = EventBus.on('canvas-fit-to-view', handleFitToView);
    const cleanupSelected = EventBus.on('canvas-fit-to-view-selected', handleFitToViewSelected);
    const cleanupCenter = EventBus.on('canvas-center-on-point', handleCenterOnPoint);
    const cleanupRestore = EventBus.on('canvas-restore-viewport', handleRestoreViewport);
    const cleanupFitAnnotations = EventBus.on('annotation-fit-to-paper', handleFitAnnotationsToPaper);
    const cleanupZoomToRatio = EventBus.on('canvas-zoom-to-ratio', handleZoomToRatio);
    return () => {
      cleanup(); cleanupSelected(); cleanupCenter(); cleanupRestore();
      cleanupFitAnnotations(); cleanupZoomToRatio();
    };
  }, [dxfScene, colorLayers, zoomSystem]); // 🚀 Include colorLayers για combined bounds

  return { fitToOverlay };
}
