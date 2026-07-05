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
import { useWallPreview, isWallAwaitingEnd } from '../../bim/walls/wall-preview-store';
// ADR-513 — parity δοκού: μετά το 1ο κλικ (awaitingEnd) το ΙΔΙΟ ραδιακό δαχτυλίδι (Μήκος/Γωνία/Πλάτος/Ύψος).
import { useBeamPreview, isBeamAwaitingEnd } from '../../bim/beams/beam-preview-store';
import { RadialCommandRing } from '../../systems/dynamic-input/components/RadialCommandRing';
import { WALL_RING_CONFIG } from '../../systems/dynamic-input/wall-ring-config';
import { BEAM_RING_CONFIG } from '../../systems/dynamic-input/beam-ring-config';
import { LINE_RING_CONFIG } from '../../systems/dynamic-input/line-ring-config';
import { ringStartKey } from '../../systems/dynamic-input/ring-config';
// ADR-513 §grip-parity — press-drag άκρου γραμμής δείχνει το ΙΔΙΟ δαχτυλίδι (lock-only).
import { GRIP_LINEAR_RING_CONFIG } from '../../systems/dynamic-input/grip-linear-ring-config';
import {
  subscribeActiveDragGrip,
  getActiveDragGrip,
  isLineEndpointDragInfo,
} from '../../systems/cursor/GripDragStore';
import { DynamicInputLockStore } from '../../systems/dynamic-input/DynamicInputLockStore';
import type { SceneUnits } from '../../utils/scene-units';
// ADR-513 (3D parity) — όταν είμαστε σε 3D προβολή, το ΙΔΙΟ overlay mountάρεται στο `BimViewport3D`
// (`DynamicInput3DLeaf`)· αυτός ο 2D subscriber υποχωρεί ώστε να μην τρέχουν ΔΥΟ radial rings μαζί
// (διπλά window listeners / intercepts → σπασμένο commit). ΕΝΑ `RadialCommandRing` ανά view.
import { useViewMode3DStore, selectIs3D } from '../../bim-3d/stores/ViewMode3DStore';

interface DynamicInputSubscriberProps {
  activeTool: string;
  viewport: { width: number; height: number };
  transform: ViewTransform;
  canvasRect: DOMRect | null;
  onDrawingPoint: (worldPoint: Point2D) => void;
  /** ADR-513 — draw-time getter των scene-units (μηδέν subscription· mirror slabOpening ghost). */
  getSceneUnits?: () => SceneUnits;
  /** ADR-513 — draw-time getter του canvas element (βελάκι cursor πάνω στα πλήκτρα του ring). */
  getCanvasEl?: () => HTMLCanvasElement | null;
}

const NULL_POINT = (): Point2D | null => null;
const NOOP_SUBSCRIBE = (): (() => void) => () => {};

// ADR-513 §grip-parity — module-level (stable ref) ώστε το `onDeactivate` να μην αλλάζει ανά render.
// Στο τέλος του grip drag ξεκλειδώνει length/angle → επόμενο drag ξεκινά ελεύθερο (no-op αν δεν κλείδωσε τίποτα).
function unlockGripEndpointLocks(): void {
  DynamicInputLockStore.unlock();
}

