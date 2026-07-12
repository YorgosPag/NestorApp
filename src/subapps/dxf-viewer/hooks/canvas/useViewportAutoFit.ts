'use client';

/**
 * useViewportAutoFit — the SINGLE auto-fit controller for the 2D canvas (ADR-399).
 *
 * Replaces three scattered auto-fit triggers (`useCanvasEffects` DXF fit,
 * `useFloorplanAutoFit`, `useAutoFitOnFileChange`) with ONE hook that owns the
 * auto-fit state and applies the pure {@link resolveAutoFitAction} policy. It never
 * re-implements the fit math — it delegates to the calculation SSoT:
 *   - DXF / combined content → `EventBus.emit('canvas-fit-to-view')` (the canonical
 *     path: `useFitToView` reads the live `dxfScene` + `colorLayers` and runs
 *     `FitToViewService`). ADR-040-blessed (always-fresh React state).
 *   - floorplan background    → `zoomSystem.zoomToFit(bgBounds)` (→ FitToViewService).
 *   - persisted restore       → `EventBus.emit('canvas-restore-viewport')` (ADR-400).
 *
 * Behaviour (Revit/AutoCAD): auto-frame ONCE on the first content of the session,
 * fit again only on a genuine re-import (new file under the SAME level), otherwise
 * keep the viewport stable — so floor→floor navigation always shows the same area.
 *
 * ADR-641 Φ4 — Block Editor (BEDIT) enter/exit fit lives here too (STILL one controller):
 * entering a block swaps the canvas to a block-LOCAL scene (members @ origin), so the world
 * transform would leave them off-screen. On the `useActiveBlockEditId()` transition this hook
 * saves the pre-enter view and delegates the enter fit to the ONE block-aware zoom-extents handler
 * (`useFitToView`'s `canvas-fit-to-view` listener, which reads the active block id and fits its
 * LOCAL bounds THROUGH the zoom system) via `EventBus.emit('canvas-fit-to-view')` — a single fit
 * implementation (N.18), and the ZoomManager stays in sync so a later wheel zoom stays on the block.
 * On exit it restores the saved view through `zoomSystem.setTransform` (AutoCAD parity), which also
 * re-syncs the ZoomManager to the world transform (a plain setter would leave it stale → first
 * post-exit wheel jumps). The scene-load policy effect is untouched — its deps don't change on
 * enter/exit, so the two never fight. Reading the low-freq active-block id here costs one
 * CanvasSection re-render per enter/exit gesture (never per-frame) — ADR-040-acceptable.
 *
 * @see systems/zoom/viewport-autofit-policy.ts — the pure decision SSoT
 * @see hooks/canvas/useFitToView.ts — the block-aware canvas-fit-to-view handler (block-local bounds)
 */

import { useEffect, useRef } from 'react';
import type { SceneModel } from '../../types/scene';
import type { ViewTransform } from '../../rendering/types/Types';
// ADR-641 Φ4 — BEDIT enter/exit viewport fit (see header). Enter delegates to the block-aware
// canvas-fit-to-view handler; exit restores the saved transform through the zoom system.
import { useActiveBlockEditId } from '../../systems/block/useActiveBlockEdit';
import { getImmediateTransform } from '../../systems/cursor/ImmediateTransformStore';
import type { FloorplanBackgroundForLevelResult } from '../../floorplan-background';
import { EventBus } from '../../systems/events';
import { readPersistedViewport } from '../../services/viewport-persistence';
// ADR-375 Phase B.4 — fit-to-paper AUTO drawing scale. Runs alongside the
// content fit (not on persisted-viewport restore) so a fresh import auto-frames
// its annotations at a standard 1:N instead of the oversized fixed 1:100.
import { computeFitToPaperScale } from '../../systems/dimensions/auto-drawing-scale';
import { useBimRenderSettingsStore } from '../../state/bim-render-settings-store';
import { MIN_VISIBLE_CONTENT_PX } from '../../config/transform-config';
import {
  resolveAutoFitAction,
  isDegenerateRestoreScale,
} from '../../systems/zoom/viewport-autofit-policy';
// Giorgio 2026-07-11 — user-initiated import intent (read-and-clear): forces a
// fit-to-extents that overrides the ADR-400 restore. Set by `useSceneState`.
import { consumeFreshImportFit } from '../../systems/zoom/viewport-fit-intent';
import { DXF_TIMING } from '../../config/dxf-timing';

