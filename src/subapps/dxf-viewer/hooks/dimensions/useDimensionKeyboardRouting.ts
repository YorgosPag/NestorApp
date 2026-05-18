'use client';

/**
 * ADR-362 Phase D3 — `useDimensionKeyboardRouting`: live Tab / Space / Escape
 * dispatch from the canvas to the dim creation flow.
 *
 * Q-C industry default — global `window` listener gated by `isDimTool(activeTool)`.
 * Canvas-scoped onKeyDown was rejected because focus drifts to the ribbon /
 * dynamic input / status bar during normal interaction and we'd miss events;
 * a window-level listener with an explicit gate (active dim tool + non-editable
 * focus target) is what AutoCAD / Revit / BricsCAD effectively do, since their
 * Tab/Space command-line shortcuts are global too.
 *
 * Editable-target guard (INPUT / TEXTAREA / contentEditable) matches the same
 * pattern used in `useKeyboardShortcuts`, so dynamic-input boxes (Phase F)
 * keep regular browser behaviour. `preventDefault()` is fired for Tab + Space
 * so browser focus traversal / page scroll don't run while a dim tool is
 * active. Escape is observed but NOT prevented — the legacy
 * `useKeyboardShortcuts` ESC handler still needs to fire its overlay/color
 * fallback paths after we cancel the dim flow.
 *
 * Capture phase + cleanup on unmount + tool deactivation mirror the ADR-040
 * micro-leaf pattern: zero high-frequency store subscriptions, listener torn
 * down the instant the active tool flips away from a dim tool.
 */

import { useEffect, useRef } from 'react';
import type { ToolType } from '../../ui/toolbar/types';
import type { DimensionCreateKey } from './useDimensionCreate';

interface UseDimensionKeyboardRoutingParams {
  readonly activeTool: ToolType;
  readonly isDimTool: (tool: ToolType) => boolean;
  readonly onKey: (key: DimensionCreateKey) => void;
}

export function useDimensionKeyboardRouting(
  params: UseDimensionKeyboardRoutingParams,
): void {
  const onKeyRef = useRef(params.onKey);
  onKeyRef.current = params.onKey;

  useEffect(() => {
    if (!params.isDimTool(params.activeTool)) return;

    const handler = (e: KeyboardEvent): void => {
      const key = mapKey(e);
      if (!key) return;

      if (isEditableFocus()) {
        // Dynamic Input has focus: Enter/Escape still control dim creation.
        // Blur the field first so the value is committed, then dispatch.
        if (key === 'Enter') {
          e.preventDefault();
          (document.activeElement as HTMLElement | null)?.blur?.();
          onKeyRef.current(key);
        } else if (key === 'Escape') {
          // Don't preventDefault: let the legacy useKeyboardShortcuts ESC
          // path still fire (overlay / color-panel reset).
          (document.activeElement as HTMLElement | null)?.blur?.();
          onKeyRef.current(key);
        }
        // Tab / Space: normal browser behaviour when an input owns focus.
        return;
      }

      if (key !== 'Escape') e.preventDefault();
      onKeyRef.current(key);
    };

    window.addEventListener('keydown', handler, { capture: true });
    return () => window.removeEventListener('keydown', handler, { capture: true });
  }, [params, params.activeTool, params.isDimTool]);
}

function mapKey(e: KeyboardEvent): DimensionCreateKey | null {
  if (e.key === 'Tab') return 'Tab';
  if (e.key === ' ' || e.code === 'Space') return 'Space';
  if (e.key === 'Escape') return 'Escape';
  if (e.key === 'Enter') return 'Enter';
  return null;
}

function isEditableFocus(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return true;
  return el.getAttribute('contenteditable') === 'true';
}