export const DynamicInputSubscriber = React.memo(function DynamicInputSubscriber({
  activeTool,
  viewport,
  canvasRect,
  onDrawingPoint,
  getSceneUnits,
  getCanvasEl,
}: DynamicInputSubscriberProps) {
  const { dynInput } = useCadToggles();
  // ADR-513 (3D parity) — σε 3D προβολή ο 3D `DynamicInput3DLeaf` κατέχει το overlay· υποχώρησε.
  const is3D = useViewMode3DStore(selectIs3D);

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

  // ADR-513 — wall awaitingEnd (1ο κλικ έγινε): low-freq reactive read (click-time). ΕΝΑΣ SSoT gate
  // (`isWallAwaitingEnd`), κοινός με τον 3D `DynamicInput3DLeaf` — μηδέν διπλότυπο κριτήριο.
  const wallPreview = useWallPreview();
  const wallAwaitingEnd = isWallAwaitingEnd(activeTool, wallPreview);

  // ADR-513 — beam awaitingEnd (1ο κλικ έγινε): ΕΝΑΣ SSoT gate (`isBeamAwaitingEnd`), κοινός με τον 3D
  // leaf ώστε το κριτήριο να μην αποκλίνει· low-freq reactive read (αλλάζει μόνο στα clicks, όχι mousemove).
  const beamPreview = useBeamPreview();
  const beamAwaitingEnd = isBeamAwaitingEnd(activeTool, beamPreview);

  // ADR-513 §grip-parity — low-freq reactive read του ενεργού grip drag (fires μία φορά στο
  // start/end, όχι ανά frame). Οδηγεί το mount/unmount του δαχτυλιδιού στην επέκταση άκρου γραμμής.
  const activeDrag = useSyncExternalStore(subscribeActiveDragGrip, getActiveDragGrip, () => null);
  const lineEndpointDrag = isLineEndpointDragInfo(activeDrag);

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

  // ADR-513 §grip-parity — ΕΠΕΚΤΑΣΗ ΑΚΡΟΥ ΓΡΑΜΜΗΣ (press-drag): δείξε το ΙΔΙΟ «Δαχτυλίδι Εντολών»
  // (Μήκος/Γωνία) σε lock-only mode. Ανεξάρτητο από το `interactive` gate — στο grip-drag το ενεργό
  // εργαλείο είναι συνήθως 'select', οπότε δεν περνά το `isInteractiveTool`. Ίδιος 3D-yield κανόνας.
  if (dynInput.on && !is3D && lineEndpointDrag && activeDrag && getSceneUnits) {
    return (
      <RadialCommandRing
        config={GRIP_LINEAR_RING_CONFIG}
        placementMode="lock-only"
        startKey={`grip:${activeDrag.entityId}:${activeDrag.gripIndex}`}
        sceneUnits={getSceneUnits()}
        getCanvasEl={getCanvasEl}
        onDeactivate={unlockGripEndpointLocks}
      />
    );
  }

  // In 3D the `DynamicInput3DLeaf` (mounted in BimViewport3D) owns this overlay — yield to avoid
  // two RadialCommandRings (double window intercepts). The 2D canvas isn't the drawing surface in 3D.
  if (!interactive || is3D) {
    return null;
  }

  // ADR-513 — στη σχεδίαση τοίχου μετά το 1ο κλικ δείξε το ραδιακό «Δαχτυλίδι Εντολών»
  // (Μήκος/Γωνία/Πάχος/Ύψος) αντί του γραμμικού overlay — μηδέν διπλό UI.
  if (wallAwaitingEnd && getSceneUnits) {
    return (
      <RadialCommandRing
        config={WALL_RING_CONFIG}
        startKey={ringStartKey(wallPreview.startPoint)}
        sceneUnits={getSceneUnits()}
        getCanvasEl={getCanvasEl}
      />
    );
  }

  // ADR-513 — parity δοκού: στη σχεδίαση δοκού μετά το 1ο κλικ δείξε το ραδιακό «Δαχτυλίδι Εντολών»
  // (Μήκος/Γωνία/Πλάτος/Ύψος) αντί του γραμμικού overlay — ίδιος gate/μηχανισμός με τον τοίχο.
  if (beamAwaitingEnd && getSceneUnits) {
    return (
      <RadialCommandRing
        config={BEAM_RING_CONFIG}
        startKey={ringStartKey(beamPreview.startPoint)}
        sceneUnits={getSceneUnits()}
        getCanvasEl={getCanvasEl}
      />
    );
  }

  // ADR-513 §line-parity — η ΓΡΑΜΜΗ δείχνει **ΠΑΝΤΑ** το «Δαχτυλίδι Εντολών» (Giorgio 2026-06-30:
  // «πάντα το δαχτυλίδι· το παλιό DOM overlay καταργείται για τη γραμμή»). Πεδία Μήκος/Γωνία/**Τύπος
  // γραμμής** (drop-down). Πριν το 1ο κλικ → δαχτυλίδι χωρίς anchor (σταθερό startKey)· μετά → με anchor.
  // Κλικ ΕΞΩ από τον τροχό (annulus/outside) = τοποθέτηση σημείου (αρχή ΚΑΙ τέλος), ίδιο idiom με τον τοίχο·
  // κλικ ΣΕ wedge = popup. Άρα δεν πέφτουμε ΠΟΤΕ στο DynamicInputSystem όταν το εργαλείο είναι γραμμή.
  if (activeTool === 'line' && getSceneUnits) {
    return (
      <RadialCommandRing
        config={LINE_RING_CONFIG}
        startKey={ringStartKey(tempPoints[0], 'line-pending')}
        sceneUnits={getSceneUnits()}
        getCanvasEl={getCanvasEl}
      />
    );
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
