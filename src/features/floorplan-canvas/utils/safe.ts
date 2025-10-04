'use client';

import type { Point } from '../types';

export function safeSelectPrimary(isNodeEditMode: boolean, ids: string[]) {
  return isNodeEditMode ? ids[ids.length - 1] ?? null : null;
}

export function isDrawingTool(t: any) {
  return t === 'create' || t === 'measure' || t === 'polyline';
}

export const noopMouse: React.MouseEventHandler = () => {};
