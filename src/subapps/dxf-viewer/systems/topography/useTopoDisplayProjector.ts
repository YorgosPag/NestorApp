'use client';
/**
 * ADR-920 Β4.8 Β1 — the WORLD→DISPLAY projector for a React overlay, re-read when the geo-reference changes.
 *
 * Every 2D overlay that draws survey geometry must pass it through `project` (ADR-650 §M10f). Two overlays
 * drew WORLD (ΕΓΣΑ) vertices straight onto a DISPLAY canvas — invisible in any geo-referenced project, the
 * same class ADR-718 closed for the opposite direction. The projector lives in ONE store-reading entry
 * (`getTopoDisplayProjector`); this hook only makes it reactive. LOW-frequency (geo-reference edits).
 */
import { useMemo, useSyncExternalStore } from 'react';
import { getGeoReference, subscribeGeoReference } from '../geo-referencing/geo-reference-store';
import { getTopoDisplayProjector } from './topo-display-frame';
import type { WorldToDisplayProjector } from '../geo-referencing/geo-transform';

export function useTopoDisplayProjector(): WorldToDisplayProjector | null {
  const geo = useSyncExternalStore(subscribeGeoReference, getGeoReference, getGeoReference);
  // `geo` is the identity the projector is derived from — rebuilt only when the reference changes.
  return useMemo(() => getTopoDisplayProjector(), [geo]);
}
