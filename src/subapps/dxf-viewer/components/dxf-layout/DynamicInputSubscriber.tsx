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

import React, { useEffect, useSyncExternalStore } from 'react';
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
// ADR-060 — «Κάθετη Γραμμή»: μετά το 1ο σημείο, length-only δαχτυλίδι (direction ήδη κλειδωμένη).
import { PERPENDICULAR_LINE_RING_CONFIG } from '../../systems/dynamic-input/perpendicular-line-ring-config';
import { RECTANGLE_RING_CONFIG } from '../../systems/dynamic-input/rectangle-ring-config';
import { RectLockStore } from '../../systems/dynamic-input/RectLockStore';
import { ringStartKey, type RingConfig } from '../../systems/dynamic-input/ring-config';
// ADR-513 §grip-parity — press-drag άκρου γραμμής δείχνει το ΙΔΙΟ δαχτυλίδι (lock-only).
import { GRIP_LINEAR_RING_CONFIG } from '../../systems/dynamic-input/grip-linear-ring-config';
import { OPENING_WIDTH_RING_CONFIG } from '../../systems/dynamic-input/opening-width-ring-config';
import {
  subscribeActiveDragGrip,
  getActiveDragGrip,
  isLineEndpointDragInfo,
  isOpeningCornerDragInfo,
  isVertexReshapeDragInfo,
  isResizeGripDragInfo,
  isMoveDisplacementDragInfo,
  type ActiveDragGripInfo,
} from '../../systems/cursor/GripDragStore';

/**
 * ADR-513 §grip-parity-hotgrip — Η ΜΙΑ διάταξη «ποιο ενεργό grip drag δείχνει ποιο Δαχτυλίδι Εντολών».
 * Πρώτο match κερδίζει· η σειρά είναι σημασιολογική (ειδικό → γενικό), γι' αυτό η ΜΕΤΑΚΙΝΗΣΗ (η πιο
 * γενική συνθήκη) είναι τελευταία και δεν μπορεί να κλέψει drag από τις λαβές αναμόρφωσης.
 *
 * `requiresDynInput: false` ⇒ το δαχτυλίδι εμφανίζεται ανεξάρτητα από τον διακόπτη ΔΥΝ — ισχύει για το
 * πλάτος κουφώματος (Giorgio 2026-07-18: «κλικ στη λαβή → λάστιχο → πληκτρολόγηση», χωρίς διακόπτη).
 */
