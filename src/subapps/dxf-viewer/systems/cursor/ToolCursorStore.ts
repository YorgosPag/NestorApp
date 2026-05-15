/**
 * TOOL CURSOR STORE — ADR-350 Phase 3 (B2)
 *
 * Module-level pub/sub SSoT for the active tool cursor variant.
 * Separate from user-preference CursorConfiguration (shape/size/color).
 *
 * Tools set their variant on activate / deactivate; useTrimPreview
 * reads the variant to decide which cursor symbol to draw.
 *
 * @see systems/cursor/config.ts  — user-configurable cursor preferences
 */

export type ToolCursorVariant = 'default' | 'trim-pickbox' | 'extend-arrow';

let _variant: ToolCursorVariant = 'default';
const _listeners = new Set<() => void>();

function _notify(): void {
  _listeners.forEach((fn) => fn());
}

export const ToolCursorStore = {
  get(): ToolCursorVariant {
    return _variant;
  },

  set(v: ToolCursorVariant): void {
    if (_variant === v) return;
    _variant = v;
    _notify();
  },

  subscribe(fn: () => void): () => void {
    _listeners.add(fn);
    return () => _listeners.delete(fn);
  },

  reset(): void {
    ToolCursorStore.set('default');
  },
} as const;
