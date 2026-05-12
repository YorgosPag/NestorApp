'use client';

/**
 * ADR-345 §4.3 — Persistence for split-button last-used variant.
 * Key: `dxf-ribbon:splitLastUsed` → Record<commandId, variantId>.
 */

import { useCallback, useEffect, useState } from 'react';
import { RIBBON_LS_KEYS } from '../types/ribbon-types';

type SplitLastUsedMap = Record<string, string>;

function readMap(): SplitLastUsedMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(RIBBON_LS_KEYS.splitLastUsed);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const out: SplitLastUsedMap = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === 'string') out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

function writeMap(map: SplitLastUsedMap): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      RIBBON_LS_KEYS.splitLastUsed,
      JSON.stringify(map),
    );
  } catch {
    /* quota — silently ignore */
  }
}

export interface UseSplitLastUsedReturn {
  splitLastUsed: SplitLastUsedMap;
  setSplitLastUsed: (commandId: string, variantId: string) => void;
}

export function useSplitLastUsed(): UseSplitLastUsedReturn {
  const [map, setMap] = useState<SplitLastUsedMap>({});

  useEffect(() => {
    setMap(readMap());
  }, []);

  const setSplitLastUsed = useCallback(
    (commandId: string, variantId: string) => {
      setMap((prev) => {
        const next = { ...prev, [commandId]: variantId };
        writeMap(next);
        return next;
      });
    },
    [],
  );

  return { splitLastUsed: map, setSplitLastUsed };
}
