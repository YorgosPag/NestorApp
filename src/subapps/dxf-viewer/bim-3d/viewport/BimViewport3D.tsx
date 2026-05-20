"use client";

import { useEffect, useRef, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ThreeJsSceneManager } from '../scene/ThreeJsSceneManager';
import { useViewMode3DStore, selectIs3D } from '../stores/ViewMode3DStore';
import { useBim3DEntitiesStore } from '../stores/Bim3DEntitiesStore';
import { useDxfOverlay3DStore } from '../stores/DxfOverlay3DStore';
import { Floating3DPanel } from '../panels/Floating3DPanel';

// ── BimViewport3D ─────────────────────────────────────────────────────────────
// ADR-040 micro-leaf compliant: subscribes to ViewMode3DStore (not high-freq),
// renders ≤1 canvas element. Ownership: ThreeJsSceneManager handles Three.js.

export function BimViewport3D() {
  const { t } = useTranslation('bim3d');
  const containerRef = useRef<HTMLDivElement>(null);
  const managerRef = useRef<ThreeJsSceneManager | null>(null);
  const errorRef = useRef<string | null>(null);

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

    // Sync current store state immediately — stores were populated before 3D mode opened.
    const entitiesState = useBim3DEntitiesStore.getState();
    const { walls, columns, beams, slabs, activeLevelId } = entitiesState;
    managerRef.current.syncBimEntities({ walls, columns, beams, slabs }, 0, activeLevelId ?? undefined);
    managerRef.current.syncDxfOverlay(useDxfOverlay3DStore.getState().dxfScene);

    // Apply current floor visibility modes immediately.
    const modes = useViewMode3DStore.getState().floorVisibilityModes;
    if (modes.size > 0) managerRef.current.applyFloorVisibility(modes);

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
      onMouseMove={(e) => e.stopPropagation()}
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
    </div>
  );
}
