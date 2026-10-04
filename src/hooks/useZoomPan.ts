/**
 * =============================================================================
 * ENTERPRISE: Centralized Zoom + Pan Hook
 * =============================================================================
 *
 * Provides mouse wheel zoom, mouse drag pan, touch pinch-to-zoom, and touch pan
 * for any zoomable/pannable container (images, canvases, floorplans, etc.).
 *
 * @module hooks/useZoomPan
 * @enterprise ADR-187 — Floorplan Viewer Enhancements · ADR-899 §9 θέμα 3
 *
 * Features:
 * - Mouse wheel zoom around the cursor (continuous, non-passive for scroll prevention)
 * - Mouse drag to pan — continues outside the container (window listeners while held)
 * - Pinch-to-zoom around the fingers' midpoint (mobile 2-finger gesture) + touch pan
 * - Button controls (zoomIn, zoomOut around the box centre, rotateBy90, resetAll)
 * - Optional pan confinement (`confinePan`) and double-click zoom toggle (`doubleClickZoom`)
 * - Optional re-fit after rotation (`refitOnRotate`, ADR-899 §9 θέμα 5β): «100%» = «χωρά» σε κάθε γωνία — `scale = zoom × fit`
 * - Cursor hints (grab/grabbing — grab only when there is room to pan)
 *
 * Used by:
 * - FloorplanGallery (inline + fullscreen modal) · DetailSheetDialog · DxfPreview (καμβάς — διαβάζουν `zoom`/`panOffset`)
 * - ImagePreview (πάνελ αρχείων) · PhotoPreviewModal (εικόνα — `contentRef` + `confinePan` + στροφή)
 *
 * 🔑 ADR-899 §9 θέμα 3: ήταν το SSoT, αλλά το πάνελ, το modal φωτογραφίας και το DXF preview το **ξανάγραφαν** με το χέρι
 * (τρία όρια, τρεις τροχοί, τρεις σύρσεις). Του έλειπαν: σύρση έξω από το κουτί · περιορισμός pan · στροφή · διπλό κλικ ·
 * pinch γύρω από τα δάχτυλα. Προστέθηκαν **εδώ**, προαιρετικά — οι παλιοί καταναλωτές βλέπουν την ίδια συμπεριφορά.
 *
 * @example
 * ```tsx
 * const zp = useZoomPan({ minZoom: 1, maxZoom: 8, confinePan: true });
 *
 * <figure ref={zp.containerRef} {...zp.handlers} className={zp.cursorClass}>
 *   <img src={url} ref={zp.contentRef} />
 * </figure>
 * ```
 */

'use client';

import { useCallback, useMemo, useState } from 'react';
import type { MouseEvent, RefObject } from 'react';

import { scaleAbout, stepZoom, type Extent, type Vec2, type ZoomLimits } from '@/lib/geometry/zoom-pan-math';

import { useDragPan, type DragPanHandlers } from './zoom-pan/use-drag-pan';
import { useApplyViewTransform, useViewState } from './zoom-pan/use-view-state';
import { pointerFromCenter, useWheelZoom } from './zoom-pan/use-wheel-zoom';
import { canPanIn, ZERO_PAN, type ViewCommit, type ViewGetter } from './zoom-pan/zoom-pan-view';

// ============================================================================
// TYPES
// ============================================================================

