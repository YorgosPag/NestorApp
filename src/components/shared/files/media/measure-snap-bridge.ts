/**
 * Thin bridge: endpoint-only snap for the MeasureToolOverlay.
 *
 * Creates a DEDICATED ProSnapEngineV2 instance (NOT the global singleton)
 * with only ENDPOINT snap enabled. Initialized from FloorplanGallery's
 * own loadedScene.entities — works standalone without the DXF viewer's
 * CanvasSection / useGlobalSnapSceneSync lifecycle.
 *
 * Bundle isolation: this file owns the dxf-viewer import boundary so
 * MeasureToolOverlay.tsx stays fully decoupled from the DXF subapp.
 *
 * @module components/shared/files/media/measure-snap-bridge
 */

'use client';

import { useRef, useEffect, useCallback } from 'react';
import { ProSnapEngineV2 } from '@/subapps/dxf-viewer/snapping/ProSnapEngineV2';
import { ExtendedSnapType } from '@/subapps/dxf-viewer/snapping/extended-types';
import type { Entity } from '@/subapps/dxf-viewer/snapping/extended-types';

type Pt = { x: number; y: number };

/**
 * Returns a stable snap-finder function `(worldPt, zoom) => Pt | null`.
 * Initializes (or tears down) a local engine whenever `entities` or `isDxf` changes.
 * Returns null immediately for raster mode or when engine not ready.
 */
export function useMeasureSnapFinder(
  entities: unknown[] | null | undefined,
  isDxf: boolean,
): (worldPt: Pt, zoom: number) => Pt | null {
  const engineRef = useRef<ProSnapEngineV2 | null>(null);

  useEffect(() => {
    if (!isDxf || !entities?.length) {
      engineRef.current = null;
      return;
    }
    const engine = new ProSnapEngineV2({
      enabled: true,
      enabledTypes: new Set([ExtendedSnapType.ENDPOINT]),
      perModePxTolerance: { [ExtendedSnapType.ENDPOINT]: 0.5 },
    });
    engine.initialize(entities as Entity[]);
    engineRef.current = engine;
    return () => { engineRef.current = null; };
  }, [isDxf, entities]);

  // Stable ref: no deps — always reads latest engine + zoom from args
  return useCallback((worldPt: Pt, zoom: number): Pt | null => {
    const engine = engineRef.current;
    if (!engine) return null;
    try {
      engine.setViewport({
        scale: zoom,
        worldPerPixelAt: () => 1 / zoom,
        worldToScreen: (p: Pt) => ({ x: p.x * zoom, y: p.y * zoom }),
      });
      const result = engine.findSnapPoint(worldPt);
      return result.found ? result.snappedPoint : null;
    } catch {
      return null;
    }
  }, []);
}
