"use client";

import { useEffect, useRef, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { ThreeJsSceneManager } from '../scene/ThreeJsSceneManager';
import { useViewMode3DStore, selectIs3D } from '../stores/ViewMode3DStore';

// ── BimViewport3D ─────────────────────────────────────────────────────────────
// ADR-040 micro-leaf compliant: subscribes to ViewMode3DStore (not high-freq),
// renders ≤1 canvas element. Ownership: ThreeJsSceneManager handles Three.js.

export function BimViewport3D() {
  const { t } = useTranslation('bim3d');
  const containerRef = useRef<HTMLDivElement>(null);
  const managerRef = useRef<ThreeJsSceneManager | null>(null);
  const errorRef = useRef<string | null>(null);

  // Low-frequency store subscription (changes only on user toggle — not 60fps)
  const is3D = useSyncExternalStore(
    useViewMode3DStore.subscribe,
    () => selectIs3D(useViewMode3DStore.getState()),
    () => false,
  );

  // Mount / unmount Three.js scene
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !is3D) return;

    try {
      managerRef.current = new ThreeJsSceneManager(container);
    } catch (err) {
      errorRef.current = err instanceof Error ? err.message : String(err);
      return;
    }

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

  if (!is3D) return null;

  if (errorRef.current) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-background text-destructive text-sm">
        {t('viewport.webglError')}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="absolute inset-0"
      aria-label={t('viewport.loadingLabel')}
      role="img"
    />
  );
}
