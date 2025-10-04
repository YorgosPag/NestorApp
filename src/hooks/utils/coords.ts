'use client';

export const getZoomFromEl = (el: Element | null) =>
  parseFloat(el?.closest('[data-zoom]')?.getAttribute('data-zoom') || '1');

export const toSvgPoint = (
  e: React.MouseEvent<SVGSVGElement>,
  pan: {x:number;y:number},
  svgEl: SVGSVGElement | null,
) => {
  const rect = (svgEl ?? e.currentTarget).getBoundingClientRect();
  const zoom = getZoomFromEl(svgEl ?? e.currentTarget);
  return {
    x: (e.clientX - rect.left - pan.x) / zoom,
    y: (e.clientY - rect.top - pan.y) / zoom,
  };
};
