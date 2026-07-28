/**
 * 🏢 ENTERPRISE: useViewportManager Hook
 *
 * @description Centralized viewport measurement and management for CanvasSection.
 * Owns the viewport state, ResizeObserver lifecycle, and RAF-delayed initial measurement.
 *
 * EXTRACTED FROM: CanvasSection.tsx (lines ~165-501) — ~230 lines of viewport logic
 *
 * RESPONSIBILITIES:
 * 1. viewport state (width/height) — React state + synchronous ref
 * 2. viewportRef — zero-lag synchronous viewport for non-React consumers
 * 3. transformRef — kept in sync for ResizeObserver offset adjustment
 * 4. ResizeObserver on containerRef — auto-updates viewport + adjusts offsetY on height change
 * 5. RAF-delayed initial measurement — ensures correct dimensions after browser layout stabilization
 *
 * COUPLING: ZERO with drawing/selection/overlay logic
 * DEPENDENCIES: containerRef, transform, setTransform (injected)
 */

'use client';

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  type RefObject,
  type MutableRefObject,
} from 'react';

import type { ViewTransform } from '../../rendering/types/Types';
import { PANEL_LAYOUT } from '../../config/panel-tokens';
import { UnifiedFrameScheduler } from '../../rendering/core/UnifiedFrameScheduler';
import { updateImmediateTransform } from '../../systems/cursor/ImmediateTransformStore';
import { canvasBoundsService } from '../../services/CanvasBoundsService';
import { subscribeDevicePixelRatio } from '../../systems/cursor/device-pixel-ratio'; // ADR-549 Phase 7
import { subscribeDockMode } from '../../systems/workspace/workspace-dock-store'; // ADR-724 Φ2
import { dlog, dwarn } from '../../debug';

// ============================================================================
// TYPES
// ============================================================================

/** Viewport dimensions */
interface Viewport {
  width: number;
  height: number;
}

export interface UseViewportManagerParams {
  /** Container element ref — canonical element for all viewport measurements */
  containerRef: RefObject<HTMLDivElement | null>;
  /** Current transform (read-only, kept in sync via ref for ResizeObserver) */
  transform: ViewTransform;
  /** Callback to update transform (used for offsetY adjustment on resize) */
  setTransform: (t: ViewTransform) => void;
  /** Optional callback when viewport changes (e.g., PDF store sync) */
  onViewportChange?: (viewport: Viewport) => void;
}

/**
 * Κάτω από αυτό το κατώφλι (CSS px) η μεταβολή θεωρείται θόρυβος στρογγυλοποίησης του
 * `ResizeObserver` και **δεν** μετακινεί το σχέδιο.
 */
const RESIZE_EPSILON_PX = 0.5;

/**
 * 🏢 ADR-724 §4.1 — Ο **ΕΝΑΣ** κανόνας αγκύρωσης του σχεδίου όταν αλλάζει ο καμβάς.
 *
 * ── ΥΨΟΣ (προϋπήρχε) ──
 * `offsetY += Δh` ⇒ το σχέδιο μένει κολλημένο στην **κάτω** ακμή, συνεπές με τον χάρακα του
 * app (0.000m κάτω-αριστερά).
 *
 * ── ΠΛΑΤΟΣ (νέο) ──
 * Μέχρι το ADR-724 το πλάτος του καμβά **δεν άλλαζε ποτέ**, οπότε ο κανόνας απλώς δεν υπήρχε.
 * Με το αγκυρωμένο panel που αλλάζει μέγεθος, εμφανίζεται μια ασυμμετρία: όταν η παλέτα είναι
 * **δεξιά**, η αριστερή ακμή του καμβά δεν κουνιέται και το σχέδιο μένει ακίνητο· όταν είναι
 * **αριστερά**, η ακμή μετακινείται κατά Δ και το σχέδιο **σέρνεται μαζί με την παλέτα** —
 * οπτικά λάθος για CAD.
 *
 * Η αντιστάθμιση γίνεται με τη μετατόπιση της **οθονο-χωρικής** αριστερής ακμής του container
 * (`offsetX -= Δleft`), **όχι** με τη μεταβολή πλάτους. Έτσι και οι δύο πλευρές αγκύρωσης
 * περιγράφονται από τον ίδιο κανόνα, χωρίς `if (dockSide === …)` πουθενά στον καμβά.
 *
 * ⛔ Η **κλίμακα δεν αγγίζεται ποτέ** (ADR-418): το app εμφανίζει πραγματικό `1:N` — ένα
 * zoom-to-fit σε resize θα άλλαζε εμφανιζόμενο αριθμό χωρίς εντολή χρήστη.
 *
 * Καθαρή συνάρτηση: επιστρέφει το **ίδιο** αντικείμενο όταν δεν χρειάζεται αλλαγή, ώστε ο
 * καλών να μπορεί να ελέγξει με ταυτότητα (`!==`) αντί για σύγκριση πεδίων.
 */
