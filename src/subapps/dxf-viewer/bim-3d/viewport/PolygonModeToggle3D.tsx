"use client";

/**
 * PolygonModeToggle3D — ADR-539 (Cinema 4D «Polygon Mode») viewport control leaf.
 *
 * Owns the whole Polygon-Mode surface that used to live inline in `BimViewport3D`:
 *   - the toggle button (top-left, below the 2D exit button), enabled only when a
 *     faced-capable solid is selected;
 *   - the enter/leave lifecycle (rebuild so the target solid toggles faced ↔ legacy
 *     render, clear the face highlight, auto-exit on unsupported selection, reset on
 *     unmount);
 *   - the per-face material library (`PolygonMaterialPanel`).
 *
 * ADR-040: low-frequency leaf — subscribes only to the selection/polygon stores
 * (user-triggered, not 60fps). Keeps `BimViewport3D` lean (Google file-size SRP).
 *
 * @see ../stores/PolygonMode3DStore.ts
 * @see ../ui/PolygonMaterialPanel.tsx
 * @see docs/centralized-systems/reference/adrs/ADR-539-cinema4d-polygon-mode-per-face-appearance.md
 */

import { useEffect, useCallback, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ThreeJsSceneManager } from '../scene/ThreeJsSceneManager';
import { resyncBimScene } from '../scene/bim3d-resync';
import { useSelection3DStore } from '../stores/Selection3DStore';
import { usePolygonMode3DStore } from '../stores/PolygonMode3DStore';
import type { Bim3DEntities } from '../stores/Bim3DEntitiesStore';
import { PolygonMaterialPanel } from '../ui/PolygonMaterialPanel';

// ADR-539 — solid kinds που υποστηρίζουν per-face appearance (faced render path).
// Φ1 = slab· Φ1.5 += foundation (πέδιλα/θεμέλια· solid-agnostic core)· wall/column/beam/roof
// έρχονται στα επόμενα increments.
const POLYGON_FACED_KINDS: ReadonlySet<string> = new Set(['slab', 'foundation']);

export interface PolygonModeToggle3DProps {
  readonly managerRef: RefObject<ThreeJsSceneManager | null>;
  readonly externalEntitiesMode: boolean;
  readonly bimEntities: Bim3DEntities | null | undefined;
}

export function PolygonModeToggle3D({ managerRef, externalEntitiesMode, bimEntities }: PolygonModeToggle3DProps) {
  const { t } = useTranslation('bim3d');
  // Polygon Mode toggle is enabled only when a faced-capable solid is selected.
  const selectedBimType = useSelection3DStore((s) => s.selectedBimType);
  const polygonActive = usePolygonMode3DStore((s) => s.active);
  const canPolygon = selectedBimType !== null && POLYGON_FACED_KINDS.has(selectedBimType);

  const handleTogglePolygon = useCallback(() => {
    const next = !usePolygonMode3DStore.getState().active;
    const bimId = useSelection3DStore.getState().selectedBimId;
    usePolygonMode3DStore.getState().setActive(next, bimId);
    if (!next) managerRef.current?.setSelectedFace(null, null);
    // Rebuild so the target solid toggles faced (pickable per-face) ↔ legacy.
    resyncBimScene(managerRef.current, { externalEntitiesMode, bimEntities });
  }, [managerRef, externalEntitiesMode, bimEntities]);

  // Leaving a faced solid (or clearing selection) auto-exits Polygon Mode + clears the
  // face highlight + rebuilds (target solid back to legacy render), so the mode never
  // lingers on an unsupported entity.
  useEffect(() => {
    if (canPolygon) return;
    if (usePolygonMode3DStore.getState().active) {
      usePolygonMode3DStore.getState().setActive(false);
      managerRef.current?.setSelectedFace(null, null);
      resyncBimScene(managerRef.current, { externalEntitiesMode, bimEntities });
    }
  }, [canPolygon, managerRef, externalEntitiesMode, bimEntities]);

  // Reset the store when the viewport unmounts (no stale mode on re-open).
  useEffect(() => () => { usePolygonMode3DStore.getState().reset(); }, []);

  return (
    <>
      {/* Toggle button (left, below the 2D exit button). Visible only when a faced-capable solid is selected. */}
      {canPolygon && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={handleTogglePolygon}
              aria-pressed={polygonActive}
              aria-label={t('polygonMode.toggle')}
              className={`absolute left-3 top-12 z-30 flex select-none items-center gap-1 rounded border px-2 py-1 text-xs font-medium backdrop-blur-sm transition-colors ${
                polygonActive
                  ? 'border-[hsl(var(--text-info))]/60 bg-[hsl(var(--bg-info))]/30 text-white'
                  : 'border-white/20 bg-black/40 text-white/80 hover:bg-black/60 hover:text-white'
              }`}
            >
              <span aria-hidden="true">⬢</span>
              {t('polygonMode.toggle')}
            </button>
          </TooltipTrigger>
          <TooltipContent>{t('polygonMode.tooltip')}</TooltipContent>
        </Tooltip>
      )}

      {/* Per-face material library (click-to-apply). Renders only in Polygon Mode. */}
      <PolygonMaterialPanel />
    </>
  );
}
