/**
 * ADR-357 Phase 2a — Dynamic Input overlay micro-leaf subscriber.
 *
 * Mounts the `DynamicInputOverlay` permanently while an interactive drawing /
 * measurement tool is active and the status-bar `dynInput` toggle is ON
 * (ADR §5.1). Subscribes to:
 *   - `ImmediatePositionStore` (screen + world cursor) for live readout.
 *   - `useDrawingMachine` (global) for `tempPoints` → anchor for length/angle.
 *
 * The leaf isolates the high-frequency re-renders (cursor updates) so that
 * `CanvasLayerStack` and `CanvasSection` are not impacted (ADR-040 pattern).
 */

'use client';

import React, { useSyncExternalStore } from 'react';
import type { Point2D, ViewTransform } from '../../rendering/types/Types';
import {
  subscribeToImmediatePosition,
  subscribeToImmediateWorldPosition,
  getImmediatePosition,
  getImmediateWorldPosition,
} from '../../systems/cursor/ImmediatePositionStore';
import { useCadToggles } from '../../hooks/common/useCadToggles';
import { isInteractiveTool } from '../../systems/tools/ToolStateManager';
import { useDrawingMachine } from '../../core/state-machine';
import { useDynamicInputHandler } from '../../systems/dynamic-input/hooks/useDynamicInputHandler';
import DynamicInputSystem from '../../systems/dynamic-input/DynamicInputSystem';
import type { AnySceneEntity } from '../../rendering/types/Types';
// ADR-513 — «Δαχτυλίδι Εντολών»: ραδιακό in-canvas dynamic input στη σχεδίαση τοίχου (awaitingEnd).
import { useWallPreview } from '../../bim/walls/wall-preview-store';
import { RadialCommandRing } from '../../systems/dynamic-input/components/RadialCommandRing';
import type { SceneUnits } from '../../utils/scene-units';

interface DynamicInputSubscriberProps {
  activeTool: string;
  viewport: { width: number; height: number };
  transform: ViewTransform;
  canvasRect: DOMRect | null;
  onDrawingPoint: (worldPoint: Point2D) => void;
  /** ADR-513 — draw-time getter των scene-units (μηδέν subscription· mirror slabOpening ghost). */
  getSceneUnits?: () => SceneUnits;
}

const NULL_POINT = (): Point2D | null => null;
const NOOP_SUBSCRIBE = (): (() => void) => () => {};

export const DynamicInputSubscriber = React.memo(function DynamicInputSubscriber({
  activeTool,
  viewport,
  canvasRect,
  onDrawingPoint,
  getSceneUnits,
}: DynamicInputSubscriberProps) {
  const { dynInput } = useCadToggles();

  // SSoT gate (ADR-040): the dynamic-input readout only consumes the 60fps cursor
  // stream while it is actually shown (toggle ON + an interactive tool). When idle
  // we subscribe to a NO-OP store, so this leaf does NOT re-render on every
  // mousemove (it was the #1 per-move re-render before this gate).
  const interactive = dynInput.on && isInteractiveTool(activeTool);

  // High-frequency cursor subscriptions — isolated to this leaf, gated by `interactive`.
  const cursorPosition = useSyncExternalStore(
    interactive ? subscribeToImmediatePosition : NOOP_SUBSCRIBE,
    interactive ? getImmediatePosition : NULL_POINT,
    NULL_POINT,
  );
  const mouseWorldPosition = useSyncExternalStore(
    interactive ? subscribeToImmediateWorldPosition : NOOP_SUBSCRIBE,
    interactive ? getImmediateWorldPosition : NULL_POINT,
    NULL_POINT,
  );

  // State machine `tempPoints` (changes only on click, not mousemove).
  const { context } = useDrawingMachine({ useGlobal: true });
  const tempPoints = context.points as Point2D[];

  // ADR-513 — wall awaitingEnd (1ο κλικ έγινε): low-freq reactive read (click-time).
  const wallPreview = useWallPreview();
  const wallAwaitingEnd =
    activeTool === 'wall' && !!wallPreview.startPoint && !wallPreview.endPoint;

  // Wire keyboard pipeline: maps `dynamic-input-coordinate-submit` events back
  // to the canvas drawing pipeline (`onDrawingPoint`) — see ADR §4 G2.
  useDynamicInputHandler({
    activeTool,
    onDrawingPoint,
    // Phase 2a scope is `line` only. Circle/measure tools that emit direct
    // entity events still pass through `useDynamicInputHandler`; a no-op
    // callback here keeps the handler shape stable until Phase 4 wires them.
    onEntityCreated: noopEntityCreated,
  });

  if (!interactive) {
    return null;
  }

  // ADR-513 — στη σχεδίαση τοίχου μετά το 1ο κλικ δείξε το ραδιακό «Δαχτυλίδι Εντολών»
  // (Μήκος/Γωνία/Πάχος/Ύψος) αντί του γραμμικού overlay — μηδέν διπλό UI.
  if (wallAwaitingEnd && getSceneUnits) {
    return <RadialCommandRing sceneUnits={getSceneUnits()} />;
  }

  return (
    <DynamicInputSystem
      isActive
      cursorPosition={cursorPosition}
      mouseWorldPosition={mouseWorldPosition}
      viewport={viewport}
      canvasRect={canvasRect}
      activeTool={activeTool}
      tempPoints={tempPoints}
    />
  );
});

function noopEntityCreated(_entity: AnySceneEntity): void {
  // Phase 2a: line tool is the only consumer and uses `onDrawingPoint`.
  // Other tools will wire a real callback in their respective phases.
}
