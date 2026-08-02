/**
 * Mouse Up Handler — ADR-065 SRP split
 * Extracted from useCentralizedMouseHandlers.ts
 * Handles: pan cleanup, grip release, drawing clicks, marquee selection, point-click pipeline
 */

import { useCallback } from 'react';
import {
  getPointerSnapshotFromElement,
  getScreenPosFromEvent,
  screenToWorldWithSnapshot,
} from '../../rendering/core/CoordinateTransforms';
import { canvasEventBus } from '../../rendering/canvas/core/CanvasEventSystem';
import { isInDrawingMode } from '../tools/ToolStateManager';
import { UniversalMarqueeSelector } from '../selection/UniversalMarqueeSelection';
import { EventBus } from '../events/EventBus';
import type { CentralizedMouseHandlersProps, MouseHandlerRefs, SnapManagerAPI } from './mouse-handler-types';
// ADR-358 Phase 9D-5b-ii Sub-D — Entity type bridge for performSelection narrow.
import type { Entity } from '../../types/entities';
// ADR-065 SRP split — marquee / point-click selection processing lives in a sibling module.
import { processMarqueeSelection, processSinglePointPick } from './mouse-handler-up-marquee';
// 🔴 ADR-739 §29.11 — η ΤΡΙΤΗ πύλη ως **καθαρή** συνάρτηση, δίπλα στις δύο του §29.9. Ολόκληρο
// το σκεπτικό (Δ1 πλαίσιο δύο κλικ · Δ2 οντότητα από κάτω) ζει στην κεφαλίδα της.
import { shouldCanvasActOnRelease } from './select-gesture-gates';
// ADR-739 §29 — ο ΕΝΑΣ ορισμός του «η λειτουργία πίνακα κατέχει τον καμβά».
import { isCanvasLockedByTableSession } from '../../ui/table-cell-editor/use-table-canvas-lockdown';
// ADR-362 hotfix Round 3 (2026-05-19) — skip upstream click-snap on dim-line-offset
// pick so committed defPoints[2] matches the cursor (not a nearby entity endpoint).
// Round 1+2 gated snap only in the downstream `useDrawingHandlers.onDrawingPoint`,
// but the click world point was already snapped here BEFORE reaching that gate.
import { isDimLineRefPhase } from '../../hooks/dimensions/dim-skip-snap';
import { getActiveDragGrip, isActiveGripAltMove } from './GripDragStore';
// ADR-728 Φ1 — ρητός τερματισμός της αναστολής πλοήγησης όταν το τέλος του pan είναι γνωστό.
import { endNavigationGesture } from '../navigation/NavigationGestureStore';
import { setSnapDrawingMode } from './SnapDrawingModeStore';
import { resolveGripDragSnap } from './grip-drag-snap-resolver';
import { isLineEntity } from '../../types/entities';
// ADR-562 Φ9.2 — commit parity for the dim-grip AutoAlign (WYSIWYG preview ≡ commit).
import { resolveActionAlignmentTracking } from '../../hooks/dimensions/dim-alignment-tracking';
import { toDimensionEntity, getDimGripAlignmentAnchors } from '../../hooks/dimensions/useDimensionGrips';
import { clearGripAlignmentTracking } from './GripAlignmentTrackingStore';
// ADR-357/363 — plain-line grip alignment anchors (commit parity with the live move override).
import { getLineGripAlignmentAnchors } from '../../systems/line/line-grips';
import { resolveBimCursorSnap } from '../../bim/placement/bim-cursor-snap';
import { buildColumnPolarSnapOptions } from '../../bim/columns/column-polar-opts';
import { resolveColumnHeadReferences } from '../../hooks/drawing/column-completion';
import { sceneSnapTargetsStore } from '../../bim/framing/scene-snap-targets';
import { resolveEffectivePreviewCursor } from '../../hooks/drawing/wysiwyg-preview-shared';
import { resolveArmedSnapForCommit } from './resolve-armed-snap-commit';
import { applyBimDrawingConstraint } from '../../hooks/drawing/bim-ortho-reference';
// ADR-363 §neighbor-gap-step — το shift που υπολόγισε το preview (στρογγύλεμα διάκενου προς τη μεριά
// κίνησης, Q κρατημένο)· το commit το εφαρμόζει αυτούσιο στο ελεύθερο ghost → preview ≡ commit.
import { getGapPlacementShift } from './GapStepPlacementStore';
// SSoT sweep — point+vector translate (ADR-090).
import { translatePoint } from '../../rendering/entities/shared/geometry-vector-utils';
import { worldPerPixel } from '../../rendering/utils/viewport-scale';
import { getImmediateTransform } from './ImmediateTransformStore';
import { setColumnFaceAnchor, setColumnGhostStatus, setColumnFaceRotation, setColumnFaceSizing } from './ColumnPlacementGhostStatusStore';
import { columnToolBridgeStore } from '../../ui/ribbon/hooks/bridge/column-tool-bridge-store';
import { resolveSnapConnectorElevationMm } from '../../bim/mep-segments/mep-snap-connector-elevation';
import { LassoStore, computeLassoMode } from './LassoStore';
import { finishZoomWindowOnMouseUp } from '../zoom-window/finish-zoom-window';
// ADR-455 — on-canvas X/Y section-cut handle drag.
import { isAxisCutDragging, endAxisCutDrag } from '../axis-cut/axis-cut-drag-store';
// ADR-507 — «Επιλογή γραμμοσκίασης»: armed hatch-only pick (even-odd SSoT, world-coords).
import { isHatchSelectArmed, runArmedHatchPick } from '../../bim/hatch/hatch-select-mode-store';
// Body-drag (grab body → move; Ctrl+drag → copy) — commit on mouseup.
import { EntityBodyDragStore } from '../drag/EntityBodyDragStore';
import { applyOrthoToDelta } from '../../bim/grips/grip-move-constraints';
// ADR-363 — F9/Q SNAP-MODE step layer for the body-drag COMMIT (WYSIWYG with the live ghost).
import { applyGripStepSnap, isGripStepActive } from '../../bim/grips/grip-step-quantize';