const GRIP_RING_VARIANTS: readonly {
  readonly match: (info: ActiveDragGripInfo) => boolean;
  readonly config: RingConfig;
  readonly keyPrefix: string;
  readonly requiresDynInput: boolean;
}[] = [
  // ΕΠΕΚΤΑΣΗ ΑΚΡΟΥ ΓΡΑΜΜΗΣ — Μήκος/Γωνία, σημασιολογία «όρισε το μήκος της γραμμής».
  { match: isLineEndpointDragInfo, config: GRIP_LINEAR_RING_CONFIG, keyPrefix: 'grip', requiresDynInput: true },
  // ΚΟΡΥΦΗ/ΠΛΕΥΡΑ ΠΟΛΥΓΡΑΜΜΗΣ ή ΑΚΡΟ ΤΟΞΟΥ (incl. projected ορθογώνιο) — displacement (τραπέζιο / όλη η πλευρά).
  { match: isVertexReshapeDragInfo, config: GRIP_LINEAR_RING_CONFIG, keyPrefix: 'grip-reshape', requiresDynInput: true },
  // ΠΛΑΤΟΣ ΚΟΥΦΩΜΑΤΟΣ — length-only δαχτυλίδι, χωρίς gate ΔΥΝ.
  { match: isOpeningCornerDragInfo, config: OPENING_WIDTH_RING_CONFIG, keyPrefix: 'opening-width', requiresDynInput: false },
  // ΑΛΛΑΓΗ ΜΕΓΕΘΟΥΣ (γωνία / μεσοπλευρική / λαβή διάστασης, ΚΑΘΕ οντότητας) — ΙΔΙΟ Μήκος/Γωνία
  // δαχτυλίδι με την αναμόρφωση κορυφής, γιατί έχει ΙΔΙΑ σημασιολογία: displacement της λαβής.
  { match: isResizeGripDragInfo, config: GRIP_LINEAR_RING_CONFIG, keyPrefix: 'grip-resize', requiresDynInput: true },
  // ΜΕΤΑΚΙΝΗΣΗ ΟΛΟΚΛΗΡΗΣ ΟΝΤΟΤΗΤΑΣ (5ο σκαλί) — displacement κατά ORTHO/POLAR με πληκτρολογημένο μήκος.
  { match: isMoveDisplacementDragInfo, config: GRIP_LINEAR_RING_CONFIG, keyPrefix: 'grip-move', requiresDynInput: true },
];
import { DynamicInputLockStore } from '../../systems/dynamic-input/DynamicInputLockStore';
// ADR-513 §rotation-ring — single-slice «Γωνία» ring στο rotate-free (typed rotation angle).
import { ROTATION_RING_CONFIG } from '../../systems/dynamic-input/rotation-ring-config';
import { RotationRingStore } from '../../systems/dynamic-input/rotation-ring-store';
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

  // ADR-513 §multi-field-lock — μόλις ΣΒΗΣΕΙ η Δυναμική Εισαγωγή, καθάρισε ΟΛΑ τα length/angle locks ώστε
  // η επόμενη εντολή να ξεκινά ΕΛΕΥΘΕΡΗ. Το `applyLengthAngleLock` είναι UNGATED (useDrawingHandlers/
  // useWallTool/useBeamTool το διαβάζουν όποτε υπάρχει lock) → χωρίς αυτό, stale τιμές «κολλάνε» σε νέα
  // γραμμή/τοίχο ακόμη κι με τη Δυναμική Εισαγωγή OFF (bug Giorgio 2026-07-06). Idempotent (no-op αν άδειο).
  useEffect(() => {
    if (!dynInput.on) {
      DynamicInputLockStore.unlock();
      // ADR-513 §rotation-ring — καθάρισε και τυχόν πληκτρολογημένη γωνία περιστροφής ώστε το ghost
      // να μη «κολλήσει» σε stale γωνία όταν σβήσει η Δυναμική Εισαγωγή μεσα σε rotate-free.
      RotationRingStore.clearAngle();
      // ADR-513 §rectangle — ίδιος κανόνας για τα rectangle locks (Πλάτος/Ύψος/Γωνία).
      RectLockStore.unlockAll();
    }
  }, [dynInput.on]);

  // ADR-513 §rotation-ring — low-freq gate: το βήμα `rotate-free` είναι ενεργό (set στο centre-pick,
  // clear σε commit/cancel/«R»/selection-change). Οδηγεί το mount του single-slice «Γωνία» ring.
  const rotateFreeActive = useSyncExternalStore(
    RotationRingStore.subscribe, RotationRingStore.isSessionActive, () => false,
  );

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

  // ADR-513 §grip-parity-hotgrip — ΕΝΑ mount για ΟΛΑ τα δαχτυλίδια λαβής (πίνακας `GRIP_RING_VARIANTS`).
  // Ο μηχανισμός είναι πάντα ο ΙΔΙΟΣ — `canvas-click` mode, ΑΚΡΙΒΩΣ ο μηχανισμός του τοίχου/γραμμής
  // (Giorgio: «πανομοιότυπη λειτουργία με τον τοίχο»): ο τροχός μπλοκάρει ΟΛΑ τα inside events άνευ όρων
  // (μηδέν race), κλικ σε φέτα ανοίγει πεδίο, Enter → κλείδωμα + synthetic canvas click που κάνει το commit
  // του grip (hot-grip terminal), κλικ ΕΞΩ από τον τροχό → commit στον κέρσορα. Ανεξάρτητο από το
  // `interactive` gate (στο grip-drag το εργαλείο είναι 'select'). Ίδιος 3D-yield κανόνας.
  //
  // Ο πίνακας αντικατέστησε τρία σχεδόν ταυτόσημα `if`-blocks (2026-07-18, N.0.2/N.18): διέφεραν ΜΟΝΟ σε
  // predicate/config/startKey, οπότε η προσθήκη 4ου (μετακίνηση) με copy-paste θα ήταν sibling clone.
  if (!is3D && activeDrag && getSceneUnits) {
    const variant = GRIP_RING_VARIANTS.find(
      (v) => (dynInput.on || !v.requiresDynInput) && v.match(activeDrag),
    );
    if (variant) {
      return (
        <RadialCommandRing
          config={variant.config}
          placementMode="canvas-click"
          startKey={`${variant.keyPrefix}:${activeDrag.entityId}:${activeDrag.gripIndex}`}
          sceneUnits={getSceneUnits()}
          getCanvasEl={getCanvasEl}
          onDeactivate={unlockGripEndpointLocks}
        />
      );
    }
  }

  // ADR-513 §rotation-ring — ΠΕΡΙΣΤΡΟΦΗ hot-grip (free-rotate): με κέντρο δηλωμένο, δείξε το ΙΔΙΟ
  // «Δαχτυλίδι Εντολών» ως ΕΝΑ πλήκτρο «Γωνία» (όλος ο δίσκος = 1 φέτα) για να πληκτρολογείς γωνία
  // περιστροφής· Enter → synthetic canvas click → `commitFreeRotate` με τη ring-locked γωνία (ΙΔΙΟ
  // typed-angle path, ADR-397 Σ3). Για ΟΛΑ τα περιστρεφόμενα. Ανεξάρτητο από το `interactive` gate
  // (στο grip-drag το εργαλείο είναι 'select'). Ίδιος 3D-yield κανόνας (ΕΝΑ ring ανά view).
  if (dynInput.on && !is3D && rotateFreeActive && getSceneUnits) {
    return (
      <RadialCommandRing
        config={ROTATION_RING_CONFIG}
        placementMode="canvas-click"
        startKey="rotation-ring"
        sceneUnits={getSceneUnits()}
        getCanvasEl={getCanvasEl}
        onDeactivate={RotationRingStore.clearAngle}
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

  // ADR-060 — «Κάθετη Γραμμή»: ΜΟΝΟ ΜΕΤΑ το 1ο κλικ (σημείο εισαγωγής πάνω στην οντότητα, δηλ.
  // `tempPoints.length >= 1`) δείξε το length-only «Δαχτυλίδι Εντολών». Πριν το click-1 (hover/ghost +
  // κυανά face-dims) ΔΕΝ mount-άρεται → ο χρήστης δηλώνει το σημείο εισαγωγής κανονικά με κλικ. Μετά,
  // η διεύθυνση είναι ήδη κλειδωμένη (κάθετος άξονας, `perpendicularAxisLockStore`) οπότε αρκεί το Μήκος:
  // πληκτρολόγηση αριθμού → «Μήκος» wedge → Enter → synthetic canvas click → commit (`resolveLineFamily
  // CommitPoint` → `applyLengthAngleLock`, preview≡commit). Early-return → δεν πέφτει στο legacy overlay.
  if (activeTool === 'line-perpendicular' && tempPoints.length >= 1 && getSceneUnits) {
    return (
      <RadialCommandRing
        config={PERPENDICULAR_LINE_RING_CONFIG}
        startKey={ringStartKey(tempPoints[0], 'line-perp-pending')}
        sceneUnits={getSceneUnits()}
        getCanvasEl={getCanvasEl}
      />
    );
  }

  // ADR-513 §rectangle — parity με τη ΓΡΑΜΜΗ: το «Δαχτυλίδι Εντολών» ορθογωνίου (Πλάτος/Ύψος/Γωνία)
  // δείχνεται **ΠΑΝΤΑ** όσο είναι ενεργό το εργαλείο (ΟΧΙ gate `tempPoints.length>=1`) — αλλιώς πριν το
  // 1ο κλικ πέφταμε στο legacy `<DynamicInputSystem>` και φλασάριζε το παλιό DOM overlay. Πριν το 1ο κλικ →
  // startKey `'rect-pending'` (χωρίς anchor)· μετά → με anchor `tempPoints[0]`. Πληκτρολόγηση → heads-up
  // «Πλάτος», TAB → «Ύψος»/«Γωνία», Enter/κλικ → commit σεβόμενο τα locks (Απόφαση A· preview≡commit μέσω
  // builder που διαβάζει το RectLockStore). `onDeactivate=unlockAll` → επόμενο ορθογώνιο ξεκινά ελεύθερο.
  if (activeTool === 'rectangle' && getSceneUnits) {
    return (
      <RadialCommandRing
        config={RECTANGLE_RING_CONFIG}
        startKey={ringStartKey(tempPoints[0], 'rect-pending')}
        sceneUnits={getSceneUnits()}
        getCanvasEl={getCanvasEl}
        onDeactivate={RectLockStore.unlockAll}
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
