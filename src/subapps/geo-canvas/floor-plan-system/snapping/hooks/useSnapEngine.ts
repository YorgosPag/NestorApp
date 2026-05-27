/**
 * ADR-378 Phase 4 — Geo-canvas snap engine, unified with DXF Viewer SSoT.
 *
 * Pre-Phase 4: maintained a private `SnapEngine` class with 6 modes.
 * Post-Phase 4: delegates to the single global `ProSnapEngineV2` instance via
 * `getGlobalSnapEngine()`. Geo-canvas now gets the full 26-engine pipeline
 * (BIM corners + dimensions + guides + text + classic CAD modes) instead of
 * the previous 6 endpoint-only modes — matching industry convention
 * (Revit / AutoCAD / ArchiCAD: 1 engine + N modes via registry).
 *
 * Public API surface (`UseSnapEngineReturn`) is UNCHANGED — existing consumers
 * (`GeoCanvasContent`, `FloorPlanCanvasLayer`) work as-is.
 *
 * Trade-off: the geo-canvas render layer (`SnapIndicator`, render utils) only
 * knows the 6 classic `SnapMode` values, so the richer 26-mode pipeline output
 * is collapsed via `EXTENDED_TO_GEO_MODE` to its closest geo-canvas equivalent
 * for visual consistency.
 *
 * @module floor-plan-system/snapping/hooks/useSnapEngine
 * @see docs/centralized-systems/reference/adrs/ADR-378-snap-system-master-architecture.md §3.1, §9 Phase 4
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { ParserResult } from '../../types';
import {
  SnapMode,
  type SnapPoint,
  type SnapResult,
  type SnapSettings,
} from '../types';
import { DEFAULT_SNAP_SETTINGS } from '../config';
import { parserResultToEntities } from '../adapter/parser-result-to-entities';
import { getGlobalSnapEngine } from '@/subapps/dxf-viewer/snapping/global-snap-engine';
import {
  ExtendedSnapType,
  type ProSnapResult,
} from '@/subapps/dxf-viewer/snapping/extended-types';

/**
 * Hook options
 */
export interface UseSnapEngineOptions {
  /** Initial snap settings */
  settings?: Partial<SnapSettings>;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Hook return type
 */
export interface UseSnapEngineReturn {
  /** Current snap result (null if no snap) */
  snapResult: SnapResult | null;
  /** Calculate snap for cursor position */
  calculateSnap: (cursorX: number, cursorY: number) => SnapResult | null;
  /** Clear current snap */
  clearSnap: () => void;
  /** Update snap settings */
  updateSettings: (settings: Partial<SnapSettings>) => void;
  /** Enable/disable snap */
  setEnabled: (enabled: boolean) => void;
  /** Current snap settings */
  settings: SnapSettings;
  /** Is snap engine ready? */
  isReady: boolean;
  /** Number of indexed snap entities (geo-canvas adapter output count) */
  snapPointsCount: number;
}

/**
 * Map ProSnapEngineV2 result types → geo-canvas SnapMode.
 * All other 19+ ExtendedSnapType values (BIM_*_CORNER, DIM_*, GUIDE, etc.)
 * fall through to SnapMode.ENDPOINT in `mapProResult()` below.
 */
const EXTENDED_TO_GEO_MODE: Partial<Record<ExtendedSnapType, SnapMode>> = {
  [ExtendedSnapType.ENDPOINT]:      SnapMode.ENDPOINT,
  [ExtendedSnapType.MIDPOINT]:      SnapMode.MIDPOINT,
  [ExtendedSnapType.CENTER]:        SnapMode.CENTER,
  [ExtendedSnapType.INTERSECTION]:  SnapMode.INTERSECTION,
  [ExtendedSnapType.NEAREST]:       SnapMode.NEAREST,
  [ExtendedSnapType.PERPENDICULAR]: SnapMode.PERPENDICULAR,
};

function mapProResult(pro: ProSnapResult): SnapResult | null {
  if (!pro.found || !pro.snapPoint) return null;

  const geoMode = EXTENDED_TO_GEO_MODE[pro.snapPoint.type] ?? SnapMode.ENDPOINT;
  const point: SnapPoint = {
    x: pro.snappedPoint.x,
    y: pro.snappedPoint.y,
    mode: geoMode,
    entityId: pro.snapPoint.entityId,
    label: pro.snapPoint.description
      || `Snap (${pro.snappedPoint.x.toFixed(2)}, ${pro.snappedPoint.y.toFixed(2)})`,
  };

  return {
    point,
    distance: pro.snapPoint.distance,
    isActive: true,
  };
}

/**
 * useSnapEngine Hook — geo-canvas façade over ProSnapEngineV2.
 */
export function useSnapEngine(
  parserResult: ParserResult | null,
  options: UseSnapEngineOptions = {},
): UseSnapEngineReturn {
  const { settings: initialSettings, debug = false } = options;

  const [snapResult, setSnapResult] = useState<SnapResult | null>(null);
  const [currentSettings, setCurrentSettings] = useState<SnapSettings>(() => ({
    ...DEFAULT_SNAP_SETTINGS,
    ...initialSettings,
  }));
  const settingsRef = useRef(currentSettings);
  settingsRef.current = currentSettings;

  const [entityCount, setEntityCount] = useState(0);
  const [isReady, setIsReady] = useState(false);

  // Initialize global engine with adapted geo-canvas entities on parserResult change.
  useEffect(() => {
    const engine = getGlobalSnapEngine();
    const entities = parserResultToEntities(parserResult);

    if (debug) {
      console.debug(`🔧 useSnapEngine (geo-canvas): initializing global engine με ${entities.length} entities`);
    }

    engine.initialize(entities);
    setEntityCount(entities.length);
    setIsReady(entities.length > 0);

    if (debug && entities.length > 0) {
      console.debug(`✅ useSnapEngine (geo-canvas): ready με ${entities.length} adapted entities`);
    }
  }, [parserResult, debug]);

  const calculateSnap = useCallback((cursorX: number, cursorY: number): SnapResult | null => {
    if (!isReady || !settingsRef.current.enabled) {
      setSnapResult(null);
      return null;
    }

    const engine = getGlobalSnapEngine();
    const pro = engine.findSnapPoint({ x: cursorX, y: cursorY });
    const mapped = mapProResult(pro);
    setSnapResult(mapped);

    if (debug && mapped) {
      console.debug('🎯 Snap (geo-canvas):', {
        point: mapped.point,
        distance: mapped.distance.toFixed(2),
        mode: mapped.point.mode,
      });
    }

    return mapped;
  }, [isReady, debug]);

  const clearSnap = useCallback(() => {
    setSnapResult(null);
  }, []);

  const updateSettings = useCallback((settings: Partial<SnapSettings>) => {
    setCurrentSettings((prev) => ({ ...prev, ...settings }));
    if (debug) console.debug('⚙️ useSnapEngine (geo-canvas): settings updated', settings);
  }, [debug]);

  const setEnabled = useCallback((enabled: boolean) => {
    setCurrentSettings((prev) => ({ ...prev, enabled }));
    if (!enabled) setSnapResult(null);
    if (debug) console.debug(`⚙️ useSnapEngine (geo-canvas): snap ${enabled ? 'enabled' : 'disabled'}`);
  }, [debug]);

  return {
    snapResult,
    calculateSnap,
    clearSnap,
    updateSettings,
    setEnabled,
    settings: currentSettings,
    isReady,
    snapPointsCount: entityCount,
  };
}
