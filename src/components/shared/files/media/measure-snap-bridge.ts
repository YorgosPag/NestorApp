/**
 * Thin bridge: endpoint + midpoint snap for the MeasureToolOverlay.
 *
 * Creates a DEDICATED ProSnapEngineV2 instance (NOT the global singleton)
 * with ENDPOINT + MIDPOINT snap enabled (AutoCAD OSNAP «Άκρο» + «Μέσο»).
 * Initialized from FloorplanGallery's own loadedScene.entities — works
 * standalone without the DXF viewer's CanvasSection / useGlobalSnapSceneSync
 * lifecycle.
 *
 * Bundle isolation: this file owns the dxf-viewer import boundary so
 * MeasureToolOverlay.tsx stays fully decoupled from the DXF subapp (the
 * overlay imports ONLY the `MeasureSnapPoint` TYPE from here — erased at
 * compile time, zero runtime coupling).
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
 * Result of a measure-tool snap: the snapped world coordinate PLUS the snap
 * kind (`ProSnapResult.activeMode`, e.g. `'endpoint'` | `'midpoint'`) so the
 * overlay can draw the correct AutoCAD OSNAP glyph (□ endpoint / △ midpoint).
 */
export interface MeasureSnapPoint {
  point: Pt;
  type: string;
}

/**
 * Returns a stable snap-finder function `(worldPt, screenScale) => MeasureSnapPoint | null`.
 * Initializes (or tears down) a local engine whenever `entities` or `isDxf` changes.
 * Returns null immediately for raster mode or when engine not ready.
 *
 * `screenScale` MUST be the REAL world→screen scale (`FitTransform.scale` =
 * baseScale × zoom), NOT the bare zoom. The engine measures snap tolerance in screen
 * pixels via this factor; feeding only `zoom` ignores the fit's `baseScale`, so the
 * 10px aperture collapses to a near-zero world radius and NOTHING ever snaps.
 */
export function useMeasureSnapFinder(
  entities: unknown[] | null | undefined,
  isDxf: boolean,
): (worldPt: Pt, screenScale: number) => MeasureSnapPoint | null {
  const engineRef = useRef<ProSnapEngineV2 | null>(null);

  useEffect(() => {
    if (!isDxf || !entities?.length) {
      engineRef.current = null;
      return;
    }
    const engine = new ProSnapEngineV2({
      enabled: true,
      // AutoCAD «Άκρο» + «Μέσο». 10px = AutoCAD APERTURE default (strong grab), matched
      // for both. This ONLY works because the finder below feeds the engine the REAL
      // world→screen scale (baseScale × zoom), not the bare zoom (see the scale bug note).
      enabledTypes: new Set([ExtendedSnapType.ENDPOINT, ExtendedSnapType.MIDPOINT]),
      perModePxTolerance: {
        [ExtendedSnapType.ENDPOINT]: 10,
        [ExtendedSnapType.MIDPOINT]: 10,
      },
    });
    engine.initialize(entities as Entity[]);
    engineRef.current = engine;
    return () => { engineRef.current = null; };
  }, [isDxf, entities]);

  // Stable ref: no deps — always reads latest engine + scale from args
  return useCallback((worldPt: Pt, screenScale: number): MeasureSnapPoint | null => {
    const engine = engineRef.current;
    if (!engine || !(screenScale > 0)) return null;
    try {
      // Real world→screen scale so the px aperture maps to true on-screen pixels.
      engine.setViewport({
        scale: screenScale,
        worldPerPixelAt: () => 1 / screenScale,
        worldToScreen: (p: Pt) => ({ x: p.x * screenScale, y: p.y * screenScale }),
      });
      const result = engine.findSnapPoint(worldPt);
      if (!result.found) return null;
      return { point: result.snappedPoint, type: result.activeMode ?? ExtendedSnapType.ENDPOINT };
    } catch {
      return null;
    }
  }, []);
}
