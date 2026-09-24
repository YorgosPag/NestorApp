'use client';

/**
 * **Η αλληλεπίδραση του επιλογέα σημείου** — δείκτης (κλικ/σύρσιμο/αφή) και πληκτρολόγιο (ADR-880).
 *
 * 🏆 **Πλήρες πληκτρολόγιο, εκεί όπου οι μεγάλοι δεν έχουν**: το `FocalPointPicker` του WordPress είναι
 * μόνο σύρσιμο. Εδώ βέλη = 1%, Shift+βέλη = 10%, Home = κέντρο, και δύο αριθμητικά πεδία για ακρίβεια.
 *
 * ⚠️ **Pointer Events με capture**: ένα σύρσιμο που βγαίνει έξω από την εικόνα συνεχίζει να σφηνώνεται στα
 * όρια αντί να «χαθεί» — και ίδιος κώδικας για ποντίκι, πένα και αφή.
 *
 * @module components/listings/focal-point/use-focal-point-picker
 */

import { useCallback, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';

import { CENTER_FOCAL_POINT, type PhotoFocalPoint } from '@/lib/listings/photo-focal-point';

const FINE_STEP = 0.01;
const COARSE_STEP = 0.1;
/** Τρία δεκαδικά — ίδια ακρίβεια με τον κινητήρα του ραφιού. */
const PRECISION = 1000;

const clampUnit = (value: number): number => Math.round(Math.min(1, Math.max(0, value)) * PRECISION) / PRECISION;

/** Σημείο από θέση δείκτη μέσα στο ορθογώνιο της εικόνας. */
function pointFromEvent(event: PointerEvent<HTMLElement>): PhotoFocalPoint {
  const box = event.currentTarget.getBoundingClientRect();
  return {
    x: clampUnit((event.clientX - box.left) / box.width),
    y: clampUnit((event.clientY - box.top) / box.height),
  };
}

const ARROWS: Readonly<Record<string, readonly [number, number]>> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

type PointUpdate = PhotoFocalPoint | ((current: PhotoFocalPoint) => PhotoFocalPoint);
type Commit = (next: PointUpdate) => void;

export interface FocalPointSurfaceHandlers {
  readonly onPointerDown: (event: PointerEvent<HTMLElement>) => void;
  readonly onPointerMove: (event: PointerEvent<HTMLElement>) => void;
  readonly onPointerUp: (event: PointerEvent<HTMLElement>) => void;
  readonly onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
}

export interface FocalPointPicker {
  readonly point: PhotoFocalPoint;
  /**
   * **Άγγιξε ο άνθρωπος το σημείο;** — η «Εφαρμογή» χωρίς άγγιγμα **δεν** παγώνει το αυτόματο ως δική του
   * δήλωση (αλλιώς μια μελλοντική βελτίωση του κινητήρα δεν θα έφτανε ποτέ σε αυτή τη φωτογραφία).
   */
  readonly touched: boolean;
  /** Θέση **χωρίς** άγγιγμα — για την πρόταση του κινητήρα που έφτασε αργότερα. */
  readonly suggest: (next: PhotoFocalPoint) => void;
  readonly setAxis: (axis: 'x' | 'y', percent: number) => void;
  readonly surfaceHandlers: FocalPointSurfaceHandlers;
}

/** Δείκτης: πάτημα ορίζει, σύρσιμο με capture ακολουθεί. */
function usePointerHandlers(commit: Commit): Omit<FocalPointSurfaceHandlers, 'onKeyDown'> {
  const dragging = useRef(false);

  const onPointerDown = useCallback((event: PointerEvent<HTMLElement>) => {
    dragging.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    commit(pointFromEvent(event));
  }, [commit]);

  const onPointerMove = useCallback((event: PointerEvent<HTMLElement>) => {
    if (dragging.current) commit(pointFromEvent(event));
  }, [commit]);

  const onPointerUp = useCallback((event: PointerEvent<HTMLElement>) => {
    dragging.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  return { onPointerDown, onPointerMove, onPointerUp };
}

/** Πληκτρολόγιο: βέλη 1%, Shift 10%, Home κέντρο. Άλλα πλήκτρα περνούν (Tab, Esc). */
function useKeyHandler(commit: Commit): FocalPointSurfaceHandlers['onKeyDown'] {
  return useCallback((event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Home') {
      event.preventDefault();
      commit(CENTER_FOCAL_POINT);
      return;
    }
    const direction = ARROWS[event.key];
    if (direction === undefined) return;
    event.preventDefault();
    const step = event.shiftKey ? COARSE_STEP : FINE_STEP;
    commit((current) => ({
      x: clampUnit(current.x + direction[0] * step),
      y: clampUnit(current.y + direction[1] * step),
    }));
  }, [commit]);
}

export function useFocalPointPicker(initial: PhotoFocalPoint | null): FocalPointPicker {
  const [point, setPoint] = useState<PhotoFocalPoint>(initial ?? CENTER_FOCAL_POINT);
  const [touched, setTouched] = useState(false);

  const commit = useCallback<Commit>((next) => {
    setTouched(true);
    setPoint(next);
  }, []);

  const suggest = useCallback((next: PhotoFocalPoint) => {
    setPoint({ x: clampUnit(next.x), y: clampUnit(next.y) });
  }, []);

  const setAxis = useCallback((axis: 'x' | 'y', percent: number) => {
    if (!Number.isFinite(percent)) return;
    commit((current) => ({ ...current, [axis]: clampUnit(percent / 100) }));
  }, [commit]);

  const pointer = usePointerHandlers(commit);
  const onKeyDown = useKeyHandler(commit);

  return { point, touched, suggest, setAxis, surfaceHandlers: { ...pointer, onKeyDown } };
}