export interface ZoomPanConfig {
  /** Minimum zoom level (default: 0.25) */
  minZoom?: number;
  /** Maximum zoom level (default: 4) */
  maxZoom?: number;
  /** Additive zoom step for button controls (default: 0.25). Ignored when `zoomFactor` is set. */
  zoomStep?: number;
  /**
   * Multiplicative step for the +/- buttons (big-players pattern — Figma/Revit/ArchiCAD).
   * When set (e.g. 1.5), zoom-in multiplies and zoom-out divides by this factor, so the
   * buttons traverse a deep zoom range in a few clicks instead of ~120 additive steps.
   * Undefined → falls back to the additive `zoomStep` (backward compatible).
   */
  zoomFactor?: number;
  /** Default/initial zoom level (default: 1) */
  defaultZoom?: number;
  /** Wheel zoom sensitivity — higher = faster (default: 0.001) */
  wheelSensitivity?: number;
  /**
   * Περιορισμός pan (Google Photos): η άκρη του περιεχομένου (`contentRef`) δεν μπαίνει μέσα στο κουτί — όσο χωρά, καμία
   * μετατόπιση. Απαιτεί `contentRef`. Προεπιλογή `false` (ο καμβάς κάτοψης κινείται ελεύθερα).
   */
  confinePan?: boolean;
  /** Διπλό κλικ = εναλλαγή «προεπιλογή ↔ αυτό το zoom γύρω από τον δείκτη» (Google/Apple Photos). Χωρίς τιμή: τίποτα. */
  doubleClickZoom?: number;
  /**
   * Μετά τη στροφή το περιεχόμενο **ξαναχωρά** στο κουτί (Google Photos · ADR-899 §9 θέμα 5β): ό,τι ζωγραφίζεται είναι
   * `zoom × fit` (επιστροφή `scale`). Απαιτεί `contentRef`. Προεπιλογή `false`.
   */
  refitOnRotate?: boolean;
  /**
   * Οι πραγματικές διαστάσεις του περιεχομένου, για το `refitOnRotate`: πόσο **επιτρέπεται** να μεγαλώσει η στραμμένη
   * (ποτέ πάνω από τα pixel της). Χωρίς τιμή: `naturalWidth/Height`, αλλιώς το layout (τότε μόνο σμίκρυνση).
   */
  contentDimensions?: Extent | null;
}

export type PanOffset = Vec2;

interface ZoomPanHandlers extends DragPanHandlers {
  onDoubleClick: (e: MouseEvent) => void;
}

export interface UseZoomPanReturn {
  /** Current zoom level — το νούμερο του χρήστη («100%» = «χωρά») */
  zoom: number;
  /** Η κλίμακα που ζωγραφίζεται: `zoom × fit`. Ίδια με το `zoom` χωρίς `refitOnRotate`. Αυτήν ρωτά η ανάλυση. */
  scale: number;
  /** Current pan offset in pixels */
  panOffset: PanOffset;
  /** Στροφή σε μοίρες (πολλαπλάσιο του 90) */
  rotation: number;
  /** Whether user is currently dragging to pan */
  isPanning: boolean;
  /** Zoom in by one step (around the box centre) */
  zoomIn: () => void;
  /** Zoom out by one step (around the box centre) */
  zoomOut: () => void;
  /** Στροφή κατά 90° δεξιόστροφα */
  rotateBy90: () => void;
  /** Reset zoom, pan and rotation to defaults */
  resetAll: () => void;
  /** Callback ref — attach to the zoomable container element */
  containerRef: (node: HTMLElement | null) => void;
  /** Το κουτί ως `RefObject`, για μέτρηση (`useElementSize` / `useZoomResolution`) */
  containerBox: RefObject<HTMLElement | null>;
  /** Callback ref για το περιεχόμενο: ο μετασχηματισμός εφαρμόζεται imperative (κανένα `style=`, N.3) */
  contentRef: (node: HTMLElement | null) => void;
  /** Mouse/touch event handlers to spread on the container */
  handlers: ZoomPanHandlers;
  /** Tailwind cursor class based on zoom/pan state */
  cursorClass: string;
}

// ============================================================================
// DEFAULTS
// ============================================================================

const DEFAULTS = {
  minZoom: 0.25,
  maxZoom: 4,
  zoomStep: 0.25,
  defaultZoom: 1,
  wheelSensitivity: 0.001,
} as const;

// ============================================================================
// BUTTONS · ROTATION · DOUBLE CLICK
// ============================================================================

interface ActionDeps {
  readonly getView: ViewGetter;
  readonly commit: ViewCommit;
  readonly limits: ZoomLimits;
  readonly by: { readonly factor?: number; readonly step?: number };
  readonly defaultZoom: number;
}

