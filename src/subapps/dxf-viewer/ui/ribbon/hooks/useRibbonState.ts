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
// ADR-748 Φάση 2 — διακόπτης ειδικότητας («ποια εργαλεία έχω»).
import {
  RIBBON_SPECIALTY_ALL,
  isRibbonSpecialtySelection,
  type RibbonSpecialtySelection,
} from '../data/ribbon-tab-specialties';

const DEFAULT_TAB_ID = 'home';
const DEFAULT_MINIMIZE: RibbonMinimizeState = 'full';
/**
 * ADR-748 Φάση 2 — προεπιλογή «Όλα» = **ακριβώς η σημερινή συμπεριφορά**.
 * Κανένας υπάρχων χρήστης δεν βλέπει αλλαγή μέχρι να γυρίσει ο ίδιος τον
 * διακόπτη (Α-1: ο ρόλος προτείνει, δεν φυλακίζει· Ε7.δ: πάντα υπάρχει
 * προεπιλογή, ποτέ μπλοκάρισμα — ο κανόνας του Revit).
 */
const DEFAULT_SPECIALTY: RibbonSpecialtySelection = RIBBON_SPECIALTY_ALL;

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

function parsePinnedPanelIds(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === 'string');
  } catch {
    return [];
  }
}

function parseSpecialty(raw: string): RibbonSpecialtySelection {
  return isRibbonSpecialtySelection(raw) ? raw : DEFAULT_SPECIALTY;
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
  pinnedPanelIds: string[];
  togglePinPanel: (panelId: string) => void;
  isNarrow: boolean;
  /** ADR-748 Φάση 2 — ενεργή θέση του διακόπτη ειδικότητας. */
  activeSpecialty: RibbonSpecialtySelection;
  setActiveSpecialty: (specialty: RibbonSpecialtySelection) => void;
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
  const [pinnedPanelIds, setPinnedPanelIdsState] = useState<string[]>(() =>
    readLS(RIBBON_LS_KEYS.pinnedPanelIds, [], parsePinnedPanelIds),
  );
  const [activeSpecialty, setActiveSpecialtyState] =
    useState<RibbonSpecialtySelection>(() =>
      readLS(RIBBON_LS_KEYS.specialty, DEFAULT_SPECIALTY, parseSpecialty),
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

  const setActiveSpecialty = useCallback(
    (specialty: RibbonSpecialtySelection) => {
      setActiveSpecialtyState(specialty);
      writeLS(RIBBON_LS_KEYS.specialty, specialty);
    },
    [],
  );

  const togglePinPanel = useCallback((panelId: string) => {
    setPinnedPanelIdsState((prev) => {
      const next = prev.includes(panelId)
        ? prev.filter((id) => id !== panelId)
        : [...prev, panelId];
      writeLS(RIBBON_LS_KEYS.pinnedPanelIds, JSON.stringify(next));
      return next;
    });
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
    pinnedPanelIds,
    togglePinPanel,
    isNarrow,
    activeSpecialty,
    setActiveSpecialty,
  };
}
