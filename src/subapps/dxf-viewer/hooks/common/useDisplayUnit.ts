'use client';

import { useState, useCallback } from 'react';
import {
  type DisplayUnit,
  DEFAULT_DISPLAY_UNIT,
  DISPLAY_UNIT_STORAGE_KEY,
  isValidDisplayUnit,
} from '../../config/units';

export interface UseDisplayUnitResult {
  displayUnit: DisplayUnit;
  setDisplayUnit: (unit: DisplayUnit) => void;
}

/**
 * ADR-357 Phase 2b: React hook for the user-selected display unit.
 * Persists in localStorage (key: dxf:displayUnit), defaults to 'cm'.
 */
export function useDisplayUnit(): UseDisplayUnitResult {
  const [displayUnit, setDisplayUnitState] = useState<DisplayUnit>(() => {
    if (typeof window === 'undefined') return DEFAULT_DISPLAY_UNIT;
    const stored = localStorage.getItem(DISPLAY_UNIT_STORAGE_KEY);
    return isValidDisplayUnit(stored) ? stored : DEFAULT_DISPLAY_UNIT;
  });

  const setDisplayUnit = useCallback((unit: DisplayUnit) => {
    localStorage.setItem(DISPLAY_UNIT_STORAGE_KEY, unit);
    setDisplayUnitState(unit);
  }, []);

  return { displayUnit, setDisplayUnit };
}
