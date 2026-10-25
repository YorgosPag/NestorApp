'use client';

/**
 * @fileoverview **ΟΙ ΠΕΡΙΟΧΕΣ ΠΟΥ ΜΠΟΡΕΙ ΝΑ ΔΗΛΩΣΕΙ Ο ΕΚΔΟΤΗΣ ΓΙΑ ΑΥΤΗ ΤΗ ΘΕΣΗ** — από την πλευρά της οθόνης (ADR-890 §21).
 * @related `app/api/places/declarable-areas/route.ts` · `OwnerPropertyAreaPicker.tsx`
 * @module hooks/geo/useDeclarableAreas
 *
 * 🔑 **Ο πελάτης δεν κρίνει τίποτα**: στέλνει σημείο, ακρίβεια και την τοποθεσία που αναγνώρισε ο geocoder· ο server
 * απαντά με ό,τι η πόρτα γραφής θα δεχόταν. Ίδιο δόγμα με το `usePlaceIdentity`.
 *
 * ⚠️ **Καμία συνθήκη αγώνα**: κάθε νέα θέση ακυρώνει (`AbortController`) την προηγούμενη ερώτηση — μια αργή απάντηση
 * για το προηγούμενο σημείο δεν μπορεί να γράψει επιλογές πάνω στο τρέχον.
 * ⚠️ **Το «δεν απάντησε» ΔΕΝ γίνεται «καμία επιλογή»** (503 ⇒ `unavailable`).
 */

import { useEffect, useState } from 'react';

import type { DeclarableAreaOption, DeclarableAreasResponse } from '@/app/api/places/declarable-areas/route';
import type { GeocodingAccuracy } from '@/lib/geocoding/geocoding-types';
import { createModuleLogger } from '@/lib/telemetry';
import type { GeoPoint } from '@/types/geo/coordinates';

const logger = createModuleLogger('useDeclarableAreas');

export type DeclarableAreasState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly options: readonly DeclarableAreaOption[]; readonly suggestedId: string | null }
  | { readonly kind: 'unavailable' };

export interface DeclarableAreasQuery {
  readonly point: GeoPoint;
  /** `null` = χειροκίνητο σημείο. */
  readonly accuracy: GeocodingAccuracy | null;
  /** Η τοποθεσία όπως την αναγνώρισε ο geocoder — μόνο για την πρόταση. */
  readonly locality: string | null;
}

function urlOf({ point, accuracy, locality }: DeclarableAreasQuery): string {
  const params = new URLSearchParams({ lat: String(point.lat), lng: String(point.lng) });
  if (accuracy !== null) params.set('accuracy', accuracy);
  if (locality !== null && locality.trim() !== '') params.set('locality', locality);
  return `/api/places/declarable-areas?${params.toString()}`;
}

/** `query === null` ⇒ καμία ερώτηση (η θέση δεν χρειάζεται δήλωση ή δεν έχει λυθεί). */
export function useDeclarableAreas(query: DeclarableAreasQuery | null): DeclarableAreasState {
  const [state, setState] = useState<DeclarableAreasState>({ kind: 'idle' });
  const url = query === null ? null : urlOf(query);

  useEffect(() => {
    if (url === null) {
      setState({ kind: 'idle' });
      return undefined;
    }
    const controller = new AbortController();
    setState({ kind: 'loading' });

    fetch(url, { signal: controller.signal })
      .then(async (response) => {
        const body = response.ok ? ((await response.json()) as DeclarableAreasResponse) : null;
        if (controller.signal.aborted) return;
        setState(body === null ? { kind: 'unavailable' } : { kind: 'ready', options: body.options, suggestedId: body.suggestedId });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        logger.warn('Οι επιλογές περιοχής δεν απάντησαν', { error: String(error) });
        setState({ kind: 'unavailable' });
      });

    return () => controller.abort();
  }, [url]);

  return state;
}
