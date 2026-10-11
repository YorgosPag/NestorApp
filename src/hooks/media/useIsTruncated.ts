'use client';
/**
 * @fileoverview **«Κόβεται αυτό το κείμενο;»** — μετρημένο πάνω στο στοιχείο, όχι μαντεμένο από το μήκος της συμβολοσειράς.
 * @related ADR-912 §12.6 (τίτλος της μπάρας του φύλλου κινητού, η πρώτη χρήση) · `useElementSize.ts` (ο ΕΝΑΣ παρατηρητής)
 * @module hooks/media/useIsTruncated
 *
 * 🔑 **Η ερώτηση είναι του στοιχείου**: το ίδιο όνομα χωρά στα 390px και κόβεται στα 320px, χωρά χωρίς ενέργειες και
 *   κόβεται δίπλα σε δύο κουμπιά. Κανένα όριο χαρακτήρων δεν το απαντά (η HIG λέει «κάτω από 15 χαρακτήρες» ως **στόχο
 *   σύνταξης**, όχι ως κριτήριο απόδοσης).
 * 🔑 **Μονόγραμμη αποκοπή** (`truncate`): σύγκριση `scrollWidth` με `clientWidth`. Για `line-clamp-N` η ερώτηση είναι
 *   κάθετη και **δεν** απαντιέται εδώ.
 * ⚠️ Χωρίς διάταξη (SSR · jsdom) και τα δύο είναι `0` ⇒ `false`: ό,τι δεν μετρήθηκε δεν δηλώνεται κομμένο.
 */
import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from 'react';

import { useSizeObserver } from '@/hooks/media/useElementSize';

/** Κλασματικά πλάτη (zoom · γραμματοσειρές) στρογγυλεύονται προς τα πάνω στο `scrollWidth`. */
const ROUNDING_TOLERANCE_PX = 1;

export interface Truncation<E extends HTMLElement> {
  readonly ref: RefObject<E | null>;
  readonly truncated: boolean;
}

/** Το στοιχείο πρέπει να είναι **στημένο στο πρώτο render** του καλούντα (ο παρατηρητής δένεται μία φορά). */
export function useIsTruncated<E extends HTMLElement = HTMLElement>(): Truncation<E> {
  const ref = useRef<E | null>(null);
  const [truncated, setTruncated] = useState(false);

  const sync = useCallback(() => {
    const element = ref.current;
    if (!element) return;
    const next = element.scrollWidth > element.clientWidth + ROUNDING_TOLERANCE_PX;
    setTruncated((prev) => (prev === next ? prev : next));
  }, []);

  useSizeObserver(ref, sync);
  // Κείμενο που αλλάζει μέσα σε κουτί που ΔΕΝ αλλάζει μέγεθος (ήδη κομμένο → άλλο κομμένο, ή κομμένο → χωρά στο ίδιο
  // πλάτος) δεν ξυπνά τον παρατηρητή. Η μέτρηση ξαναγίνεται μετά από κάθε render· κατάσταση αλλάζει μόνο αν αλλάξει η απάντηση.
  useLayoutEffect(sync);

  return { ref, truncated };
}
