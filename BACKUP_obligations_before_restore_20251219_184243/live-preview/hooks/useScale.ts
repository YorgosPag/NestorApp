"use client";

import { useMemo } from 'react';

export function useScale(zoom: number) {
  const scale = useMemo(() => Math.max(0.25, Math.min(3, zoom / 100)), [zoom]);
  const zoomDisplay = useMemo(() => Math.round(scale * 100), [scale]);

  return { scale, zoomDisplay };
}