/** Subset of the zoom system this hook needs (floorplan-background fit + BEDIT exit restore). */
interface ZoomSystemLike {
  zoomToFit: (
    bounds: { min: { x: number; y: number }; max: { x: number; y: number } },
    viewport: { width: number; height: number },
    alignToOrigin?: boolean,
  ) => { transform: ViewTransform } | null;
  /** ADR-641 — apply an absolute transform AND sync the ZoomManager (used by the BEDIT exit restore). */
  setTransform: (t: ViewTransform) => void;
}

export interface UseViewportAutoFitParams {
  /** Active DXF scene (entities + bounds) — drives content detection + fit target. */
  currentScene: SceneModel | null;
  /** Active level id — a change is NAVIGATION (never re-fits, keeps the viewport). */
  currentLevelId: string | null;
  /** Bound FileRecord id — a change under the SAME level is a re-import (fits). */
  fileRecordId: string | null;
  /** Floorplan raster background for the active level (its own fit target). */
  floorplanBg: FloorplanBackgroundForLevelResult | null;
  /** Live viewport size (for the background fit). */
  viewport: { width: number; height: number };
  /** Zoom system (background fit → FitToViewService). */
  zoomSystem: ZoomSystemLike;
  /** Transform setter (applies the background fit result). */
  setTransform: (t: ViewTransform) => void;
}

/** Delay before the deferred decision — immune to the cold-load fileRecordId race. */
const FIT_DELAY_MS = DXF_TIMING.ui.FIT_TO_VIEW_DELAY; // ADR-516

function sceneHasEntities(scene: SceneModel | null): boolean {
  return !!scene && Array.isArray(scene.entities) && scene.entities.length > 0;
}

/** Content diagonal in world units (DXF bounds preferred, else background bounds). */
function resolveContentDiagonal(
  scene: SceneModel | null,
  bg: FloorplanBackgroundForLevelResult | null,
): number {
  if (sceneHasEntities(scene) && scene?.bounds) {
    const w = scene.bounds.max.x - scene.bounds.min.x;
    const h = scene.bounds.max.y - scene.bounds.min.y;
    return Math.hypot(w, h);
  }
  if (bg?.background) {
    return Math.hypot(bg.background.naturalBounds.width, bg.background.naturalBounds.height);
  }
  return 0;
}

