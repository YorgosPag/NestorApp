'use client';

import type { Point } from '../types';

export function safeSelectPrimary(isNodeEditMode: boolean, ids: string[]) {
  return isNodeEditMode ? ids[ids.length - 1] ?? null : null;
}

// 🏢 ENTERPRISE: Proper type for drawing tool check
type DrawingTool = 'create' | 'measure' | 'polyline' | null | undefined;

export function isDrawingTool(t: DrawingTool | string): boolean {
  return t === 'create' || t === 'measure' || t === 'polyline';
}

export const noopMouse: React.MouseEventHandler = () => {};
