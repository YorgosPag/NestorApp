'use client';

/**
 * ADR-345 §8.1c — Ribbon state with localStorage persistence.
 * Owns: activeTabId, minimizeState (user-chosen), tabOrder.
 * Viewport-driven auto-minimize is layered on top via matchMedia.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  RIBBON_LS_KEYS,
  RIBBON_MINIMIZE_CYCLE,
  RIBBON_NARROW_BREAKPOINT_PX,
  type RibbonMinimizeState,
} from '../types/ribbon-types';
import { DEFAULT_RIBBON_TAB_ORDER } from '../data/ribbon-default-tabs';

const DEFAULT_TAB_ID = 'home';
const DEFAULT_MINIMIZE: RibbonMinimizeState = 'full';

function readLS<T>(key: string, fallback: T, parser: (raw: string) => T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    return parser(raw);
  } catch {
    return fallback;
  }
}

function writeLS(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* quota / privacy mode — silently ignore */
  }
}

function parseMinimizeState(raw: string): RibbonMinimizeState {
  return RIBBON_MINIMIZE_CYCLE.includes(raw as RibbonMinimizeState)
    ? (raw as RibbonMinimizeState)
    : DEFAULT_MINIMIZE;
}

function parseTabOrder(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [...DEFAULT_RIBBON_TAB_ORDER];
    return parsed.filter((id): id is string => typeof id === 'string');
  } catch {
    return [...DEFAULT_RIBBON_TAB_ORDER];
  }
}

function useNarrowViewport(): boolean {
  const [isNarrow, setIsNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(
      `(max-width: ${RIBBON_NARROW_BREAKPOINT_PX - 1}px)`,
    );
    setIsNarrow(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setIsNarrow(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return isNarrow;
}

export interface UseRibbonStateReturn {
  activeTabId: string;
  setActiveTabId: (id: string) => void;
  userMinimizeState: RibbonMinimizeState;
  effectiveMinimizeState: RibbonMinimizeState;
  setMinimizeState: (state: RibbonMinimizeState) => void;
  cycleMinimizeState: () => void;
  tabOrder: string[];
  setTabOrder: (order: string[]) => void;
  isNarrow: boolean;
}

export function useRibbonState(): UseRibbonStateReturn {
  const [activeTabId, setActiveTabIdState] = useState<string>(() =>
    readLS(RIBBON_LS_KEYS.activeTabId, DEFAULT_TAB_ID, (raw) => raw),
  );
  const [userMinimizeState, setUserMinimizeStateInner] =
    useState<RibbonMinimizeState>(() =>
      readLS(RIBBON_LS_KEYS.minimizeState, DEFAULT_MINIMIZE, parseMinimizeState),
    );
  const [tabOrder, setTabOrderState] = useState<string[]>(() =>
    readLS(RIBBON_LS_KEYS.tabOrder, [...DEFAULT_RIBBON_TAB_ORDER], parseTabOrder),
  );

  const isNarrow = useNarrowViewport();
  const effectiveMinimizeState: RibbonMinimizeState = isNarrow
    ? 'tab-names'
    : userMinimizeState;

  const setActiveTabId = useCallback((id: string) => {
    setActiveTabIdState(id);
    writeLS(RIBBON_LS_KEYS.activeTabId, id);
  }, []);

  const setMinimizeState = useCallback((state: RibbonMinimizeState) => {
    setUserMinimizeStateInner(state);
    writeLS(RIBBON_LS_KEYS.minimizeState, state);
  }, []);

  const cycleMinimizeState = useCallback(() => {
    setUserMinimizeStateInner((prev) => {
      const idx = RIBBON_MINIMIZE_CYCLE.indexOf(prev);
      const next =
        RIBBON_MINIMIZE_CYCLE[(idx + 1) % RIBBON_MINIMIZE_CYCLE.length];
      writeLS(RIBBON_LS_KEYS.minimizeState, next);
      return next;
    });
  }, []);

  const setTabOrder = useCallback((order: string[]) => {
    setTabOrderState(order);
    writeLS(RIBBON_LS_KEYS.tabOrder, JSON.stringify(order));
  }, []);

  return {
    activeTabId,
    setActiveTabId,
    userMinimizeState,
    effectiveMinimizeState,
    setMinimizeState,
    cycleMinimizeState,
    tabOrder,
    setTabOrder,
    isNarrow,
  };
}