/** Τα κουμπιά μεγεθύνουν γύρω από το **κέντρο του κουτιού** (Figma) — η μετατόπιση κλιμακώνεται μαζί. */
function useButtonActions({ getView, commit, limits, by, defaultZoom }: ActionDeps) {
  const zoomBy = useCallback((direction: 1 | -1) => {
    const view = getView();
    const zoom = stepZoom(view.zoom, limits, direction, by);
    // Σμίκρυνση ως το 1 ⇒ πίσω στο κέντρο (συμπεριφορά ADR-187).
    const pan = direction < 0 && zoom <= 1 ? ZERO_PAN : scaleAbout(view.pan, ZERO_PAN, zoom / view.zoom);
    commit({ ...view, zoom, pan });
  }, [getView, commit, limits, by]);

  const zoomIn = useCallback(() => zoomBy(1), [zoomBy]);
  const zoomOut = useCallback(() => zoomBy(-1), [zoomBy]);
  const rotateBy90 = useCallback(() => {
    const view = getView();
    commit({ ...view, rotation: (view.rotation + 90) % 360 });
  }, [getView, commit]);
  const resetAll = useCallback(() => commit({ zoom: defaultZoom, pan: ZERO_PAN, rotation: 0 }), [commit, defaultZoom]);
  return { zoomIn, zoomOut, rotateBy90, resetAll };
}

/** Διπλό κλικ: μεγεθυσμένο ⇒ πίσω στην προεπιλογή· αλλιώς μεγέθυνση γύρω από τον δείκτη. Η στροφή μένει. */
function useDoubleClickToggle(deps: ActionDeps, container: HTMLElement | null, target: number | undefined) {
  const { getView, commit, defaultZoom } = deps;
  return useCallback((e: MouseEvent) => {
    if (target === undefined) return;
    const view = getView();
    if (view.zoom > defaultZoom) {
      commit({ ...view, zoom: defaultZoom, pan: ZERO_PAN });
      return;
    }
    const anchor = container ? pointerFromCenter(container, e.clientX, e.clientY) : ZERO_PAN;
    commit({ ...view, zoom: target, pan: scaleAbout(view.pan, anchor, target / view.zoom) });
  }, [getView, commit, defaultZoom, container, target]);
}

// ============================================================================
// HOOK
// ============================================================================

export function useZoomPan(config: ZoomPanConfig = {}): UseZoomPanReturn {
  const { minZoom = DEFAULTS.minZoom, maxZoom = DEFAULTS.maxZoom, zoomStep = DEFAULTS.zoomStep, zoomFactor,
    defaultZoom = DEFAULTS.defaultZoom, wheelSensitivity = DEFAULTS.wheelSensitivity, confinePan = false, doubleClickZoom,
    refitOnRotate = false, contentDimensions = null } = config;

  const state = useViewState(defaultZoom, confinePan, refitOnRotate ? { dimensions: contentDimensions } : null);
  const [isPanning, setIsPanning] = useState(false);
  const limits = useMemo(() => ({ min: minZoom, max: maxZoom }), [minZoom, maxZoom]);
  const by = useMemo(() => ({ factor: zoomFactor, step: zoomStep }), [zoomFactor, zoomStep]);
  const deps: ActionDeps = { getView: state.getView, commit: state.commit, limits, by, defaultZoom };

  useWheelZoom(state.container, state.getView, state.commit, limits, wheelSensitivity);
  useApplyViewTransform(state.content, state.view, state.scale, isPanning);
  const drag = useDragPan({ container: state.container, getView: state.getView, commit: state.commit, limits, setPanning: setIsPanning });
  const actions = useButtonActions(deps);
  const onDoubleClick = useDoubleClickToggle(deps, state.container, doubleClickZoom);

  const pannable = canPanIn(state.view, state.frame, confinePan);
  const cursorClass = isPanning ? 'cursor-grabbing' : pannable ? 'cursor-grab' : '';

  return {
    zoom: state.view.zoom, scale: state.scale, panOffset: state.view.pan, rotation: state.view.rotation, isPanning, ...actions,
    containerRef: state.containerRef, containerBox: state.containerBox, contentRef: state.contentRef,
    handlers: { ...drag, onDoubleClick }, cursorClass,
  };
}
