"use client";

import { useEffect, useRef, useCallback, useSyncExternalStore, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/auth/hooks/useAuth';
import { useProjectHierarchyOptional } from '../../contexts/ProjectHierarchyContext';
import { PerformanceHUD } from '../performance/PerformanceHUD';
import { ThreeJsSceneManager } from '../scene/ThreeJsSceneManager';
import { useViewMode3DStore, selectIs3D } from '../stores/ViewMode3DStore';
import type { ReducedMotionOverride } from '../accessibility/use-reduced-motion';
import { useEnvironmentStore } from '../stores/EnvironmentStore';
import { useSectionStore } from '../stores/SectionStore';
import { LIGHT_PRESETS } from '../lighting/lighting-presets';
import { getHdriPreset } from '../lighting/hdri-environment';
import { useBim3DEntitiesStore, type Bim3DEntities } from '../stores/Bim3DEntitiesStore';
import { useDxfOverlay3DStore } from '../stores/DxfOverlay3DStore';
import { useQuickProperties3DStore } from '../stores/QuickProperties3DStore';
import { useSelection3DStore } from '../stores/Selection3DStore';
import { useBuildingFloors3DSync } from '../../components/dxf-layout/useBuildingFloors3DSync';
import { QuickProperties3DHoverPopover } from '../properties/QuickProperties3DHoverPopover';
import { BimEntityCardPanel } from '../properties/BimEntityCardPanel';
import { Section2DPanel } from '../panels/Section2DPanel';
import { RenderFinalDialog } from '../render/RenderFinalDialog';
import { RenderProgressOverlay } from '../render/RenderProgressOverlay';
import type { FinalRenderConfig } from '../stores/ViewMode3DStore';
import { ViewCubeContextMenu } from './view-cube/view-cube-context-menu';
import { Bim3DPreferencesService } from '../services/Bim3DPreferencesService';
import { use3DShortcuts } from '../shortcuts/use3DShortcuts';
import { FocusIndicator3D } from '../accessibility/FocusIndicator3D';
import { AriaLiveRegion } from '../accessibility/AriaLiveRegion';
import { CropRegionOverlay } from '../render/crop-region/CropRegionOverlay';
import { useCropRegionTool } from '../render/crop-region/useCropRegionTool';
import { useBimEntityProxyAccessibility } from '../accessibility/use-bim-entity-proxy-accessibility';

const HOVER_DEBOUNCE_MS = 800;

// ── BimViewport3D ─────────────────────────────────────────────────────────────
// ADR-040 micro-leaf compliant: subscribes to ViewMode3DStore (not high-freq),
// renders ≤1 canvas element. Ownership: ThreeJsSceneManager handles Three.js.
//
// ADR-371: optional props let Properties read-only pipeline mount the same
// viewport without ProjectHierarchyProvider and without global entity store.
// Default behavior (no props) = legacy /dxf/viewer path (canvas-layer-stack-3d-leaf).

const EMPTY_BIM_ENTITIES: Bim3DEntities = {
  walls: [],
  columns: [],
  beams: [],
  slabs: [],
  stairs: [],
};

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

    setCanvasEl(managerRef.current.getRendererCanvas());

    // Initial entity sync — external prop overrides global store when provided (ADR-371).
    if (externalEntitiesMode) {
      managerRef.current.syncBimEntities(bimEntities ?? EMPTY_BIM_ENTITIES, 0, undefined);
    } else {
      const entitiesState = useBim3DEntitiesStore.getState();
      const { walls, columns, beams, slabs, stairs, activeLevelId, floors, buildings, activeBuildingId, buildingVisibilityModes } = entitiesState;
      managerRef.current.syncBimEntities({ walls, columns, beams, slabs, stairs }, 0, activeLevelId ?? undefined, floors, buildings, activeBuildingId, buildingVisibilityModes);
    }
    managerRef.current.syncDxfOverlay(useDxfOverlay3DStore.getState().dxfScene);

    // Apply current floor visibility modes immediately.
    const modes = useViewMode3DStore.getState().floorVisibilityModes;
    if (modes.size > 0) managerRef.current.applyFloorVisibility(modes);

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
      managerRef.current?.dispose();
      managerRef.current = null;
      errorRef.current = null;
    };
  }, [effectiveVisible]);

  // Ongoing subscriptions: fire when store data changes AFTER 3D mode is active.
  // ADR-371: skipped when external bimEntities prop drives the scene.
  useEffect(() => {
    if (externalEntitiesMode) return;
    return useBim3DEntitiesStore.subscribe((s) => {
      managerRef.current?.syncBimEntities(
        { walls: s.walls, columns: s.columns, beams: s.beams, slabs: s.slabs, stairs: s.stairs },
        0,
        s.activeLevelId ?? undefined,
        s.floors,
        s.buildings,
        s.activeBuildingId,
        s.buildingVisibilityModes,
      );
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

  // ADR-371: external entity feed — push prop changes into the scene.
  useEffect(() => {
    if (!externalEntitiesMode) return;
    managerRef.current?.syncBimEntities(bimEntities ?? EMPTY_BIM_ENTITIES, 0, undefined);
  }, [externalEntitiesMode, bimEntities]);

  useEffect(() => {
    return useDxfOverlay3DStore.subscribe((s) => {
      managerRef.current?.syncDxfOverlay(s.dxfScene);
    });
  }, []);

  // Floor visibility: re-apply whenever modes change.
  useEffect(() => {
    return useViewMode3DStore.subscribe(
      (s) => s.floorVisibilityModes,
      (modes) => { managerRef.current?.applyFloorVisibility(modes); },
    );
  }, []);

  // Sun position changes → update Three.js
  useEffect(() => {
    return useViewMode3DStore.subscribe(
      (s) => ({ az: s.sunAzimuthDeg, el: s.sunElevationDeg }),
      ({ az, el }) => { managerRef.current?.updateSunPosition(az, el); },
      { equalityFn: (a, b) => a.az === b.az && a.el === b.el },
    );
  }, []);

  // Preset changes → apply full preset (colors + intensity + position)
  useEffect(() => {
    return useViewMode3DStore.subscribe(
      (s) => s.sunPreset,
      (preset) => { managerRef.current?.applyLightPreset(LIGHT_PRESETS[preset]); },
    );
  }, []);

  // HDRI preset selection → resolve URL → EnvironmentStore (ThreeJsSceneManager reacts to hdriUrl)
  useEffect(() => {
    return useEnvironmentStore.subscribe(
      (s) => s.hdriPresetId,
      (id) => {
        const preset = getHdriPreset(id);
        if (preset) useEnvironmentStore.getState().setHdriUrl(preset.url);
      },
    );
  }, []);

  // ADR-366 §A.3 — safety net: user enables section before geometry sync → ensure init runs.
  useEffect(() => {
    return useSectionStore.subscribe(
      (s) => s.enabled,
      (enabled) => { if (enabled) managerRef.current?.initSectionBox(); },
    );
  }, []);

  const handleRenderConfirm = useCallback((config: FinalRenderConfig) => {
    const manager = managerRef.current;
    if (!manager || !user || !projectId) return;
    const store = useViewMode3DStore.getState();
    store.startFinalRender(config);
    manager.startFinalRender(
      config,
      { projectId, companyId: user.companyId ?? '', userId: user.uid },
      (pct) => store.updateFinalRenderProgress(pct),
      (result) => {
        store.completeFinalRender();
        if (result.uploadError) {
          // Toast fires from parent app notification — upload error logged silently
          console.warn('[BimViewport3D] render upload failed — fallback disk save applied');
        }
      },
    );
  }, [user, projectId]);

  const handleRenderCancel = useCallback(() => {
    managerRef.current?.cancelFinalRender();
    useViewMode3DStore.getState().completeFinalRender();
  }, []);

  const handleCalibrateSample = useCallback(() => {
    // No-op: GPU calibration uses its own timed loop inside render-cost-estimator.
    // PathTracerRenderer.renderSample() is only called from the RAF loop.
    // We use performance.now() inside calibrateGpu with a lightweight JS loop.
  }, []);

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

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const { clientX, clientY } = e;
    if (debounceTimerRef.current !== null) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      const hit = managerRef.current?.raycastBimEntities(clientX, clientY);
      if (hit) {
        useQuickProperties3DStore.getState().setHovered(hit.bimId, hit.bimType, clientX, clientY);
      } else {
        useQuickProperties3DStore.getState().clearHover();
      }
    }, HOVER_DEBOUNCE_MS);
  }, []);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const hit = managerRef.current?.raycastBimEntities(e.clientX, e.clientY);
    managerRef.current?.selectBimEntity(hit?.bimId ?? null);
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    useQuickProperties3DStore.getState().clearHover();
  }, []);

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

      {/* BIM entity card panel (ADR-366 B.2.Q4) — micro-leaf, absolute right-side panel */}
      <BimEntityCardPanel />

      {/* ADR-366 §A.3 Q3 Phase 7.0B — 2D Live Section Panel (bottom strip, toggle from Section tab) */}
      <Section2DPanel />

      {/* Phase 4.3: ViewCube right-click context menu (compass toggle) */}
      <ViewCubeContextMenu
        anchor={contextMenuPos}
        compassVisible={compassVisible}
        onToggleCompass={handleToggleCompass}
        onClose={() => setContextMenuPos(null)}
      />

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