/** Min pointer travel (px) before a body-drag counts as a drag (else it's a click). */
const BODY_DRAG_MIN_PX = 3;

interface MouseUpHandlerDeps {
  props: CentralizedMouseHandlersProps;
  cursor: ReturnType<typeof import('./CursorSystem').useCursor>;
  refs: MouseHandlerRefs;
  snap: SnapManagerAPI;
}

export function useMouseUpHandler({ props, cursor, refs, snap }: MouseUpHandlerDeps) {
  const {
    viewport, onTransformChange, onEntitySelect, hitTestCallback,
    scene, colorLayers, onLayerSelected, onMultiLayerSelected, canvasRef,
    onCanvasClick, activeTool, overlayMode, onEntitiesSelected,
    onUnifiedMarqueeResult, onGripMouseUp,
  } = props;
  const { snapEnabled, findSnapPoint } = snap;

  return useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    cursor.setMouseDown(false);

    // ADR-040 Phase XXII.B — event-time transform (cardinal rule #2): ζωντανή ανάγνωση στην
    // αρχή του handler· όλα τα screenToWorld / commit-parity resolves βλέπουν την ίδια τιμή.
    const transform = getImmediateTransform();

    // ADR-455 — finish a section-cut handle drag; consume the up, skip select/click.
    if (isAxisCutDragging()) {
      endAxisCutDrag();
      return;
    }

    // ADR-374 — ZOOM Window finish: screen rect → world bounds → fit-to-view via EventBus.
    // Εξήχθη σε δικό του module (N.7.1) — η λογική ζει δίπλα στο ZoomWindowStore της.
    if (activeTool === 'zoom-window' && e.button === 0
        && finishZoomWindowOnMouseUp(e.currentTarget as HTMLElement, transform)) {
      return;
    }

    // Pan cleanup
    const panState = refs.panStateRef.current;
    const wasPanning = panState.isPanning;

    if (panState.isPanning) {
      panState.isPanning = false;
      panState.lastMousePos = null;

      if (panState.pendingTransform && onTransformChange) {
        onTransformChange(panState.pendingTransform);
        canvasEventBus.emitTransformChange(panState.pendingTransform, viewport, 'dxf-canvas');
        panState.pendingTransform = null;
      }

      if (panState.animationId) {
        cancelAnimationFrame(panState.animationId);
        panState.animationId = null;
      }

      // ADR-728 Φ1 — το τέλος του pan είναι ΓΝΩΣΤΟ εδώ: τερμάτισε την αναστολή αμέσως,
      // ώστε το snap να ξαναδουλέψει στην πρώτη κίνηση μετά την άφεση αντί να περιμένει
      // ολόκληρο το idle παράθυρο.
      // ⚠️ ΣΕΙΡΑ: ΥΠΟΧΡΕΩΤΙΚΑ **ΜΕΤΑ** το `onTransformChange(pendingTransform)` από πάνω —
      // εκείνη η εγγραφή είναι αλλαγή transform και θα ξαναόπλιζε την αναστολή.
      endNavigationGesture();
    }

    // 🔴 ADR-739 §29.11 — ΤΡΙΤΗ ΠΥΛΗ: ο καμβάς **δεν ερμηνεύει** την απελευθέρωση όσο η
    // λειτουργία πίνακα τον κατέχει. Κλείνει **δύο** ελαττώματα με μία ερώτηση: το πλαίσιο
    // δύο κλικ που ξεκινούσε από κλικ στις ζώνες δείκτη (Δ1) και την επιλογή της οντότητας
    // που βρίσκεται **κάτω** από το κελί (Δ2). Το πλήρες σκεπτικό ζει στην πύλη.
    //
    // ⚠️ ΣΕΙΡΑ: **ΜΕΤΑ** τον καθαρισμό του pan από πάνω. Το pan με μεσαίο/δεξί δουλεύει
    // επίτηδες μέσα στη λειτουργία πίνακα (§29.10), άρα το `mouseup` του **πρέπει** να το
    // τερματίζει — φύλακας πιο πάνω θα άφηνε τον viewer να σέρνει για πάντα.
    if (!shouldCanvasActOnRelease({ lockedByTableSession: isCanvasLockedByTableSession() })) {
      refs.lassoDownRef.current.buttonHeld = false;
      // Πλαίσιο που είχε ξεκινήσει **πριν** ανοίξει η λειτουργία δεν επιτρέπεται να μείνει
      // ζωντανό: το `isSelecting` σβήνει και το hover (`mouse-handler-move`).
      if (cursor.isSelecting) cursor.endSelection();
      return;
    }

    // Body-drag commit (grab body → MOVE; Ctrl+drag → COPY). Runs after pan
    // cleanup and BEFORE grip/hatch/click so it owns the gesture it armed at
    // mousedown. A near-zero displacement is treated as a plain click (clear +
    // fall through to the selection pipeline below); a real drag emits the
    // commit (consumed by useEntityBodyDragCommit) and consumes the mouseup.
    if (EntityBodyDragStore.getActive() && e.button === 0 && !wasPanning) {
      const session = EntityBodyDragStore.getSession();
      EntityBodyDragStore.clear();
      if (session) {
        const bodySnap = getPointerSnapshotFromElement(e.currentTarget as HTMLElement);
        if (bodySnap) {
          let upWorld = screenToWorldWithSnapshot(getScreenPosFromEvent(e, bodySnap), transform, bodySnap);
          // ADR-560 — AutoAlign commit parity: re-resolve the SAME base-point tracking the live ghost
          // used (applyBodyDragAlignmentTracking) so the committed destination == the previewed one
          // (WYSIWYG). Mirror of the dim/line grip commit parity above. Runs BEFORE the ORTHO lock.
          // Step grid engaged (F9+Q) → the grid wins, skip the AutoAlign snap (parity with the ghost).
          const bodyTracking = isGripStepActive() ? null : resolveActionAlignmentTracking(
            upWorld, [session.anchor], transform.scale,
            (scene?.entities ?? null) as unknown as readonly Entity[] | null,
            new Set(session.entityIds), // ADR-557 — no self-OTRACK to the dragged selection.
          );
          if (bodyTracking) upWorld = bodyTracking.point;
          // ORTHO (F8) + F9/Q SNAP-MODE step — SAME transform as the live ghost (`useEntityBodyDragPreview`) → WYSIWYG.
          const delta = applyGripStepSnap(applyOrthoToDelta({ x: upWorld.x - session.anchor.x, y: upWorld.y - session.anchor.y }));
          const movedPx = Math.hypot(delta.x, delta.y) * transform.scale;
          if (movedPx >= BODY_DRAG_MIN_PX && session.entityIds.length > 0) {
            EventBus.emit('entity-body-drag:commit', {
              entityIds: [...session.entityIds],
              delta,
              copy: session.copy,
            });
            cursor.endSelection();
            return;
          }
        }
      }
      // Near-zero → fall through to the normal click/selection pipeline below.
    }

    // ADR-507 — «Επιλογή γραμμοσκίασης» (armed): authoritative hatch-only pick. Τρέχει
    // ΠΡΙΝ από grips / drawing-click / γενικό entity-select ώστε (α) να μη σχεδιαστεί νέα
    // γραμμοσκίαση με ενεργό το hatch tool και (β) να μην «κλαπεί» από υπερκείμενες
    // γραμμές/τοίχους. Reuse του ΙΔΙΟΥ spatial-index pick SSoT με τη normal selection,
    // απλώς με `typeFilter:['hatch']` + `replaceEntitySelection` (onEntitiesSelected).
    // One-shot: disarm σε κάθε περίπτωση, consume το click.
    if (isHatchSelectArmed() && e.button === 0 && !wasPanning) {
      // Θέση κλικ ΑΠΕΥΘΕΙΑΣ από το event (ίδιο με το onCanvasClick). Pick→select→finalize
      // μέσω του ΚΟΙΝΟΥ `runArmedHatchPick` SSoT (ίδιο με το useCanvasClickHandler).
      const pickSnap = getPointerSnapshotFromElement(e.currentTarget as HTMLElement);
      if (pickSnap && scene && onEntitiesSelected) {
        const wp = screenToWorldWithSnapshot(getScreenPosFromEvent(e, pickSnap), transform, pickSnap);
        runArmedHatchPick(wp, (scene.entities ?? []) as unknown as Entity[], onEntitiesSelected);
      }
      return; // πάντα consume — ΠΟΤΕ δημιουργία/grip/select όσο armed
    }

    // Grip drag-release with snap
    if (e.button === 0 && onGripMouseUp) {
      const upSnap = getPointerSnapshotFromElement(e.currentTarget as HTMLElement);
      if (upSnap) {
        const upScreenPos = getScreenPosFromEvent(e, upSnap);
        let upWorldPos = screenToWorldWithSnapshot(upScreenPos, transform, upSnap);
        // ADR-398 — raw cursor (pre center-snap) for the column corner projection,
        // so the committed delta matches the preview (which used the raw cursor).
        const rawUpWorldPos = upWorldPos;

        // ADR-560 §grip-OSNAP-unified — commit parity: ΙΔΙΑ κλήση με το move handler (ίδιος
        // resolver, ίδιο RAW cursor) ώστε η δεσμευμένη θέση να ισούται ΑΚΡΙΒΩΣ με το ghost που
        // έδειξε το preview (WYSIWYG). Καλύπτει τοίχο/κολόνα/δοκό/θεμέλιο ενιαία, και δέχεται
        // ΜΟΝΟ ορατές έλξεις — διορθώνει το παλιό commit gap όπου το generic cursor-snap κούμπωνε
        // ακόμη και σε σιωπηλό grid (preview≠commit).
        if (snapEnabled && findSnapPoint) {
          const gripSnap = resolveGripDragSnap(
            (scene?.entities ?? null) as unknown as readonly Entity[] | null,
            getActiveDragGrip(),
            rawUpWorldPos,
            findSnapPoint,
            isActiveGripAltMove(),
          );
          if (gripSnap) upWorldPos = gripSnap.moveWorldPos;
        }

        // ADR-562 Φ9.2 / ADR-357 — commit parity for the dim-grip AutoAlign. SAME resolver
        // + inputs as the live move override, applied to `upWorldPos` so the committed
        // defPoint lands EXACTLY where the ghost trace snapped (WYSIWYG). Runs after the
        // OSNAP/face/corner snaps and independently of the OSNAP toggle (matches the move
        // handler). Traces are cleared once consumed (belt-and-suspenders vs resetToIdle).
        const dimGrip = getActiveDragGrip();
        if (dimGrip?.dimGripKind) {
          const dimEntity = toDimensionEntity(scene?.entities?.find(en => en.id === dimGrip.entityId));
          const anchors = dimEntity ? getDimGripAlignmentAnchors(dimGrip.dimGripKind, dimEntity) : null;
          if (anchors) {
            const dimTracking = resolveActionAlignmentTracking(
              upWorldPos, anchors, transform.scale,
              (scene?.entities ?? null) as unknown as readonly Entity[] | null,
              new Set([dimGrip.entityId]),
            );
            if (dimTracking) upWorldPos = dimTracking.point;
          }
          clearGripAlignmentTracking();
        } else if (dimGrip && (isActiveGripAltMove() || dimGrip.movesEntity === true) && dimGrip.dragAnchor) {
          // ADR-557/560 — commit parity for ANY whole-entity MOVE (Alt move-from-base OR a
          // `movesEntity` centre grip: text/mtext/column/group hot-grip move, line MOVE-cross). SAME
          // base-point resolve as the live ghost (`grip-drag-alignment-tracking`) so the committed
          // position lands EXACTLY where the cyan/Polar trace snapped (WYSIWYG). Fixes the text move
          // that previously fell through to the line-only branch → no snap. Traces cleared once consumed.
          const bpTracking = resolveActionAlignmentTracking(
            upWorldPos, [dimGrip.dragAnchor], transform.scale,
            (scene?.entities ?? null) as unknown as readonly Entity[] | null,
            new Set([dimGrip.entityId]),
          );
          if (bpTracking) upWorldPos = bpTracking.point;
          clearGripAlignmentTracking();
        } else if (dimGrip) {
          // ADR-357/363 — commit parity for a plain-line grip: SAME resolver + anchors as the
          // live move override so the committed endpoint / whole line lands EXACTLY where the
          // ghost trace snapped (WYSIWYG). Rotation handle → null anchors → raw cursor (its own
          // rotate-tracking already committed via the ghost). Traces cleared once consumed.
          const lineEnt = scene?.entities?.find(en => en.id === dimGrip.entityId) as unknown as Entity | undefined;
          const anchors = lineEnt && isLineEntity(lineEnt) && dimGrip.gripIndex !== undefined
            ? getLineGripAlignmentAnchors(dimGrip.gripIndex, dimGrip.lineGripKind, lineEnt, dimGrip.dragAnchor)
            : null;
          if (anchors) {
            const lineTracking = resolveActionAlignmentTracking(
              upWorldPos, anchors, transform.scale,
              (scene?.entities ?? null) as unknown as readonly Entity[] | null,
              new Set([dimGrip.entityId]),
            );
            if (lineTracking) upWorldPos = lineTracking.point;
            clearGripAlignmentTracking();
          }
        }

        if (onGripMouseUp(upWorldPos)) {
          cursor.endSelection();
          return;
        }
      }
    }

    // Clear lasso button-held state on every mouseup.
    refs.lassoDownRef.current.buttonHeld = false;

    // Drawing tools click (left button only, not after pan)
    const isLeftClick = e.button === 0;

    if (onCanvasClick && isLeftClick && !cursor.isSelecting && !wasPanning && !LassoStore.getIsLasso()) {
      const clickSnap = getPointerSnapshotFromElement(e.currentTarget as HTMLElement);
      if (!clickSnap) return;

      const freshScreenPos = getScreenPosFromEvent(e, clickSnap);
      let worldPoint = screenToWorldWithSnapshot(freshScreenPos, transform, clickSnap);
      // ADR-408 Φ-B1 — connector-mate: when a click snaps to an MEP connector, the
      // connector's TRUE 3D elevation (mm) is captured here and threaded to the tool
      // so a pipe/duct endpoint inherits it (Revit "Connect To"). null = free point.
      let connectorZmm: number | null = null;

      // ADR-362 Round-3 hotfix: linear/aligned dim-line-offset pick is a free
      // position — AutoCAD disables OSNAP for it. Without this gate the click
      // gets snapped to a nearby entity endpoint and the committed dim jumps
      // to a wrong Y. Downstream `useDrawingHandlers` also gates snap on the
      // same predicate (symmetric with `drawing-hover-handler` on the hover side).
      const dimLineRefPhase = isDimLineRefPhase();
      // ADR-189 — publish drawing mode so the click `findSnapPoint` applies the same
      // intersection-only guide policy as the hover preview (Giorgio: σχεδιασμός → μόνο ✕).
      setSnapDrawingMode(isInDrawingMode(activeTool, overlayMode));
      if (snapEnabled && findSnapPoint && !dimLineRefPhase) {
        // ADR-514 Φ2 — «Ένας Εγκέφαλος Έλξης»: το commit καλεί τον ΕΝΑ unified resolver
        // (`resolveBimCursorSnap`, toolKind:'column') αντί για τον column-specific resolver απευθείας.
        // ΙΔΙΟ σημείο εισόδου με το preview (`generateColumnPreview`) → preview ≡ commit by construction.
        // Ο εγκέφαλος delegate-άρει στον ΙΔΙΟ `resolveColumnFaceSnapFromTargets` + ΙΔΙΟΙ pre-collected
        // στόχοι (`sceneSnapTargetsStore`) + ΙΔΙΟΣ effective cursor (`resolveEffectivePreviewCursor` =
        // ImmediateSnap = ό,τι έδειξε ο scheduler: corner-projection / BIM χαρακτηριστικό / grid).
        // ⚠️ ADR-514 §2 — ο effectiveCursor είναι ΗΔΗ OSNAP-snapped κεντρικά εδώ → ΧΩΡΙΣ findSnapPoint
        // ώστε ο εγκέφαλος να ΜΗΝ ξανα-snapάρει (double-snap). Set & την auto λαβή/status που διαβάζει
        // το `useColumnTool` (center-anchor όταν status==='beam').
        const colHandle = activeTool === 'column' ? columnToolBridgeStore.get() : null;
        if (colHandle?.isActive) {
          // ADR-363 §column-ortho — ΟΡΘΟ(F8)/POLAR(F10)/step(F9+Q) ΜΕΤΑ το OSNAP, ώστε το directional
          // lock να ΥΠΕΡΙΣΧΥΕΙ της έλξης — ΙΔΙΑ σειρά με το preview (`generateColumnPreview`: OSNAP →
          // constraint → face-snap) → preview ≡ commit. No-op πριν την 1η κολόνα ή στη rotation phase.
          const snappedCursor = resolveEffectivePreviewCursor(worldPoint);
          const effectiveCursor = applyBimDrawingConstraint('column', snappedCursor, worldPerPixel(getImmediateTransform().scale));
          // ADR-398 §3.13 — Polar Magnet opts (ίδια με το ghost → preview ≡ commit).
          // §3.19 — `colHandle.kind` → circle radius (tangent candidates μόνο σε κυκλική).
          const polarOpts = buildColumnPolarSnapOptions(colHandle.overrides, colHandle.getSceneUnits(), colHandle.kind);
          const snap = resolveBimCursorSnap({
            toolKind: 'column',
            cursor: effectiveCursor,
            targets: sceneSnapTargetsStore.get(),
            sceneUnits: colHandle.getSceneUnits(),
            columnOpts: polarOpts,
            // ADR-523 — Τ-κεφαλή multi-reference (ίδιες refs με το ghost → preview ≡ commit).
            columnHead: resolveColumnHeadReferences(colHandle.kind, colHandle.overrides, colHandle.getSceneUnits()),
            lShapeGhost: colHandle.kind === 'L-shape', // ADR-525 — corner-gap auto-junction tier
          });
          if (snap.kind === 'column-placement') {
            worldPoint = snap.placement.position;
            setColumnFaceAnchor(snap.placement.anchor);
            setColumnFaceRotation(snap.placement.rotation); // §3.10b flush-to-edge γωνία (0 axis-aligned)
            setColumnGhostStatus(snap.placement.status);
            setColumnFaceSizing(snap.placement.sizing ?? null); // ADR-525 — L auto-διαστασιολόγηση (single-click)
          } else {
            setColumnFaceAnchor(null);
            setColumnFaceRotation(null);
            setColumnGhostStatus('neutral');
            setColumnFaceSizing(null);
            // ADR-363 §neighbor-gap-step — ελεύθερο ghost: εφάρμοσε το ΙΔΙΟ shift που υπολόγισε το
            // preview (στρογγύλεμα διάκενου προς τη μεριά κίνησης, Q κρατημένο). {0,0} όταν όχι-Q ή
            // χωρίς γείτονα → no-op = ακριβώς η προηγούμενη συμπεριφορά. preview ≡ commit.
            const gapShift = getGapPlacementShift();
            worldPoint = translatePoint(snap.point, gapShift); // όπως το ghost
          }
        } else if (activeTool === 'beam') {
          // preview ≡ commit (ADR-514 §2 / Giorgio 2026-06-25) — το beam tool, ΟΠΩΣ το column,
          // ΔΕΝ κάνει `findSnapPoint` εδώ (double-snap): ο `resolveStartAnchor` (use-beam-commit)
          // καλεί τον ΙΔΙΟ `resolveBimCursorSnap` με τον effectiveCursor (ImmediateSnap = ό,τι έδειξε
          // ο scheduler/ghost — corner-projection / BIM χαρακτηριστικό / grid). Με το `findSnapPoint`
          // το commit ΞΑΝΑ-snapάριζε σε διαφορετικό σημείο (π.χ. παρειά γειτονικής κολόνας) → ο cursor
          // άλλαζε μέλος/third στο `spanJustification` → το justified auto-span (north-flush) έβγαινε
          // **centered** (preview≠commit). Με τον ΙΔΙΟ effectiveCursor → north-flush by construction.
          worldPoint = resolveEffectivePreviewCursor(worldPoint);
        } else {
          const snapResult = resolveArmedSnapForCommit(worldPoint, findSnapPoint); // ADR-514 §2 γεν. — armed snap αντί για 2η findSnapPoint (SSoT helper)
          if (snapResult && snapResult.found && snapResult.snappedPoint) {
            worldPoint = snapResult.snappedPoint;
            // ADR-408 Φ-B1 (SSoT) — recover the connector's 3D elevation from the
            // snapped host so the segment tool can mate the endpoint in xyz. Shared
            // resolver (2D + 3D); z is resolved per host type (segment per-endpoint,
            // manifold/fixture mounting datum). Harmless to non-segment tools.
            if (scene) {
              const zMm = resolveSnapConnectorElevationMm(
                snapResult.snapPoint,
                worldPoint.x,
                worldPoint.y,
                (id) => scene.entities?.find((en) => en.id === id) as Entity | undefined,
              );
              if (zMm !== null) connectorZmm = zMm;
            }
          }
        }
      }

      const clickPoint = connectorZmm !== null
        ? { x: worldPoint.x, y: worldPoint.y, z: connectorZmm }
        : worldPoint;
      // ADR-581 — altKey/ctrlKey για το «Αντιγραφή Ιδιοτήτων» πινέλο (σταγονόμετρο/σύριγγα).
      onCanvasClick(clickPoint, e.shiftKey, e.altKey, e.ctrlKey || e.metaKey);
    }

    // Lasso selection (button-held drag → free-form polygon).
    // MUST run before the two-click marquee block — mutually exclusive.
    if (LassoStore.getIsLasso()) {
      const finalLasso = LassoStore.endLasso();
      const lassoPath = finalLasso.lassoPath as import('../../rendering/types/Types').Point2D[];

      if (lassoPath.length >= 3) {
        const canvas = canvasRef?.current ?? null;
        const lassoSnap = getPointerSnapshotFromElement(canvas);
        if (lassoSnap) {
          const lassoMode = computeLassoMode(lassoPath);
          const result = UniversalMarqueeSelector.performLassoSelection(
            lassoPath,
            lassoMode,
            transform,
            lassoSnap.rect,
            {
              colorLayers: colorLayers ?? [],
              entities: (scene?.entities ?? []) as unknown as Entity[],
              enableDebugLogs: false,
            },
          );

          if (result.selectedIds.length > 0) {
            const { layerIds, overlayIds, entityIds } = result.breakdown ?? {};
            const allLayerIds = [...(layerIds ?? []), ...(overlayIds ?? [])];

            if (onUnifiedMarqueeResult) {
              onUnifiedMarqueeResult({ layerIds: allLayerIds, entityIds: entityIds ?? [], subtract: e.shiftKey });
            } else {
              if (allLayerIds.length > 0 && onMultiLayerSelected) onMultiLayerSelected(allLayerIds);
              if ((entityIds ?? []).length > 0 && onEntitiesSelected) onEntitiesSelected(entityIds!);
            }
          } else if (onCanvasClick) {
            // Empty lasso on empty space → deselect (same as empty marquee).
            const emptySnap = getPointerSnapshotFromElement(e.currentTarget as HTMLElement);
            if (emptySnap) {
              const emptyScreenPos = getScreenPosFromEvent(e, emptySnap);
              onCanvasClick(screenToWorldWithSnapshot(emptyScreenPos, transform, emptySnap), e.shiftKey, e.altKey, e.ctrlKey || e.metaKey);
            }
          }
        }
      }
      return;
    }

    // Οι δύο κλάδοι της **ίδιας** απελευθέρωσης — με πλαίσιο ή χωρίς — μοιράζονται ένα και
    // μόνο συμφραζόμενο: δύο ταυτόσημα literal 15 πεδίων θα ήταν διπλότυπο που αποκλίνει στην
    // πρώτη προσθήκη πεδίου (και μόνο ο ένας κλάδος θα το έπαιρνε).
    const selectionCtx = {
      cursor, transform, viewport, canvasRef, colorLayers, scene,
      hitTestCallback, onEntitySelect, onCanvasClick, onLayerSelected,
      onMultiLayerSelected, onEntitiesSelected, onUnifiedMarqueeResult,
      activeTool, overlayMode,
    };
    // Marquee selection processing
    if (cursor.isSelecting && cursor.selectionStart && cursor.position) {
      processMarqueeSelection(e, selectionCtx);
      cursor.endSelection();
    } else {
      // Σκέτο κλικ χωρίς πλαίσιο — ο ΑΛΛΟΣ κλάδος του ίδιου συμβάντος, εξηγμένος στο αδελφό
      // module μαζί με το marquee (N.7.1· δες την κεφαλίδα του `processSinglePointPick`).
      processSinglePointPick(e, selectionCtx, { wasPanning });
    }
  }, [cursor, onTransformChange, viewport, hitTestCallback, scene, onEntitySelect, colorLayers, onLayerSelected, onMultiLayerSelected, canvasRef, onCanvasClick, activeTool, overlayMode, snapEnabled, findSnapPoint, onGripMouseUp, onEntitiesSelected, onUnifiedMarqueeResult, refs]);
}
