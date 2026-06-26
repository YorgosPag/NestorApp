"use client";

import { useEffect, useRef, useCallback, useSyncExternalStore, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/auth/hooks/useAuth';
import { useProjectHierarchyOptional } from '../../contexts/ProjectHierarchyContext';
import { PerformanceHUD } from '../performance/PerformanceHUD';
import { ThreeJsSceneManager } from '../scene/ThreeJsSceneManager';
// ADR-453 — register the live manager so the print engine can snapshot the 3D view.
import { setActiveSceneManager } from '../scene/active-scene-manager-registry';
import { useViewMode3DStore, selectIs3D } from '../stores/ViewMode3DStore';
import type { ReducedMotionOverride } from '../accessibility/use-reduced-motion';
import { LIGHT_PRESETS } from '../lighting/lighting-presets';
import { useBim3DEntitiesStore, type Bim3DEntities } from '../stores/Bim3DEntitiesStore';
import { useQuickProperties3DStore } from '../stores/QuickProperties3DStore';
import { useSelection3DStore } from '../stores/Selection3DStore';
import { clearSceneBboxGetter, setSceneBboxGetter } from '../stores/SceneBboxProvider';
import { useBuildingFloors3DSync } from '../../components/dxf-layout/useBuildingFloors3DSync';
import { QuickProperties3DHoverPopover } from '../properties/QuickProperties3DHoverPopover';
import { CutPlaneSlider3DLeaf } from './CutPlaneSlider3DLeaf';
import { Section2DPanel } from '../panels/Section2DPanel';
import { RenderFinalDialog } from '../render/RenderFinalDialog';
import { RenderProgressOverlay } from '../render/RenderProgressOverlay';
import { ViewCubeContextMenu } from './view-cube/view-cube-context-menu';
import { Grip3DVertexContextMenu } from './grips/Grip3DVertexContextMenu';
import { Bim3DPreferencesService } from '../services/Bim3DPreferencesService';
import { use3DShortcuts } from '../shortcuts/use3DShortcuts';
import { FocusIndicator3D } from '../accessibility/FocusIndicator3D';
import { AriaLiveRegion } from '../accessibility/AriaLiveRegion';
import { CropRegionOverlay } from '../render/crop-region/CropRegionOverlay';
import { useCropRegionTool } from '../render/crop-region/useCropRegionTool';
import { useBimEntityProxyAccessibility } from '../accessibility/use-bim-entity-proxy-accessibility';
import { useAnimationQueueProcessor } from '../animation/animation-queue-processor';
import { useWaypointDragInteraction } from '../animation/use-waypoint-drag-interaction';
import { useBim3DEditInteraction } from '../animation/use-bim3d-edit-interaction';
import { useBim3DPlacementAndPickHooks } from './use-bim3d-placement-and-pick-hooks';
import { ClashMarkers3DOverlay } from '../coordination/ClashMarkers3DOverlay';
import { ProposalGhost3DMount } from '../proposal/ProposalGhost3DMount';
import { ColumnDiagram3DOverlay } from '../diagrams/ColumnDiagram3DOverlay';
import { BeamDiagram3DOverlay } from '../diagrams/BeamDiagram3DOverlay';
import { useNotifications } from '@/providers/NotificationProvider';
import { useBim3DStoreSync } from './use-bim3d-store-sync';
import { useBim3DVgResync } from './use-bim3d-vg-resync';
import { useBim3DMultiFloorSync } from './use-bim3d-multifloor-sync';
import { resyncBimScene } from '../scene/bim3d-resync';
import { resyncDxfOverlay } from '../scene/dxf-overlay-resync';
import { useBim3DPointerHandlers } from './use-bim3d-pointer-handlers';
import { useBim3DRenderControls } from './use-bim3d-render-controls';
import { UnifiedFrameScheduler, RENDER_PRIORITIES } from '../../rendering/core/UnifiedFrameScheduler';

// ── BimViewport3D ─────────────────────────────────────────────────────────────
// ADR-040 micro-leaf compliant: subscribes to ViewMode3DStore (not high-freq),
// renders ≤1 canvas element. Ownership: ThreeJsSceneManager handles Three.js.
//
// ADR-371: optional props let Properties read-only pipeline mount the same
// viewport without ProjectHierarchyProvider and without global entity store.
// Default behavior (no props) = legacy /dxf/viewer path (canvas-layer-stack-3d-leaf).

export interface BimViewport3DProps {
  /** Override hierarchy projectId — required for render uploads. Falls back to ProjectHierarchyContext. */
  projectId?: string | null;
  /** Read-only mode: hides render button, dialog, progress overlay. Floors/Lighting/Quality panel stays visible. */
  readOnly?: boolean;
  /** External BIM entity feed (Properties read-only). When provided, replaces Bim3DEntitiesStore subscription. */
  bimEntities?: Bim3DEntities | null;
  /** Controlled visibility — overrides global ViewMode3DStore when provided (ADR-371 read-only). */
  visible?: boolean;
  /** Called when user clicks the ← 2D exit button in readOnly mode. */
  onClose?: () => void;
}

export function BimViewport3D({ projectId: projectIdProp, readOnly = false, bimEntities, visible, onClose }: BimViewport3DProps = {}) {
  const { t } = useTranslation('bim3d');
  const containerRef = useRef<HTMLDivElement>(null);
  const managerRef = useRef<ThreeJsSceneManager | null>(null);
  const errorRef = useRef<string | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** ADR-040 Phase XXIII — handle to unregister BIM 3D scene from UnifiedFrameScheduler. */
  const unregisterSchedulerRef = useRef<(() => void) | null>(null);
  const [canvasEl, setCanvasEl] = useState<HTMLCanvasElement | null>(null);
  const [renderDialogOpen, setRenderDialogOpen] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [compassVisible, setCompassVisible] = useState(true);
  const { user } = useAuth();
  const hierarchy = useProjectHierarchyOptional();
  const projectId = projectIdProp ?? hierarchy?.selectedProject?.id ?? null;
  const externalEntitiesMode = bimEntities !== undefined;

  // ADR-369 Q2.2 — feed buildings + floors to store whenever project changes.
  useBuildingFloors3DSync(projectId);

  // Low-frequency store subscriptions (user-triggered entity changes — not 60fps)
  const is3DFromStore = useSyncExternalStore(
    useViewMode3DStore.subscribe,
    () => selectIs3D(useViewMode3DStore.getState()),
    () => false,
  );
  // ADR-371: `visible` prop overrides global store (read-only Properties pipeline).
  const effectiveVisible = visible !== undefined ? visible : is3DFromStore;

  // Phase 4.3 + C.5: load persisted preferences (ViewCube + accessibility) on user mount.
  useEffect(() => {
    if (!user?.uid) return;
    Bim3DPreferencesService.load(user.uid).then((prefs) => {
      if (!prefs) return;
      setCompassVisible(prefs.compassRingVisible);
      if (prefs.accessibility) {
        const a = prefs.accessibility;
        const store = useViewMode3DStore.getState();
        store.setAnnouncementsEnabled(a.announcementsEnabled);
        store.setAccessibilityReducedMotion(a.reducedMotion);
        store.setAccessibilityEntityNavOrder(a.entityNavOrder);
        managerRef.current?.setReducedMotionOverride(a.reducedMotion);
      }
    }).catch(() => { /* silently ignore — defaults apply */ });
  }, [user?.uid]);

  // Phase 4.3: wire context menu callback + initial compass state into manager on 3D activation.
  // Also re-applies when compassVisible changes so prefs loaded async before 3D opens take effect.
  useEffect(() => {
    managerRef.current?.setViewCubeContextMenuCallback((x, y) => setContextMenuPos({ x, y }));
    managerRef.current?.setViewCubeCompassVisible(compassVisible);
  }, [effectiveVisible, compassVisible]);

  const isRendering = useSyncExternalStore(
    useViewMode3DStore.subscribe,
    () => useViewMode3DStore.getState().mode === '3d-final',
    () => false,
  );

  // Mount / unmount Three.js scene.
  // Initial data sync happens HERE, immediately after manager creation — the only
  // safe moment where managerRef.current is guaranteed non-null. The [] subscription
  // effects below run on component mount (is3D still false → manager null) so their
  // getState() calls would be no-ops; correct sync must live in this [is3D] effect.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !effectiveVisible) return;

    try {
      managerRef.current = new ThreeJsSceneManager(container);
    } catch (err) {
      errorRef.current = err instanceof Error ? err.message : String(err);
      return;
    }

    // ADR-040 Phase XXIII / ADR-366 Phase 4.2 — BIM 3D scene driven by the master rAF.
    // Industry-standard pattern (Forge Viewer SDK / Three.js Editor / iModel.js /
    // AutoCAD Web): single master rAF + per-subsystem dirty-check + on-demand render.
    unregisterSchedulerRef.current = UnifiedFrameScheduler.register(
      'bim-3d-scene',
      'BIM 3D Scene',
      RENDER_PRIORITIES.NORMAL,
      (deltaTime) => managerRef.current?.tick(performance.now(), deltaTime),
      () => managerRef.current?.isSceneDirty() ?? false,
    );

    setCanvasEl(managerRef.current.getRendererCanvas());
    // ADR-453 — expose this manager to the print engine (cleared on unmount).
    setActiveSceneManager(managerRef.current);

    // ADR-366 §C.1.b — bridge real scene bbox σε `useDxfViewerCallbacks` animation actions.
    setSceneBboxGetter(() => managerRef.current?.getSceneFramingBounds() ?? null);

    // Initial entity sync — ADR-399 scope-aware SSoT (single active level OR the
    // stacked building). External prop overrides global store when provided (ADR-371).
    const initialFloorModes = useViewMode3DStore.getState().floorVisibilityModes;
    resyncBimScene(managerRef.current, { externalEntitiesMode, bimEntities });
    // ADR-399 Phase B — scope-aware (single active overlay OR stacked per-floor plans).
    resyncDxfOverlay(managerRef.current);

    // ADR-382 Phase C — post-hoc apply preserves ghost styling + defense-in-depth
    // for floor-mode toggles between rebuilds. Hide is handled pre-mesh in sync().
    if (initialFloorModes.size > 0) managerRef.current.applyFloorVisibility(initialFloorModes);

    // Apply current lighting preset immediately.
    const { sunPreset } = useViewMode3DStore.getState();
    managerRef.current.applyLightPreset(LIGHT_PRESETS[sunPreset]);

    // ResizeObserver: propagate container size changes
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry || !managerRef.current) return;
      const { width, height } = entry.contentRect;
      managerRef.current.resize(width, height);
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      setCanvasEl(null);
      useQuickProperties3DStore.getState().clearHover();
      useSelection3DStore.getState().clearSelection();
      clearSceneBboxGetter();
      setActiveSceneManager(null); // ADR-453 — print engine can no longer snapshot 3D.
      // ADR-040 Phase XXIII — unregister from scheduler BEFORE disposing the manager
      // so no in-flight tick can race a disposed Three.js renderer.
      unregisterSchedulerRef.current?.();
      unregisterSchedulerRef.current = null;
      managerRef.current?.dispose();
      managerRef.current = null;
      errorRef.current = null;
    };
  }, [effectiveVisible]);

  // Ongoing subscriptions: fire when store data changes AFTER 3D mode is active.
  // ADR-371: skipped when external bimEntities prop drives the scene.
  useEffect(() => {
    if (externalEntitiesMode) return;
    // ADR-399 — scope-aware: 'single' rebuilds the active level; 'all' rebuilds
    // the stacked building from the current multi-floor source snapshot.
    return useBim3DEntitiesStore.subscribe(() => {
      resyncBimScene(managerRef.current, { externalEntitiesMode: false });
    });
  }, [externalEntitiesMode]);

  // Building visibility: re-apply whenever modes change (no full rebuild needed).
  useEffect(() => {
    if (externalEntitiesMode) return;
    return useBim3DEntitiesStore.subscribe(
      (s) => s.buildingVisibilityModes,
      (modes) => { managerRef.current?.applyBuildingVisibility(modes); },
    );
  }, [externalEntitiesMode]);

  useBim3DVgResync(managerRef, externalEntitiesMode, bimEntities);

  // ADR-371: external entity feed — push prop changes into the scene.
  useEffect(() => {
    if (!externalEntitiesMode) return;
    resyncBimScene(managerRef.current, { externalEntitiesMode: true, bimEntities });
  }, [externalEntitiesMode, bimEntities]);

  useBim3DStoreSync(managerRef);
  // ADR-399 Phase B — multi-floor ("Όλοι οι όροφοι") aggregation + sync wiring.
  useBim3DMultiFloorSync(managerRef, externalEntitiesMode, bimEntities);

  // ADR-366 §B.4/§B.6 — final-render control callbacks (extracted hook, N.7.1).
  const { handleRenderConfirm, handleRenderCancel, handleCalibrateSample } =
    useBim3DRenderControls({ managerRef, user, projectId });

  // Phase 4.3: compass ring toggle — optimistic update + Firestore persistence
  const handleToggleCompass = useCallback(() => {
    const next = !compassVisible;
    setCompassVisible(next);
    setContextMenuPos(null);
    if (user?.uid) {
      Bim3DPreferencesService.save(user.uid, { compassRingVisible: next }).catch(() => {
        // On save failure revert optimistic update
        setCompassVisible(!next);
      });
    }
  }, [compassVisible, user?.uid]);

  // Phase 9 / C.5: entity DOM proxy + keyboard navigator (accessibility for AT).
  useBimEntityProxyAccessibility({
    containerRef,
    managerRef,
    effectiveVisible,
    externalEntitiesMode,
  });

  // Phase 9 / C.1.b — Waypoint 3D drag interaction. Wires pointer events on
  // the renderer canvas to the WaypointDragController; only active when
  // AnimationStore.toolActive === true (controller listeners attach/detach).
  useWaypointDragInteraction({ managerRef, canvasEl });

  // ADR-402 §Sub-Phase 2 — BIM move gizmo (G). Mounts the floor-plane move
  // handle + pointer drag → view-agnostic MoveEntityCommand (auto-resync,
  // openings cascade). Disabled when there is no levels context (ADR-371).
  useBim3DEditInteraction({ managerRef, canvasEl });

  // ADR-403/406/410/408/401/363 — all 3D placement and pick hooks (aggregated,
  // N.7.1): column, MEP fixtures, furniture, electrical panel, manifold, segment,
  // radiator, boiler, attach-pick, beam-from-wall, wire waypoint editing.
  useBim3DPlacementAndPickHooks({ managerRef, canvasEl });

  // Phase 9 / C.1.c — Animation render queue driver. Mounted once; subscribes
  // to RenderQueueStore and drives the MP4 encode pipeline when a job is queued.
  const notifications = useNotifications();
  useAnimationQueueProcessor({
    managerRef,
    companyId: user?.companyId ?? null,
    projectId: projectId ?? null,
    callbacks: {
      onRenderStarted: (name) =>
        notifications.info(t('animation.notification.renderStarted', { name })),
      onRenderCompleted: (name) =>
        notifications.success(t('animation.notification.renderCompleted', { name })),
      onRenderFailed: (name, reason) =>
        notifications.error(t('animation.notification.renderFailed', { name, reason })),
      onRenderCancelled: (name) =>
        notifications.info(t('animation.notification.renderCancelled', { name })),
    },
  });

  // Phase 9 / C.5.Q5: sync reduced-motion override from store → ThreeJsSceneManager.
  useEffect(() => {
    return useViewMode3DStore.subscribe(
      (s) => s.accessibilityReducedMotion,
      (override) => { managerRef.current?.setReducedMotionOverride(override as ReducedMotionOverride); },
    );
  }, []);

  const onCropRegionToggle = useCropRegionTool({ managerRef, active: effectiveVisible });
  use3DShortcuts({
    getManager: () => managerRef.current,
    active: effectiveVisible,
    onCropRegionToggle,
  });

  // Pointer interaction (hover-raycast + click-select + Alt+click pivot) — ADR-366 §A.6.Q5.
  const { handleMouseMove, handleClick, handleMouseLeave } = useBim3DPointerHandlers(
    managerRef,
    debounceTimerRef,
  );

  if (!effectiveVisible) return null;

  if (errorRef.current) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-background text-destructive text-sm">
        {t('viewport.webglError')}
      </div>
    );
  }

  // z-50: float above all 2D canvas layers (z-[0..30]).
  // stopPropagation on React synthetic events: prevents 2D drawing handlers
  // (containerHandlers.onMouseDown etc.) from firing while in 3D mode.
  // Three.js camera DOM listeners still fire — DOM bubbling is unaffected by
  // React stopPropagation, so OrbitControls receives events normally.
  return (
    <>
      {/* Skip link — allows keyboard/AT users to bypass 3D content. */}
      <a
        href="#bim-3d-canvas-skip"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[200] focus:rounded focus:bg-background focus:px-3 focus:py-1 focus:text-sm focus:shadow"
      >
        {t('aria.canvas.skipLink')}
      </a>
    <div
      className="absolute inset-0 z-50 cursor-grab active:cursor-grabbing"
      role="application"
      aria-label={t('aria.canvas.rootLabel')}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      {/* Three.js appends renderer canvas + ViewCube canvas directly into this div. */}
      <div
        ref={containerRef}
        className="absolute inset-0"
        role="presentation"
      />
      <CropRegionOverlay />
      {/* Exit button top-left — clear of ViewCube at top-right (ADR-366 §9 Q1). */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={readOnly && onClose ? onClose : () => useViewMode3DStore.getState().toggle2D3D()}
            aria-label={t('modeToggle.aria')}
            className="absolute left-3 top-3 z-30 flex select-none items-center gap-1 rounded border border-white/20 bg-black/40 px-2 py-1 text-xs font-medium text-white/80 backdrop-blur-sm transition-colors hover:bg-black/60 hover:text-white"
          >
            <span aria-hidden="true">←</span>
            {' 2D'}
          </button>
        </TooltipTrigger>
        <TooltipContent>{t('modeToggle.tooltip3d')}</TooltipContent>
      </Tooltip>

      {/* QuickProperties tooltip (ADR-366 B.2.Q1) — micro-leaf, fixed position */}
      <QuickProperties3DHoverPopover />

      {/* ADR-366 — BIM entity card μεταφέρθηκε στο αριστερό Properties palette
          (BimPropertiesShell: Παράμετροι | ΒΚΕ | Σχόλια | Ιστορικό). Μηδέν
          δεύτερο panel στον καμβά (Revit-grade single palette). */}

      {/* ADR-452 — cut-plane slider (3D mount); drives the horizontal section clip. */}
      <CutPlaneSlider3DLeaf />

      {/* ADR-435 Slice 1b — 3D clash markers (DOM ⊙ projected via camera; same glyph as 2D). */}
      <ClashMarkers3DOverlay managerRef={managerRef} />

      {/* MEP auto-design 3D proposal ghost (SSoT twin of the 2D ProposalGhostOverlay). */}
      <ProposalGhost3DMount managerRef={managerRef} />

      {/* ADR-483 Slice 5 — 3D column M/V/N diagrams (κατακόρυφος άξονας· twin του 2Δ StructuralDiagramOverlay). */}
      <ColumnDiagram3DOverlay managerRef={managerRef} />

      {/* ADR-483 Slice 6 — 3D beam M/V/N diagrams (κάθετο επίπεδο ανοίγματος· δίδυμο των κολωνών). */}
      <BeamDiagram3DOverlay managerRef={managerRef} />


      {/* ADR-366 §A.3 Q3 Phase 7.0B — 2D Live Section Panel (bottom strip, toggle from Section tab) */}
      <Section2DPanel />

      {/* Phase 4.3: ViewCube right-click context menu (compass toggle) */}
      <ViewCubeContextMenu
        anchor={contextMenuPos}
        compassVisible={compassVisible}
        onToggleCompass={handleToggleCompass}
        onClose={() => setContextMenuPos(null)}
      />

      {/* ADR-535 Φ4 — per-vertex reshape-grip context menu (delete / insert vertex) */}
      <Grip3DVertexContextMenu />

      {/* Phase 4.5 / A.7.Q1 — keyboard focus floating label (renders only when focused) */}
      {canvasEl && managerRef.current && (
        <FocusIndicator3D
          focusManager={managerRef.current.getKeyboardFocusManager()}
          getEntityData={(id) => managerRef.current?.getFocusedEntityData(id) ?? null}
          getCamera={() => managerRef.current?.getCamera() ?? null}
          getCanvas={() => canvasEl}
        />
      )}

      {/* Floating Render button — bottom-right, above Performance HUD (ADR-366 §B.4 Phase 6).
          ADR-371: hidden in readOnly mode (Properties pipeline). */}
      {!isRendering && !readOnly && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setRenderDialogOpen(true)}
              aria-label={t('render.button.triggerLabel')}
              className="absolute bottom-14 right-3 z-[70] flex select-none items-center gap-1.5 rounded-md border border-white/20 bg-black/60 px-3 py-1.5 text-xs font-semibold text-primary backdrop-blur-sm transition-colors hover:bg-black/80 hover:text-primary/80"
            >
              ✦ {t('render.button.render')}
            </button>
          </TooltipTrigger>
          <TooltipContent side="left">{t('render.button.triggerLabel')}</TooltipContent>
        </Tooltip>
      )}

      {/* Render progress overlay — visible only during final render. Suppressed in readOnly. */}
      {isRendering && !readOnly && (
        <RenderProgressOverlay onCancel={handleRenderCancel} />
      )}

      {/* Render dialog — Radix (ADR-001). Suppressed in readOnly. */}
      {!readOnly && (
        <RenderFinalDialog
          open={renderDialogOpen}
          onOpenChange={setRenderDialogOpen}
          onConfirm={handleRenderConfirm}
          rendererCanvas={canvasEl}
          onCalibrateSample={handleCalibrateSample}
        />
      )}

      {/* Performance HUD (ADR-366 B.5) — micro-leaf, bottom-right */}
      <PerformanceHUD
        canvas={canvasEl}
        projectId={projectId ?? null}
        userId={user?.uid ?? null}
        companyId={user?.companyId ?? null}
      />

      {/* Phase 8.0+8.1 / A.7.Q2 — ARIA live regions + entity descriptions on Tab focus */}
      <AriaLiveRegion
        focusManager={managerRef.current?.getKeyboardFocusManager() ?? null}
        getEntityData={managerRef.current ? (id) => managerRef.current!.getFocusedEntityData(id) : null}
      />

    </div>

    {/* Skip-link target — placed after the 3D viewport div. */}
    <span id="bim-3d-canvas-skip" tabIndex={-1} className="sr-only" aria-hidden="true" />
    </>
  );
}
