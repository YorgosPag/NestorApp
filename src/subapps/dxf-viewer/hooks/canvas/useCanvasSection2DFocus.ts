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
// ADR-040 Phase XXII.A — transform reads from SSoT, not React prop.
import { getImmediateTransform } from '../../systems/cursor/ImmediateTransformStore';
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
  // ADR-040 XXII.A: `transform` param retained for signature compat; fallback via SSoT.
  const { dxfSceneRef, transformRef, transform: _transform, viewport, universalSelectionRef } = args;
  void _transform;
  const toggleFocusedEntity = useCallback<
    Parameters<typeof use2DKeyboardFocus>[0]['toggleEntity']
  >((id, type) => universalSelectionRef.current.toggle(id, type), [universalSelectionRef]);
  use2DKeyboardFocus({
    getScene: () => dxfSceneRef.current,
    // ADR-040 XXII.A: prefer transformRef (writer-maintained), fallback to SSoT.
    getTransform: () => transformRef.current ?? getImmediateTransform(),
    getViewport: () => viewport,
    toggleEntity: toggleFocusedEntity,
  });
}
