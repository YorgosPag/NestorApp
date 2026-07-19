/**
 * ENTERPRISE: useLocalMeasurements — React binding for the ephemeral
 * local-measurements scratch store.
 *
 * Thin `useSyncExternalStore` wrapper. Shared by `MeasureToolbar` (count +
 * clear-all) and `MeasureToolOverlay` (list + commit). Both pass the SAME
 * floorplan scope key so they observe one consistent set, kept in-memory only
 * — NEVER Firestore.
 *
 * @module components/shared/files/media/useLocalMeasurements
 * @enterprise ADR-340 §3.6 / Phase 9 STEP J
 */

'use client';

import { useCallback, useSyncExternalStore } from 'react';
import {
  subscribeLocalMeasurements,
  getLocalMeasurements,
  getClearToken,
  commitLocalMeasurement,
  clearLocalMeasurements,
  type LocalMeasurement,
} from '@/components/shared/files/media/local-measurements-store';

export interface UseLocalMeasurements {
  /** Accumulated measurements for this scope (stable ref while unchanged). */
  measurements: ReadonlyArray<LocalMeasurement>;
  /** `measurements.length` — convenience for toolbar badge/gating. */
  count: number;
  /** Bumped on every clear — overlay watches this to reset in-progress geometry. */
  clearToken: number;
  /** Append one measurement to this scope. */
  commit: (measurement: Omit<LocalMeasurement, 'id'>) => void;
  /** Wipe every accumulated measurement in this scope. */
  clearAll: () => void;
}

export function useLocalMeasurements(scopeKey: string | null | undefined): UseLocalMeasurements {
  const measurements = useSyncExternalStore(
    subscribeLocalMeasurements,
    () => getLocalMeasurements(scopeKey),
    () => getLocalMeasurements(scopeKey),
  );
  const clearToken = useSyncExternalStore(
    subscribeLocalMeasurements,
    () => getClearToken(scopeKey),
    () => getClearToken(scopeKey),
  );

  const commit = useCallback(
    (measurement: Omit<LocalMeasurement, 'id'>) => commitLocalMeasurement(scopeKey, measurement),
    [scopeKey],
  );
  const clearAll = useCallback(() => clearLocalMeasurements(scopeKey), [scopeKey]);

  return { measurements, count: measurements.length, clearToken, commit, clearAll };
}

export default useLocalMeasurements;
