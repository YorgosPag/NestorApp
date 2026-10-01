'use client';

/**
 * @fileoverview **Η ζώνη αντικειμενικής αξίας σε ένα σημείο, στον browser** (ADR-898 Φ2).
 * @related `lib/market/value-zone-request.ts` (η διαδρομή) · `hooks/market/useListingMarketContext.ts` (ίδιο ιδίωμα)
 * @module hooks/market/useValueZoneAt
 *
 * 🔑 **Ο τελευταίος κερδίζει**: κάθε νέο σημείο ακυρώνει το προηγούμενο αίτημα (`AbortController`), ώστε δύο γρήγορα
 * κλικ στον χάρτη να μην αφήσουν την απάντηση του **πρώτου** πάνω στην πινέζα του **δεύτερου**.
 *
 * 🔑 **«Δεν μάθαμε» ≠ «εκτός ζωνών».** 429/503/δίκτυο ⇒ `failed`· μόνο η ετυμηγορία `outside` λέει «δεν υπάρχει ζώνη».
 */

import { useEffect, useState } from 'react';

import type { ValueZoneVerdict } from '@/lib/market/value-zone-at-point';
import { valueZoneAtPath, type ValueZoneResponse } from '@/lib/market/value-zone-request';
import { createModuleLogger } from '@/lib/telemetry';
import type { GeoPoint } from '@/types/geo/coordinates';

const logger = createModuleLogger('useValueZoneAt');

export type ValueZoneLookup =
  | { readonly kind: 'idle' }
  | { readonly kind: 'loading' }
  | { readonly kind: 'answered'; readonly verdict: ValueZoneVerdict }
  | { readonly kind: 'failed' };

/** `point === null` ⇒ `idle` (κανένα αίτημα). */
export function useValueZoneAt(point: GeoPoint | null): ValueZoneLookup {
  const [state, setState] = useState<ValueZoneLookup>({ kind: 'idle' });
  const lat = point?.lat ?? null;
  const lng = point?.lng ?? null;

  useEffect(() => {
    if (lat === null || lng === null) {
      setState({ kind: 'idle' });
      return;
    }
    const controller = new AbortController();
    setState({ kind: 'loading' });

    void (async () => {
      try {
        const response = await fetch(valueZoneAtPath({ lat, lng }), { signal: controller.signal });
        if (!response.ok) {
          setState({ kind: 'failed' });
          return;
        }
        const body = (await response.json()) as ValueZoneResponse;
        setState({ kind: 'answered', verdict: body.verdict });
      } catch (error) {
        if (controller.signal.aborted) return;
        logger.warn('Η ζώνη αντικειμενικής αξίας δεν απάντησε', { data: { lat, lng }, error: String(error) });
        setState({ kind: 'failed' });
      }
    })();

    return () => controller.abort();
  }, [lat, lng]);

  return state;
}
