'use client';

/**
 * Section2DPanel — UI για ADR-366 §A.3 Q3 Phase 7.0B 2D Live Section Panel.
 *
 * Bottom strip widget κάτω από το 3D viewport που εμφανίζει 2D αρχιτεκτονική
 * όψη του ενεργού section plane (independent zoom/pan, color-coded ανά
 * element type).
 *
 * ADR-040 micro-leaf compliance:
 *   - 2 useSyncExternalStore subscriptions (Section2DPanelStore, SectionStore)
 *   - Selection + entities reads μέσω scene-sync σε refresh callback (όχι hook)
 *   - Three.js rendering: standalone, zero React state
 *
 * Architecture:
 *   - Mount: createSectionPanelRenderer() → SectionPanelRenderer
 *   - Sync: createSectionPanelSceneSync() κρατάει renderer ref + syncScene()
 *   - Effects: store changes → syncScene() (entities / selection / section
 *     state / activePlaneId)
 *   - Wheel/pan: forwards to renderer (zoom/pan handlers)
 *
 * @see ADR-366 §A.3 Q3
 */

import { useEffect, useRef, useSyncExternalStore, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSection2DPanelStore } from '../stores/Section2DPanelStore';
import { useSectionStore } from '../stores/SectionStore';
import { useBim3DEntitiesStore } from '../stores/Bim3DEntitiesStore';
import { useSelection3DStore } from '../stores/Selection3DStore';
import { createSectionPanelRenderer, type SectionPanelRenderer } from '../2d-section/section-renderer';
import { createSectionPanelSceneSync } from '../2d-section/section-scene-sync';
import { deriveAvailablePlanes } from '../2d-section/active-plane-derivation';

// ADR-040 micro-leaf: subscribe to whole-state ref (stable between zustand set() calls).
// Object-literal selectors here would return a fresh ref each call → useSyncExternalStore
// infinite re-render loop (Maximum update depth exceeded). Primitive/whole-state snapshots only.

export function Section2DPanel() {
  const { t } = useTranslation('bim3d');
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<SectionPanelRenderer | null>(null);
  const syncRef = useRef<ReturnType<typeof createSectionPanelSceneSync> | null>(null);

  const visible = useSyncExternalStore(
    useSection2DPanelStore.subscribe,
    () => useSection2DPanelStore.getState().visible,
    () => false,
  );
  const heightPx = useSyncExternalStore(
    useSection2DPanelStore.subscribe,
    () => useSection2DPanelStore.getState().heightPx,
    () => 0,
  );

  const sectionEnabled = useSyncExternalStore(
    useSectionStore.subscribe,
    () => useSectionStore.getState().enabled,
    () => false,
  );

  const refresh = useCallback(() => {
    syncRef.current?.syncScene();
  }, []);

  // Mount/unmount renderer.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !visible || !sectionEnabled) return;

    const renderer = createSectionPanelRenderer();
    renderer.mount(container);
    const sync = createSectionPanelSceneSync();
    sync.setRenderer(renderer);
    rendererRef.current = renderer;
    syncRef.current = sync;

    sync.syncScene();

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry || !rendererRef.current) return;
      const { width, height } = entry.contentRect;
      rendererRef.current.resize(Math.max(1, width), Math.max(1, height));
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
      renderer.unmount();
      renderer.dispose();
      sync.setRenderer(null);
      rendererRef.current = null;
      syncRef.current = null;
    };
  }, [visible, sectionEnabled]);

  // Rebuild scene όταν αλλάζει το active plane id ή τα section bounds/planes.
  useEffect(() => {
    if (!visible || !sectionEnabled) return;
    const unsubPanel = useSection2DPanelStore.subscribe((s) => s.activePlaneId, refresh);
    const unsubBoxBounds = useSectionStore.subscribe((s) => s.boxBounds, refresh);
    const unsubPlanes = useSectionStore.subscribe((s) => s.planes, refresh);
    const unsubMode = useSectionStore.subscribe((s) => s.mode, refresh);
    return () => {
      unsubPanel();
      unsubBoxBounds();
      unsubPlanes();
      unsubMode();
    };
  }, [visible, sectionEnabled, refresh]);

  // Rebuild όταν αλλάζουν τα entities ή το selection.
  useEffect(() => {
    if (!visible || !sectionEnabled) return;
    const unsubEntities = useBim3DEntitiesStore.subscribe(refresh);
    const unsubSelection = useSelection3DStore.subscribe((s) => s.selectedBimId, refresh);
    return () => {
      unsubEntities();
      unsubSelection();
    };
  }, [visible, sectionEnabled, refresh]);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();
    const container = containerRef.current;
    const renderer = rendererRef.current;
    if (!container || !renderer) return;
    const rect = container.getBoundingClientRect();
    const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    renderer.zoom(-e.deltaY, ndcX, ndcY);
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (!e.buttons) return;
    rendererRef.current?.pan(e.movementX, e.movementY);
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
  }, []);

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const container = containerRef.current;
    const renderer = rendererRef.current;
    if (!container || !renderer) return;
    const rect = container.getBoundingClientRect();
    const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    const hit = renderer.pick(ndcX, ndcY);
    if (hit) {
      useSelection3DStore.getState().selectEntity(hit.bimId, hit.bimType);
    } else {
      useSelection3DStore.getState().clearSelection();
    }
  }, []);

  if (!visible || !sectionEnabled) return null;

  // Check αν υπάρχει active plane — αν όχι, message αντί κενό panel.
  const sectionState = useSectionStore.getState();
  const available = deriveAvailablePlanes({
    mode: sectionState.mode,
    boxBounds: sectionState.boxBounds,
    planes: sectionState.planes,
  });
  const hasPlane = available.length > 0;

  return (
    <aside
      className="pointer-events-auto absolute inset-x-0 bottom-0 z-30 flex flex-col border-t border-white/15 bg-black/70 backdrop-blur-sm"
      style={{ height: `${heightPx}px` }}
      aria-label={t('section2d.ariaLabel')}
    >
      <header className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-1 text-xs text-white/80">
        <span className="font-medium">{t('section2d.title')}</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded border border-white/15 bg-white/5 px-2 py-0.5 text-[11px] text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            onClick={() => syncRef.current?.resetView()}
          >
            {t('section2d.resetView')}
          </button>
          <button
            type="button"
            aria-label={t('section2d.closeAria')}
            className="rounded px-1 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
            onClick={() => useSection2DPanelStore.getState().setVisible(false)}
          >
            ×
          </button>
        </div>
      </header>
      {hasPlane ? (
        <div
          ref={containerRef}
          className="relative flex-1 cursor-grab active:cursor-grabbing"
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onClick={handleClick}
        />
      ) : (
        <div className="flex flex-1 items-center justify-center text-xs text-white/50">
          {t('section2d.noPlane')}
        </div>
      )}
    </aside>
  );
}
