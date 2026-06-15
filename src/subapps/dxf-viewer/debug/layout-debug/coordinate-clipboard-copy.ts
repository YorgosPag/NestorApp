/**
 * COORDINATE CLIPBOARD COPY — F1-F4 copy for the layout-debug overlay.
 *
 * Fully outside React (no state, no re-render). Reads the cursor SSoT stores
 * (`ImmediatePositionStore` screen + world, `ImmediateTransformStore`) at
 * key-press time — always fresh, no DOM recompute — and writes the formatted
 * text to the clipboard.
 *
 * @module debug/layout-debug/coordinate-clipboard-copy
 */

import { getImmediatePosition, getImmediateWorldPosition } from '../../systems/cursor/ImmediatePositionStore';
import { getImmediateTransform } from '../../systems/cursor/ImmediateTransformStore';
import { getCachedClientRect } from '../../rendering/core/pointer-rect-cache';
import { generateTempId } from '@/services/enterprise-id.service';
import { buildClipboardText, type CopyKind } from './coordinate-readout-format';
import type { Point2D } from '../../rendering/types/Types';

const KEY_TO_KIND: Readonly<Record<string, CopyKind>> = {
  F1: 'c',
  F2: 's',
  F3: 'w',
  F4: 't',
};

/** Legacy execCommand copy (clear-then-write) — clipboard API needs a focus/permission path. */
function writeToClipboard(text: string): void {
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    document.execCommand('copy');
    document.body.removeChild(area);
  } catch {
    // Silent clipboard failure (debug-only feature).
  }
}

function canvasLocal(screen: Point2D): Point2D | null {
  const canvas = document.querySelector('.dxf-canvas') as HTMLElement | null;
  if (!canvas) return null;
  const rect = getCachedClientRect(canvas);
  return { x: screen.x - rect.left, y: screen.y - rect.top };
}

/** Copy the current cursor coordinates (SSoT) to the clipboard for the given kind. */
export function runCoordinateCopy(kind: CopyKind): void {
  const screen = getImmediatePosition();
  if (!screen) return;
  const world = getImmediateWorldPosition() ?? { x: 0, y: 0 };
  const stamp = `${generateTempId().substring(0, 8)}@${Date.now()}`;
  const text = buildClipboardText(kind, {
    screen,
    canvas: canvasLocal(screen),
    world,
    transform: getImmediateTransform(),
    stamp,
  });
  if (text) writeToClipboard(text);
}

/** Install the F1-F4 keyboard copy handlers. Returns an uninstall function. */
export function installCoordinateClipboardCopy(): () => void {
  const onKeyDown = (e: KeyboardEvent): void => {
    const kind = KEY_TO_KIND[e.key];
    if (!kind) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    runCoordinateCopy(kind);
  };
  document.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('keydown', onKeyDown);
  return () => {
    document.removeEventListener('keydown', onKeyDown, true);
    window.removeEventListener('keydown', onKeyDown);
  };
}
