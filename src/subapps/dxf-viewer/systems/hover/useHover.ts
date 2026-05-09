/**
 * HOVER SYSTEM HOOKS — micro-leaf subscribers for hovered entity/overlay IDs.
 *
 * Each hook subscribes via useSyncExternalStore so only the calling component
 * re-renders when the hover value changes — NOT the parent orchestrator.
 *
 * Mirror pattern: systems/cursor/useCursor.ts → useCursorPosition()
 * ADR-040: Phase E micro-leaf subscriber pattern.
 */

import { useSyncExternalStore } from 'react';
import {
  subscribeHoveredEntity,
  subscribeHoveredOverlay,
  getHoveredEntity,
  getHoveredOverlay,
} from './HoverStore';

/** Returns the currently hovered DXF entity ID (null when none). */
export function useHoveredEntity(): string | null {
  return useSyncExternalStore(
    subscribeHoveredEntity,
    getHoveredEntity,
    getHoveredEntity,
  );
}

/** Returns the currently hovered overlay (ColorLayer) ID (null when none). */
export function useHoveredOverlay(): string | null {
  return useSyncExternalStore(
    subscribeHoveredOverlay,
    getHoveredOverlay,
    getHoveredOverlay,
  );
}
