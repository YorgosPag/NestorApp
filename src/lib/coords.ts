
'use client';
import type { MouseEvent as ReactMouseEvent } from 'react';

export const getZoomFrom = (el: Element | null) =>
  parseFloat(el?.closest('[data-zoom]')?.getAttribute('data-zoom') || '1');

export const getPanFrom = (el: Element | null) => ({
  x: parseFloat(el?.closest('div[data-pan-x]')?.getAttribute('data-pan-x') || '0'),
  y: parseFloat(el?.closest('div[data-pan-y]')?.getAttribute('data-pan-y') || '0'),
});

export const toSvgPointFromMouse = (
  e: MouseEvent | ReactMouseEvent,
  svgEl: SVGSVGElement | null
) => {
  if (!svgEl) return { x: 0, y: 0 };
  const rect = svgEl.getBoundingClientRect();
  const zoom = getZoomFrom(svgEl);
  const pan = getPanFrom(svgEl);
  return {
    x: (('clientX' in e ? e.clientX : 0) - rect.left - pan.x) / zoom,
    y: (('clientY' in e ? e.clientY : 0) - rect.top - pan.y) / zoom,
  };
};
