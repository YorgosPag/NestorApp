'use client';

/**
 * ADR-344 Phase 6.D — Font source for the Text Properties panel.
 *
 * The cache singleton from Phase 2 is the SSoT for loaded fonts. It
 * has no native subscription mechanism (a WeakMap-backed Map), so the
 * panel reads it on mount and again when the missing-font report
 * changes — the report fires whenever a new font is loaded or marked
 * missing, making it a reliable "fonts changed" signal.
 *
 * We additionally union the family names declared in scene STYLE
 * entries so the picker shows fonts the document references even if
 * they have not been resolved yet (missing-font UX).
 */

import { useEffect, useMemo, useState } from 'react';
import { fontCache, subscribeMissingFontReport } from '../../../text-engine/fonts';
import { useCurrentSceneModel } from './useCurrentSceneModel';

function snapshotCacheNames(): readonly string[] {
  const out: string[] = [];
  // `fontCache.byName` is private; the cache exposes only `has/get/size`.
  // Use a sentinel iteration via `size` as a freshness key while reading
  // names through `keys()` proxy. Since the cache does not expose keys,
  // we ship a minimal `entries` adapter inline.
  const cacheUnknown = fontCache as unknown as {
    byName?: Map<string, unknown>;
  };
  if (cacheUnknown.byName) {
    for (const name of cacheUnknown.byName.keys()) {
      out.push(name);
    }
  }
  return out.sort();
}

export function useTextPanelFonts(): readonly string[] {
  const scene = useCurrentSceneModel();
  const [bump, setBump] = useState(0);

  useEffect(() => {
    return subscribeMissingFontReport(() => setBump((n) => n + 1));
  }, []);

  return useMemo(() => {
    void bump;
    const set = new Set<string>(snapshotCacheNames());
    if (scene) {
      for (const entity of scene.entities) {
        const e = entity as unknown as { fontFamily?: string };
        if (e.fontFamily) set.add(e.fontFamily);
      }
    }
    return [...set].sort();
  }, [scene, bump]);
}
