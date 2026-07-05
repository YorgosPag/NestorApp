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
 * @see ../../stores/createExternalStore — SSoT pub/sub primitive (notify plumbing)
 */

import { createExternalStore } from '../../stores/createExternalStore';

export type ToolCursorVariant = 'default' | 'trim-pickbox' | 'extend-arrow' | 'offset-pickbox' | 'fillet-pickbox' | 'chamfer-pickbox';

// `equals: Object.is` reproduces the old `if (_variant === v) return` bail.
const store = createExternalStore<ToolCursorVariant>('default', { equals: Object.is });

export const ToolCursorStore = {
  get(): ToolCursorVariant {
    return store.get();
  },

  set(v: ToolCursorVariant): void {
    store.set(v);
  },

  subscribe(fn: () => void): () => void {
    return store.subscribe(fn);
  },

  reset(): void {
    store.set('default');
  },
} as const;
