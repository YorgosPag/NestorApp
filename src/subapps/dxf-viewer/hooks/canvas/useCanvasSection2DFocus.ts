// ============================================================================
// ⌨️ useCanvasSection2DFocus — ADR-366 Phase 4.6 / A.7.Q1 wiring helper
// ============================================================================
//
// Extracted from CanvasSection.tsx so the orchestrator stays under the N.7.1
// 500-line ceiling. The hook wires the canvas refs/values into the lower-level
// `use2DKeyboardFocus` listener — getter pattern (ADR-040 Rule 2) for the
// scene/transform/viewport reads, and the ADR-030 universal selection SSoT
// for the Enter-key toggle.
// ============================================================================

import { useCallback } from 'react';
import type React from 'react';
import { use2DKeyboardFocus } from '../state/use2DKeyboardFocus';
import type { DxfScene } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { ViewTransform, Viewport } from '../../rendering/types/Types';
import type { SelectableEntityType } from '../../systems/selection/types';

interface UniversalSelectionLike {
  readonly toggle: (id: string, type: SelectableEntityType) => void;
}

export interface UseCanvasSection2DFocusArgs {
  readonly dxfSceneRef: React.MutableRefObject<DxfScene | null>;
  readonly transformRef: React.MutableRefObject<ViewTransform | null>;
  readonly transform: ViewTransform;
  readonly viewport: Viewport;
  readonly universalSelectionRef: React.MutableRefObject<UniversalSelectionLike>;
}

export function useCanvasSection2DFocus(args: UseCanvasSection2DFocusArgs): void {
  const { dxfSceneRef, transformRef, transform, viewport, universalSelectionRef } = args;
  const toggleFocusedEntity = useCallback<
    Parameters<typeof use2DKeyboardFocus>[0]['toggleEntity']
  >((id, type) => universalSelectionRef.current.toggle(id, type), [universalSelectionRef]);
  use2DKeyboardFocus({
    getScene: () => dxfSceneRef.current,
    getTransform: () => transformRef.current ?? transform,
    getViewport: () => viewport,
    toggleEntity: toggleFocusedEntity,
  });
}