export function anchorTransformOnResize(
  transform: ViewTransform,
  deltaHeight: number,
  deltaLeft: number,
): ViewTransform {
  const adjustY = Math.abs(deltaHeight) > RESIZE_EPSILON_PX;
  const adjustX = Math.abs(deltaLeft) > RESIZE_EPSILON_PX;
  if (!adjustY && !adjustX) return transform;
  return {
    ...transform,
    offsetX: adjustX ? transform.offsetX - deltaLeft : transform.offsetX,
    offsetY: adjustY ? transform.offsetY + deltaHeight : transform.offsetY,
  };
}

export interface UseViewportManagerReturn {
  /** Current viewport dimensions (React state — triggers re-renders) */
  viewport: Viewport;
  /** Synchronous viewport ref — zero React lag, for non-React consumers */
  viewportRef: MutableRefObject<Viewport>;
  /** Whether viewport has valid (non-zero) dimensions */
  viewportReady: boolean;
  /** Wrapper setTransform that updates transformRef synchronously */
  setTransform: (t: ViewTransform) => void;
  /** Synchronous transform ref */
  transformRef: MutableRefObject<ViewTransform>;
}

// ============================================================================
// HOOK
// ============================================================================

export function useViewportManager({
  containerRef,
  transform,
  setTransform: externalSetTransform,
  onViewportChange,
}: UseViewportManagerParams): UseViewportManagerReturn {

  // ── State ──────────────────────────────────────────────────────────────
  const [viewport, setViewport] = useState<Viewport>({ width: 0, height: 0 });

  // ── Refs (synchronous, zero React lag) ─────────────────────────────────
  const viewportRef = useRef<Viewport>({ width: 0, height: 0 });
  const transformRef = useRef<ViewTransform>(transform);
  const resizeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // ADR-724 §4.1: η τελευταία γνωστή **οθονο-χωρική** αριστερή ακμή του container. `null` =
  // δεν έχει μετρηθεί ακόμη ⇒ η πρώτη μέτρηση δεν παράγει ψεύτικη μετατόπιση.
  const containerLeftRef = useRef<number | null>(null);

  // Keep transformRef in sync every render (for ResizeObserver callback)
  transformRef.current = transform;

  // ── setTransform wrapper (sync ref + async React) ──────────────────────
  const setTransform = useCallback((newTransform: ViewTransform) => {
    transformRef.current = newTransform;
    updateImmediateTransform(newTransform); // Phase I: zero-lag canvas read (ADR-040)
    externalSetTransform(newTransform);
  }, [externalSetTransform]);

  // ── Internal: apply a new viewport to all targets ──────────────────────
  const applyViewport = useCallback((newViewport: Viewport) => {
    viewportRef.current = newViewport;
    setViewport(newViewport);
    onViewportChange?.(newViewport);
  }, [onViewportChange]);

  // ── Internal: measure the container and publish it ─────────────────────
  // ONE measurement path for all three call sites (initial, window resize, RAF-delayed
  // stabilization) — they used to be three copies of the same six lines. Also the place
  // where the container's screen-space left edge is seeded (ADR-724 §4.1), so the first
  // ResizeObserver delta is measured against a real baseline instead of `null`.
  const measureAndApply = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    containerLeftRef.current = rect.left;
    applyViewport({ width: rect.width, height: rect.height });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyViewport]);

  // ── ResizeObserver lifecycle ────────────────────────────────────────────
  useEffect(() => {
    let resizeObserver: ResizeObserver | null = null;

    const updateViewport = measureAndApply;

    const setupObserver = () => {
      const container = containerRef.current;
      if (!container) return;

      resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          if (width <= 0 || height <= 0) continue;

          // ── Update refs synchronously — canvas reads these immediately ──
          const oldHeight = viewportRef.current.height;
          const deltaHeight = oldHeight > 0 ? height - oldHeight : 0;

          // ADR-724 §4.1 — the screen-space left edge, read AFTER layout (the observer
          // fires post-layout, so this rect is current). Measured, never derived from the
          // width delta: that is what makes left-dock and right-dock share ONE rule.
          const measuredLeft = containerRef.current?.getBoundingClientRect().left;
          const previousLeft = containerLeftRef.current;
          const deltaLeft = measuredLeft !== undefined && previousLeft !== null
            ? measuredLeft - previousLeft
            : 0;
          if (measuredLeft !== undefined) containerLeftRef.current = measuredLeft;

          viewportRef.current = { width, height };
          canvasBoundsService.clearCache();

          const anchored = anchorTransformOnResize(transformRef.current, deltaHeight, deltaLeft);
          if (anchored !== transformRef.current) {
            dlog('Canvas', `[ResizeObserver] Δh=${deltaHeight.toFixed(1)} Δleft=${deltaLeft.toFixed(1)} offset ${transformRef.current.offsetX.toFixed(1)},${transformRef.current.offsetY.toFixed(1)}→${anchored.offsetX.toFixed(1)},${anchored.offsetY.toFixed(1)}`);
            transformRef.current = anchored;
          } else {
            dlog('Canvas', `[ResizeObserver] SKIP adjust: Δh=${deltaHeight.toFixed(1)} Δleft=${deltaLeft.toFixed(1)}`);
          }

          // ── Debounce React state updates — prevents 60fps re-renders during window drag ──
          if (resizeDebounceRef.current) clearTimeout(resizeDebounceRef.current);
          resizeDebounceRef.current = setTimeout(() => {
            externalSetTransform(transformRef.current);
            applyViewport(viewportRef.current);
            resizeDebounceRef.current = null;
          }, 100);
        }
      });

      resizeObserver.observe(container);
      // Initial measurement
      updateViewport();
    };

    // ── Retry mechanism for container mount timing ────────────────────
    let retryCount = 0;
    const maxRetries = 10;

    const trySetupObserver = () => {
      const container = containerRef.current;
      if (container) {
        setupObserver();
      } else if (retryCount < maxRetries) {
        retryCount++;
        setTimeout(trySetupObserver, PANEL_LAYOUT.TIMING.OBSERVER_RETRY);
      } else {
        dwarn('useViewportManager', 'Container not available after', maxRetries, 'retries');
      }
    };

    const timer = setTimeout(trySetupObserver, PANEL_LAYOUT.TIMING.OBSERVER_RETRY);
    window.addEventListener('resize', updateViewport);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateViewport);
      if (resizeObserver) resizeObserver.disconnect();
      if (resizeDebounceRef.current) clearTimeout(resizeDebounceRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Setup once — ResizeObserver handles updates

  // ── ADR-549 Phase 7: devicePixelRatio change → re-emit viewport ─────────
  // A DPR change (monitor/scaling switch) fires no ResizeObserver. Re-emit the SAME dimensions as a
  // NEW viewport object so viewport-prop consumers keyed on the object (e.g. FloorUnderlayOverlay)
  // re-run their DPR-aware sizing. (DxfCanvas/LayerCanvas/Preview re-size via their own DPR hooks.)
  useEffect(() => subscribeDevicePixelRatio(() => applyViewport({ ...viewportRef.current })), [applyViewport]);

  // ── ADR-724 Φ2: αλλαγή πλευράς αγκύρωσης → ξαναμέτρηση θέσης (ΟΧΙ αντιστάθμιση) ────────
  //
  // ⚠️ ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΑΥΤΟ — η παγίδα που κάνει τη Φ2 να ΜΗΝ είναι «απλή αντιστροφή σειράς».
  //
  // Όταν η παλέτα αλλάζει πλευρά, ο καμβάς **μετακινείται χωρίς να αλλάξει μέγεθος**: το panel
  // του κρατά ακριβώς το ίδιο πλάτος, απλώς βρίσκεται αλλού. Το `ResizeObserver` πυροδοτείται
  // **μόνο** σε αλλαγή μεγέθους — σε καθαρή μετατόπιση σιωπά. Δύο συνέπειες, και οι δύο σιωπηλές:
  //
  // 1. Το `containerLeftRef` μένει στην παλιά ακμή (π.χ. 392) ενώ η πραγματική είναι 0. Το
  //    **επόμενο** πραγματικό σύρσιμο υπολογίζει `Δleft = 0 − 392` και ο κανόνας του §4.1
  //    πετάει το σχέδιο ~392px — μια χειρονομία **μετά** την ενέργεια που το προκάλεσε.
  // 2. Το `CanvasBoundsService` ακυρώνει cache μόνο σε window-resize/scroll/λήξη 5s. Μια
  //    μετατόπιση δεν είναι τίποτα από αυτά ⇒ hit-test και snap δουλεύουν με λάθος origin.
  //
  // Η θεραπεία είναι **ξαναμέτρηση, όχι αντιστάθμιση**: το `measureAndApply` ξανασπέρνει την
  // ακμή χωρίς να αγγίξει το `transform`, άρα το σχέδιο μένει ακίνητο **μέσα** στον καμβά —
  // η συμπεριφορά Revit/AutoCAD (η κάμερα δεν αλλάζει επειδή μετακόμισε μια παλέτα).
  //
  // Ίδιο ακριβώς σχήμα με το ADR-549 Φ7 από πάνω: «γεγονός διάταξης που δεν παράγει
  // ResizeObserver ⇒ ρητή συνδρομή». Το ίδιο κάνουν οι docking managers των Revit/C4D —
  // ειδοποιούν τα viewports μετά από κάθε πράξη διάταξης αντί να περιμένουν observer.
  //
  // ⓘ Η συνδρομή είναι **imperative** (μηδέν `useSyncExternalStore`): ο καμβάς δεν χρειάζεται
  // να ξέρει *ποια* είναι η πλευρά — μόνο ότι κάτι μετακινήθηκε. Έτσι δεν υπάρχει
  // `if (mode === …)` πουθενά στο μονοπάτι απόδοσης (ADR-040 / ADR-724 §4.1).
  useEffect(() => subscribeDockMode(() => {
    // Άμεσα: κανένας αναγνώστης δεν πρέπει να προλάβει να διαβάσει το παλιό origin.
    canvasBoundsService.clearCache();
    // Και στο επόμενο καρέ, όταν ο browser έχει κάνει flush τη νέα διάταξη — μέχρι τότε κάθε
    // μέτρηση θα έδινε την προηγούμενη θέση (N.7.2 #4: δύο ανεξάρτητα μονοπάτια).
    UnifiedFrameScheduler.scheduleOnce('viewport-dock-reflow-remeasure', () => {
      canvasBoundsService.clearCache();
      measureAndApply();
    });
  }), [measureAndApply]);

  // ── RAF-delayed initial measurement ────────────────────────────────────
  // Ensures correct dimensions after browser layout stabilization (server restart edge case)
  useEffect(() => {
    const cancelScheduled = UnifiedFrameScheduler.scheduleOnceDelayed(
      'canvas-section-viewport-layout',
      measureAndApply,
      PANEL_LAYOUT.TIMING.VIEWPORT_LAYOUT_STABILIZATION,
    );

    return cancelScheduled;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount

  // ── Derived ────────────────────────────────────────────────────────────
  const viewportReady = viewport.width > 0 && viewport.height > 0;

  return {
    viewport,
    viewportRef,
    viewportReady,
    setTransform,
    transformRef,
  };
}
