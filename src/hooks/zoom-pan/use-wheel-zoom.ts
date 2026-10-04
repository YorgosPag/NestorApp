/**
 * @fileoverview **Ζουμ με τροχό γύρω από τον δείκτη** — το κανάλι τροχού του `useZoomPan` (ADR-187 · ADR-899 §9 θέμα 3).
 * @module hooks/zoom-pan/use-wheel-zoom
 *
 * Συνεχές (ίσο «γύρισμα» = ίσος λόγος — λείο σε trackpad, όπως Figma/Google Photos), όχι σταθερό βήμα ανά γεγονός.
 * Ο listener δένεται στο στοιχείο που δίνει ο callback ref: δουλεύει και μέσα σε Portal χωρίς listener σε όλο το document.
 */

'use client';

import { useEffect } from 'react';

import { scaleAbout, wheelZoom, type ZoomLimits } from '@/lib/geometry/zoom-pan-math';

import type { ViewCommit, ViewGetter } from './zoom-pan-view';

/** Ο δείκτης σε συντεταγμένες «από το κέντρο του κουτιού» — η αρχή του `translate`. */
export function pointerFromCenter(container: HTMLElement, clientX: number, clientY: number): { x: number; y: number } {
  const rect = container.getBoundingClientRect();
  return { x: clientX - rect.left - rect.width / 2, y: clientY - rect.top - rect.height / 2 };
}

export function useWheelZoom(
  container: HTMLElement | null,
  getView: ViewGetter,
  commit: ViewCommit,
  limits: ZoomLimits,
  sensitivity: number,
): void {
  const { min, max } = limits;
  useEffect(() => {
    if (!container) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const view = getView();
      const zoom = wheelZoom(view.zoom, e.deltaY, sensitivity, { min, max });
      const anchor = pointerFromCenter(container, e.clientX, e.clientY);
      // Το σημείο κάτω από τον δείκτη μένει ακίνητο — ο ΕΝΑΣ τύπος (zoom-pan-math).
      commit({ ...view, zoom, pan: scaleAbout(view.pan, anchor, zoom / view.zoom) });
    };
    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, [container, getView, commit, min, max, sensitivity]);
}
