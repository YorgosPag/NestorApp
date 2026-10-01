'use client';

/**
 * @fileoverview **Η προβολή λίστα ‖ χάρτης, δεμένη στο URL** — ώστε ο σύνδεσμος να θυμάται
 * τι κοίταζε ο άνθρωπος (πρότυπο portals: `?view=map`).
 * @related lib/list-map/list-map-view · components/shared/list-map/ListMapSplit · ADR-896
 * @module hooks/list-map/useListMapView
 *
 * 🔑 Εξήχθη από το `useOwnerPortfolioView` όταν απέκτησε δεύτερο καταναλωτή (`/pro`).
 */

import { useCallback, useMemo } from 'react';

import { useUrlQuery } from '@/hooks/useUrlQuery';
import { parseListMapView, writeListMapView, type ListMapView } from '@/lib/list-map/list-map-view';
import { replaceUrlSearchParams } from '@/lib/url-query-state';

export interface ListMapViewState {
  readonly view: ListMapView;
  readonly setView: (view: ListMapView) => void;
}

export function useListMapView(): ListMapViewState {
  const query = useUrlQuery();
  const requested = useMemo(() => parseListMapView(new URLSearchParams(query)), [query]);

  const setView = useCallback((view: ListMapView) => {
    replaceUrlSearchParams((params) => writeListMapView(view, params));
  }, []);

  return { view: requested, setView };
}
