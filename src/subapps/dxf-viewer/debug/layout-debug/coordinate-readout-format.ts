/**
 * COORDINATE READOUT FORMAT — pure formatters for the layout-debug overlay.
 *
 * SSoT for both the live on-screen readout AND the F1-F4 clipboard copy, which
 * previously formatted the same values in two separate places. Pure (no DOM,
 * no stores) → unit-testable.
 *
 * @module debug/layout-debug/coordinate-readout-format
 */

import type { Point2D, ViewTransform } from '../../rendering/types/Types';

export type CopyKind = 'c' | 's' | 'w' | 't';

const EMPTY = '—';

export function formatScreen(p: Point2D): string {
  return `X: ${Math.round(p.x)}, Y: ${Math.round(p.y)}`;
}

export function formatCanvas(screen: Point2D, rect: DOMRect | null): string {
  if (!rect) return EMPTY;
  return `X: ${Math.round(screen.x - rect.left)}, Y: ${Math.round(screen.y - rect.top)}`;
}

export function formatWorld(p: Point2D): string {
  return `X: ${p.x.toFixed(2)}, Y: ${p.y.toFixed(2)}`;
}

export function formatScale(t: ViewTransform): string {
  return t.scale.toFixed(3);
}

export function formatOffset(t: ViewTransform): string {
  return `(${t.offsetX.toFixed(1)}, ${t.offsetY.toFixed(1)})`;
}

export function formatBoundsSize(rect: DOMRect): string {
  return `${Math.round(rect.width)} × ${Math.round(rect.height)}`;
}

export function formatBoundsPosition(rect: DOMRect): string {
  return `(${Math.round(rect.left)}, ${Math.round(rect.top)})`;
}

/** Snapshot consumed when building the clipboard string (F1-F4). */
export interface ClipboardSnapshot {
  readonly screen: Point2D;
  readonly canvas: Point2D | null;
  readonly world: Point2D;
  readonly transform: ViewTransform;
  /** Unique stamp `id@timestamp` so pasted samples are de-dupable. */
  readonly stamp: string;
}

/** Build the clipboard text for a given F-key copy kind. */
export function buildClipboardText(kind: CopyKind, s: ClipboardSnapshot): string {
  const screen = `Screen: (${Math.round(s.screen.x)}, ${Math.round(s.screen.y)})`;
  const world = `World: (${s.world.x.toFixed(2)}, ${s.world.y.toFixed(2)})`;
  const transform =
    `Transform: Scale=${s.transform.scale.toFixed(3)}, ` +
    `Offset=(${s.transform.offsetX.toFixed(1)}, ${s.transform.offsetY.toFixed(1)})`;
  const tag = `[${s.stamp}]`;
  switch (kind) {
    case 's':
      return `${screen} ${tag}`;
    case 'w':
      return `${world} ${tag}`;
    case 't':
      return `${transform} ${tag}`;
    case 'c': {
      const canvas = s.canvas ? `Canvas: (${Math.round(s.canvas.x)}, ${Math.round(s.canvas.y)})` : '';
      const parts = [screen, canvas, world, transform].filter(Boolean);
      return `${parts.join(' | ')} | ${tag}`;
    }
  }
}
