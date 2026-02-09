import type { CSSProperties } from 'react';

export const getFloorplanImageZoomStyle = (zoom: number): CSSProperties => ({
  transform: `scale(${zoom})`,
});
