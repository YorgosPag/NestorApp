'use client';

/**
 * **Μέτρηση συγκρούσεων πινακίδων** — κανόνας 5 του `listing-price-markers.ts` (ADR-777 §8.78).
 *
 * 🔑 **Μετράμε το DOM, δεν μαντεύουμε πλάτος**: «150.000 €» και «50 €/νύχτα · 3 νύχτες» έχουν
 * άλλο πλάτος, και η γραμματοσειρά/γλώσσα το αλλάζει. Ένα `getBoundingClientRect` ανά πινακίδα
 * (≤ 40, `PRICE_MARKER_LIMIT`) **μόνο όταν αλλάξει το ζουμ ή το σύνολο** — το σύρσιμο μετακινεί
 * όλες τις πινακίδες μαζί, άρα οι συγκρούσεις δεν αλλάζουν.
 *
 * ⏱️ **`useEffect`, ΟΧΙ `useLayoutEffect` — μετρημένο στον browser**: η react-map-gl προσαρτά τον
 * δείκτη στον χάρτη (`marker.addTo`) σε **passive** effect του παιδιού. Σε `useLayoutEffect` οι
 * νέες πινακίδες ήταν ακόμη **αποσυνδεδεμένες** (ορθογώνιο 0) ⇒ «δεν μετρήθηκε» ⇒ ορατές, και
 * στο Κορδελιό έμειναν δύο τιμές η μία πάνω στην άλλη. Τα effects του γονέα τρέχουν **μετά** των
 * παιδιών ⇒ εδώ ο δείκτης είναι ήδη στη θέση του.
 * 🔑 **Καμία αναλαμπή παρ' όλα αυτά**: πινακίδα που **δεν έχει μετρηθεί ακόμη** μένει `invisible`
 * (εκκρεμής) — εμφανίζεται ένα καρέ αργότερα, ποτέ επικαλυπτόμενη.
 * 🔑 Η απόφαση ξανατρέχει σε κάθε `peek` (φθηνή, καθαρή) — η **μέτρηση** όχι.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  resolvePlaqueCollisions,
  type ListingPriceMarker,
  type PlaqueBox,
} from '@/lib/listings/listing-price-markers';
import type { ListingFocus } from '@/lib/listings/listing-focus';
import { usePlaqueLayoutZoom } from './listing-map-drawn-points';

export interface PlaqueCollisions {
  /** Ref ανά πινακίδα — σταθερός ανά `id`, ώστε η React να μην τον ξανακαλεί σε κάθε απόδοση. */
  readonly refFor: (id: string) => (element: HTMLElement | null) => void;
  /** Κρύβεται (κουκίδα χωρίς ετικέτα, Airbnb «mini-pin»); */
  readonly isSuppressed: (id: string) => boolean;
}

export function usePlaqueCollisions(
  markers: readonly ListingPriceMarker[],
  focus: ListingFocus,
): PlaqueCollisions {
  const zoom = usePlaqueLayoutZoom();
  const elements = useRef(new Map<string, HTMLElement>());
  const refs = useRef(new Map<string, (element: HTMLElement | null) => void>());
  const [boxes, setBoxes] = useState<readonly PlaqueBox[]>([]);

  const refFor = useCallback((id: string) => {
    const cached = refs.current.get(id);
    if (cached) return cached;
    const ref = (element: HTMLElement | null) => {
      if (element) elements.current.set(id, element);
      else elements.current.delete(id);
    };
    refs.current.set(id, ref);
    return ref;
  }, []);

  useEffect(() => {
    setBoxes(measurePlaques(markers, elements.current));
  }, [markers, zoom]);

  const visible = useMemo(() => {
    const pinned = new Set([focus.selected, focus.peeked].filter((id): id is string => id !== null));
    return resolvePlaqueCollisions(boxes, pinned);
  }, [boxes, focus.selected, focus.peeked]);

  // Εκκρεμής (δεν μετρήθηκε ακόμη) ⇒ κρυμμένη· μετρημένη ⇒ ό,τι αποφάσισε ο κριτής.
  const isSuppressed = useCallback((id: string) => !visible.has(id), [visible]);

  return { refFor, isSuppressed };
}

/** Τα ορθογώνια, **με τη σειρά του κριτή** (`fairOrder`) — αυτή είναι η προτεραιότητα. */
function measurePlaques(
  markers: readonly ListingPriceMarker[],
  elements: ReadonlyMap<string, HTMLElement>,
): readonly PlaqueBox[] {
  const boxes: PlaqueBox[] = [];
  for (const { id } of markers) {
    const element = elements.get(id);
    if (!element) continue;
    const { left, top, right, bottom } = element.getBoundingClientRect();
    boxes.push({ id, left, top, right, bottom });
  }
  return boxes;
}