export function useViewportAutoFit({
  currentScene,
  currentLevelId,
  fileRecordId,
  floorplanBg,
  viewport,
  zoomSystem,
  setTransform,
}: UseViewportAutoFitParams): void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasFittedRef = useRef(false);
  const prevLevelIdRef = useRef<string | null>(null);
  const prevFileRecordIdRef = useRef<string | null>(null);

  // Latest values read at timer-fire time (not capture time), so the cold-load
  // fileRecordId that arrives a tick after the scene is the one used for restore.
  const sceneRef = useRef(currentScene);
  sceneRef.current = currentScene;
  const fileRecordIdRef = useRef(fileRecordId);
  fileRecordIdRef.current = fileRecordId;
  const bgRef = useRef(floorplanBg);
  bgRef.current = floorplanBg;
  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;
  const zoomRef = useRef(zoomSystem);
  zoomRef.current = zoomSystem;
  const setTransformRef = useRef(setTransform);
  setTransformRef.current = setTransform;

  // ADR-641 Φ4 — Block Editor session id (low-freq: one transition per enter/exit gesture).
  const activeBlockEditId = useActiveBlockEditId();
  const prevBlockEditIdRef = useRef<string | null>(null);
  const preEnterTransformRef = useRef<ViewTransform | null>(null);

  // N.18 — SSoT «apply this fit transform iff finite» for the floorplan-background load fit (the
  // block-editor enter fit no longer computes a transform here — it delegates to the block-aware
  // canvas-fit-to-view handler). A null/degenerate transform is a safe no-op.
  const applyFitTransform = (t: ViewTransform | null | undefined): void => {
    if (t && Number.isFinite(t.scale) && Number.isFinite(t.offsetX) && Number.isFinite(t.offsetY)) {
      setTransformRef.current(t);
    }
  };

  // ADR-375 Phase B.4 — pick a standard fit-to-paper 1:N from the scene's bounds
  // (canonical mm) and apply it via the store, unless the user has manually set
  // the scale this session (`applyAutoDrawingScale` guards that). Bounds are in mm
  // by construction (ADR-462), matching the paper-mm reference.
  const autoFitDrawingScale = (): void => {
    const scene = sceneRef.current;
    if (!sceneHasEntities(scene) || !scene?.bounds) return;
    const scale = computeFitToPaperScale(scene.bounds);
    if (scale != null) useBimRenderSettingsStore.getState().applyAutoDrawingScale(scale);
  };

  // Fit the current content to extents via the calculation SSoT. DXF → canonical
  // EventBus path (combined bounds); background-only → zoomToFit on its bounds.
  const fitCurrentContent = (): void => {
    if (sceneHasEntities(sceneRef.current)) {
      autoFitDrawingScale();
      EventBus.emit('canvas-fit-to-view', { source: 'auto' });
      return;
    }
    const bg = bgRef.current?.background;
    const vp = viewportRef.current;
    if (bg && vp.width > 0 && vp.height > 0) {
      applyFitTransform(
        zoomRef.current.zoomToFit(
          { min: { x: 0, y: 0 }, max: { x: bg.naturalBounds.width, y: bg.naturalBounds.height } },
          vp,
          false,
        )?.transform,
      );
    }
  };

  // ADR-400/418 — initial decision: restore the persisted viewport unless it is
  // degenerate, otherwise fit to extents.
  const performInitialDecision = (): void => {
    const persisted = readPersistedViewport(fileRecordIdRef.current);
    const diagonal = resolveContentDiagonal(sceneRef.current, bgRef.current);
    if (
      persisted.transform &&
      !isDegenerateRestoreScale(diagonal, persisted.transform.scale, MIN_VISIBLE_CONTENT_PX)
    ) {
      EventBus.emit('canvas-restore-viewport', { transform: persisted.transform });
    } else {
      fitCurrentContent();
    }
  };

  useEffect(() => {
    const hasContent = sceneHasEntities(currentScene) || !!floorplanBg?.background;
    const levelChanged = currentLevelId !== prevLevelIdRef.current;
    const fileChanged = !!fileRecordId && fileRecordId !== prevFileRecordIdRef.current;
    // Giorgio 2026-07-11 — a user-initiated file import (any type) must ALWAYS fit,
    // overriding the persisted-viewport restore. Consume-once so the deferred fit's
    // re-render never re-reads a stale intent. This replaces the old imperative
    // `EventBus.emit('canvas-fit-to-view')` in `useSceneState` → single controller,
    // no double-emit race (ADR-399).
    const freshImport = consumeFreshImportFit();

    const action = resolveAutoFitAction({
      hasContent,
      hasFittedOnce: hasFittedRef.current,
      levelChanged,
      fileChanged,
      freshImport,
    });

    // Adopt the latest identity so the NEXT evaluation compares against it.
    if (fileChanged) prevFileRecordIdRef.current = fileRecordId;
    prevLevelIdRef.current = currentLevelId;

    if (action === 'skip') return;

    // Latch «already fitted» synchronously for BOTH the one-time initial decision AND
    // a fresh-import fit, so a re-run during the defer never schedules twice and
    // subsequent scene mutations fall through to 'skip' (keep the viewport stable).
    if (action === 'initial' || freshImport) hasFittedRef.current = true;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(
      action === 'initial' ? performInitialDecision : fitCurrentContent,
      FIT_DELAY_MS,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentScene, currentLevelId, fileRecordId, floorplanBg?.background, viewport.width, viewport.height]);

  // ADR-641 Φ4 — Block Editor enter/exit viewport fit (see header). Separate effect keyed ONLY on the
  // active-block id so it fires on the enter/exit gesture and never on scene mutations / navigation.
  useEffect(() => {
    const prev = prevBlockEditIdRef.current;
    if (prev === activeBlockEditId) return;
    prevBlockEditIdRef.current = activeBlockEditId;

    if (activeBlockEditId) {
      // ENTER: remember the current world view, then delegate to the ONE block-aware zoom-extents
      // handler (useFitToView reads the active block id and fits its LOCAL bounds through the zoom
      // system). Emitting — instead of a second, divergent fit here — keeps a single fit
      // implementation (N.18) and keeps the ZoomManager in sync so a subsequent wheel zoom stays on
      // the block. Capture BEFORE emit, since the handler runs synchronously and changes the view.
      preEnterTransformRef.current = getImmediateTransform();
      EventBus.emit('canvas-fit-to-view', { source: 'block-edit-enter' });
    } else if (prev) {
      // EXIT: restore exactly the view the user had before entering (AutoCAD BEDIT parity), THROUGH
      // the zoom system so the ZoomManager re-syncs to the world transform (a plain setter would
      // leave it stale → the first post-exit wheel zoom would jump).
      const saved = preEnterTransformRef.current;
      preEnterTransformRef.current = null;
      if (saved) zoomRef.current.setTransform(saved);
    }
  }, [activeBlockEditId]);

  // Clear any pending timer only on unmount — never on a mid-load re-run.
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);
}
