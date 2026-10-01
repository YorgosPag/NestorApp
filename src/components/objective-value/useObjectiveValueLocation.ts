'use client';

/**
 * @fileoverview **Η θέση του ακινήτου στον υπολογιστή** — διεύθυνση ή πινέζα → σημείο → ζώνη → τιμή ζώνης (ADR-898 Φ2).
 * @related `ObjectiveValueLocation.tsx` (η οθόνη) · `objective-value-zone.ts` (η επιλογή τιμής)
 * @module components/objective-value/useObjectiveValueLocation
 *
 * 🔑 **Η ακρίβεια κρίνεται με τον ΙΔΙΟ κανόνα με τον server** (`valueZonePointOf`): γεωκωδικοποίηση «κέντρο πόλης» ή
 * «δρόμος χωρίς αριθμό» ⇒ **καμία** πινέζα και κανένα αίτημα· ο χάρτης πετά εκεί και ο άνθρωπος πατά πάνω στο ακίνητο.
 * Μια ζώνη από τέτοιο σημείο θα ήταν μαντεψιά — η ζώνη είναι οικοδομικό τετράγωνο.
 */

import { useCallback, useState } from 'react';

import { usePlaceResolver, type PlaceResolver, type ResolvedPlace } from '@/hooks/geo/usePlaceResolver';
import { useValueZoneAt, type ValueZoneLookup } from '@/hooks/market/useValueZoneAt';
import { nowISO } from '@/lib/date-local';
import type { PlaceFocus } from '@/lib/geo/geocoding-focus';
import { valueZonePointOf } from '@/lib/market/value-zone-at-point';
import type { GeoPoint } from '@/types/geo/coordinates';

import { chosenZonePrice } from './objective-value-zone';

export interface ObjectiveValueLocationState {
  readonly query: string;
  readonly setQuery: (query: string) => void;
  readonly resolver: PlaceResolver;
  /** Η απάντηση του γεωκωδικοποιητή — επιβεβαίωση προς τον άνθρωπο, όχι δήλωση. */
  readonly resolved: ResolvedPlace | null;
  readonly imprecise: boolean;
  readonly pin: GeoPoint | null;
  readonly focus: PlaceFocus | null;
  readonly pick: (point: GeoPoint) => void;
  readonly lookup: ValueZoneLookup;
  readonly frontKey: string | null;
  readonly setFrontKey: (key: string | null) => void;
  readonly manualPrice: number | null;
  readonly setManualPrice: (price: number | null) => void;
  /** Η τιμή που μπαίνει στη μηχανή, ή `null`. */
  readonly zonePrice: number | null;
}

interface PinState {
  readonly pin: GeoPoint | null;
  readonly focus: PlaceFocus | null;
  readonly resolved: ResolvedPlace | null;
  readonly imprecise: boolean;
}

const NO_PIN: PinState = { pin: null, focus: null, resolved: null, imprecise: false };

/** Η απάντηση του γεωκωδικοποιητή ως πινέζα — ή καμία, αν δεν είναι η ίδια η διεύθυνση. */
function pinFromPlace(place: ResolvedPlace): PinState {
  const point = { lat: place.lat, lng: place.lng };
  const precise = valueZonePointOf({
    kind: 'known',
    provenance: 'geocoded',
    accuracy: place.accuracy,
    point,
    locatedAt: nowISO(),
  });
  return {
    pin: precise,
    focus: { point, accuracy: place.accuracy, extent: place.extent },
    resolved: place,
    imprecise: precise === null,
  };
}

export function useObjectiveValueLocation(): ObjectiveValueLocationState {
  const [query, setQueryState] = useState('');
  const [pinState, setPinState] = useState<PinState>(NO_PIN);
  const [frontKey, setFrontKey] = useState<string | null>(null);
  const [manualPrice, setManualPrice] = useState<number | null>(null);

  // Ένα σημείο ⇒ μία ετυμηγορία: κάθε νέα θέση ξεχνά το μέτωπο που δηλώθηκε για την προηγούμενη.
  const placePin = useCallback((next: PinState) => {
    setPinState(next);
    setFrontKey(null);
  }, []);

  const resolver = usePlaceResolver({
    onFound: useCallback((place: ResolvedPlace) => placePin(pinFromPlace(place)), [placePin]),
    onCleared: useCallback(() => placePin(NO_PIN), [placePin]),
  });
  const { reset, state } = resolver;

  const setQuery = useCallback(
    (next: string) => {
      setQueryState(next);
      if (state !== 'idle') reset();
    },
    [reset, state],
  );
  const pick = useCallback((point: GeoPoint) => placePin({ ...NO_PIN, pin: point }), [placePin]);

  const lookup = useValueZoneAt(pinState.pin);
  return {
    query,
    setQuery,
    resolver,
    ...pinState,
    pick,
    lookup,
    frontKey,
    setFrontKey,
    manualPrice,
    setManualPrice,
    zonePrice: chosenZonePrice(lookup, frontKey, manualPrice),
  };
}
