"use client";

import { useEffect, useRef, useCallback, useSyncExternalStore, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/auth/hooks/useAuth';
import { useProjectHierarchy } from '../../contexts/ProjectHierarchyContext';
import { PerformanceHUD } from '../performance/PerformanceHUD';
import { ThreeJsSceneManager } from '../scene/ThreeJsSceneManager';
import { useViewMode3DStore, selectIs3D } from '../stores/ViewMode3DStore';
import { LIGHT_PRESETS } from '../lighting/lighting-presets';
import { useBim3DEntitiesStore } from '../stores/Bim3DEntitiesStore';
import { useDxfOverlay3DStore } from '../stores/DxfOverlay3DStore';
import { useQuickProperties3DStore } from '../stores/QuickProperties3DStore';
import { useSelection3DStore } from '../stores/Selection3DStore';
import { QuickProperties3DHoverPopover } from '../properties/QuickProperties3DHoverPopover';
import { BimEntityCardPanel } from '../properties/BimEntityCardPanel';
import { Floating3DPanel } from '../panels/Floating3DPanel';

const HOVER_DEBOUNCE_MS = 800;

// ── BimViewport3D ─────────────────────────────────────────────────────────────
// ADR-040 micro-leaf compliant: subscribes to ViewMode3DStore (not high-freq),
// renders ≤1 canvas element. Ownership: ThreeJsSceneManager handles Three.js.

export function BimViewport3D() {
  const { t } = useTranslation('bim3d');
  const containerRef = useRef<HTMLDivElement>(null);
  const managerRef = useRef<ThreeJsSceneManager | null>(null);
  const errorRef = useRef<string | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [canvasEl, setCanvasEl] = useState<HTMLCanvasElement | null>(null);
  const { user } = useAuth();
  const { selectedProject } = useProjectHierarchy();
  const projectId = selectedProject?.id ?? null;

  // Low-frequency store subscriptions (user-triggered entity changes — not 60fps)
  const is3D = useSyncExternalStore(
    useViewMode3DStore.subscribe,
    () => selectIs3D(useViewMode3DStore.getState()),
    () => false,
  );

  // Mount / unmount Three.js scene.
  // Initial data sync happens HERE, immediately after manager creation — the only
  // safe moment where managerRef.current is guaranteed non-null. The [] subscription
  // effects below run on component mount (is3D still false → manager null) so their
  // getState() calls would be no-ops; correct sync must live in this [is3D] effect.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !is3D) return;

    try {
      managerRef.current = new ThreeJsSceneManager(container);
    } catch (err) {
      errorRef.current = err instanceof Error ? err.message : String(err);
      return;
    }

    setCanvasEl(managerRef.current.getRendererCanvas());

    // Sync current store state immediately — stores were populated before 3D mode opened.
    const entitiesState = useBim3DEntitiesStore.getState();
    const { walls, columns, beams, slabs, activeLevelId } = entitiesState;
    managerRef.current.syncBimEntities({ walls, columns, beams, slabs }, 0, activeLevelId ?? undefined);
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
  }, [is3D]);

  // Ongoing subscriptions: fire when store data changes AFTER 3D mode is active.
  useEffect(() => {
    return useBim3DEntitiesStore.subscribe((s) => {
      managerRef.current?.syncBimEntities(
        { walls: s.walls, columns: s.columns, beams: s.beams, slabs: s.slabs },
        0,
        s.activeLevelId ?? undefined,
      );
    });
  }, []);

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

  if (!is3D) return null;

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
    <div
      className="absolute inset-0 z-50 cursor-grab active:cursor-grabbing"
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
        aria-label={t('viewport.loadingLabel')}
        role="img"
      />
      {/* Exit button top-left — clear of ViewCube at top-right (ADR-366 §9 Q1). */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => useViewMode3DStore.getState().toggle2D3D()}
            aria-label={t('modeToggle.aria')}
            className="absolute left-3 top-3 z-30 flex select-none items-center gap-1 rounded border border-white/20 bg-black/40 px-2 py-1 text-xs font-medium text-white/80 backdrop-blur-sm transition-colors hover:bg-black/60 hover:text-white"
          >
            <span aria-hidden="true">←</span>
            {' 2D'}
          </button>
        </TooltipTrigger>
        <TooltipContent>{t('modeToggle.tooltip3d')}</TooltipContent>
      </Tooltip>

      {/* Left sidebar panel — Floors / Lighting / Quality */}
      <Floating3DPanel />

      {/* QuickProperties tooltip (ADR-366 B.2.Q1) — micro-leaf, fixed position */}
      <QuickProperties3DHoverPopover />

      {/* BIM entity card panel (ADR-366 B.2.Q4) — micro-leaf, absolute right-side panel */}
      <BimEntityCardPanel />

      {/* Performance HUD (ADR-366 B.5) — micro-leaf, bottom-right */}
      <PerformanceHUD
        canvas={canvasEl}
        projectId={projectId ?? null}
        userId={user?.uid ?? null}
        companyId={user?.companyId ?? null}
      />
    </div>
  );
}
