/**
 * USE ENTITY BODY-DRAG PREVIEW — ADR (Entity Body-Drag: move / Ctrl-copy)
 *
 * Live ghost overlay for the body-drag gesture (grab an entity's body and drag
 * to MOVE, or Ctrl+drag to COPY). Subscribes to {@link EntityBodyDragStore}
 * (LOW-freq — one arm/clear per drag) for activation, then reads the anchor +
 * entity ids from the store and the live cursor from the frame to draw
 * full-fidelity translated copies at the destination.
 *
 * Pattern: identical to {@link useStretchPreview} / {@link useMovePreview}
 * (ADR-040 micro-leaf — RAF-driven via `useCanvasGhostPreview`, zero React
 * re-renders on cursor move). The WYSIWYG copies render through the REAL entity
 * renderer (`drawRealEntityPreview`) — the same SSoT as the Move tool, so the
 * preview cannot visually diverge from the committed result.
 *
 * @module hooks/tools/useEntityBodyDragPreview
 */

import { useCallback, useRef, useSyncExternalStore } from 'react';
import type { Point2D, ViewTransform } from '../../rendering/types/Types';
import type { AnySceneEntity, Entity } from '../../types/entities';
import type { DxfEntityUnion } from '../../canvas-v2/dxf-canvas/dxf-types';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import { EntityBodyDragStore } from '../../systems/drag/EntityBodyDragStore';
import { applyEntityPreview, makeTranslationPreview } from '../../rendering/ghost';
// ADR-449 — LIVE finish-skin (σοβάς) preview during body-drag MOVE, reusing the SAME SSoT helpers
// as the grip-resize path so the moving ghost + plaster silhouette cannot diverge between gestures.
import {
  drawMemberBodyGhostWithJoinMiter,
  drawStructuralFinishSkinPreviewForSwaps,
  isStructuralFinishMember,
} from './grip-ghost-preview-draw-helpers';
import { useBimPreviewRenderer } from './useBimPreviewRenderer';
import { useLevelLayersById } from './useLevelLayersById';
// ORTHO (F8) axis-lock — shared SSoT with the Move ghost (no-op when OFF).
import { applyOrthoToDelta } from '../../bim/grips/grip-move-constraints';
// Live distance readout pill — same Revit-grade pill as Move / grip drag.
import { drawDimPill } from '../../bim/labels/bim-dim-labels';
import { formatMoveDistance, moveReadoutMid, sceneDistanceToMeters } from '../../bim/labels/move-readout';
import { resolveSceneUnits } from '../../utils/scene-units';
// ADR-560/572 — cyan AutoAlign traces RESOLVED-IN-DRAW (mirror useMovePreview, self-contained).
// Το tracking υπολογίζεται ΤΟΠΙΚΑ εδώ ανά frame από το ΙΔΙΟ SSoT resolve (`resolveActionAlignmentTracking`)
// αντί να διαβάζεται από το cross-tick `GripAlignmentTrackingStore` → μηδέν timing-skew (τα ίχνη δεν «χάνονται»).
import { paintGripAlignmentTracking, resolveActionAlignmentTracking } from '../dimensions/dim-alignment-tracking';
// ADR-508 §neighbor-clearance — κυανές listening dims στη μετακίνηση (twin του placement ghost).
import { resolveMoveClearanceForSelection } from '../../bim/framing/move-clearance-dims';
import { paintGhostFaceDimensions } from '../../canvas-v2/preview-canvas/ghost-face-dim-paint';
import { worldPerPixel } from '../../rendering/utils/viewport-scale';
import { useCanvasGhostPreview } from './useCanvasGhostPreview';
import type { GhostDrawFrame } from '../../systems/preview/ghost-preview-frame';
import type { useLevels } from '../../systems/levels';

// ── Types ─────────────────────────────────────────────────────────────────────

type LevelManagerLike = Pick<ReturnType<typeof useLevels>, 'getLevelScene' | 'currentLevelId'>;

export interface UseEntityBodyDragPreviewProps {
  levelManager: LevelManagerLike;
  transform: ViewTransform;
  getCanvas: () => HTMLCanvasElement | null;
  getViewportElement?: () => HTMLElement | null;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useEntityBodyDragPreview(props: UseEntityBodyDragPreviewProps): void {
  const { levelManager, transform, getCanvas, getViewportElement } = props;

  const active = useSyncExternalStore(
    EntityBodyDragStore.subscribe,
    () => EntityBodyDragStore.getActive(),
  );

  // O(1) entity lookup memoised on scene array identity (rebuilt only when scene swaps).
  const entityMapRef = useRef<Map<string, AnySceneEntity>>(new Map());
  const entityArrayRef = useRef<readonly AnySceneEntity[] | null>(null);

  const getEntity = useCallback((id: string): AnySceneEntity | null => {
    if (!levelManager.currentLevelId) return null;
    const scene = levelManager.getLevelScene(levelManager.currentLevelId);
    if (!scene?.entities) return null;
    if (scene.entities !== entityArrayRef.current) {
      entityArrayRef.current = scene.entities;
      entityMapRef.current = new Map(scene.entities.map(e => [e.id, e]));
    }
    return entityMapRef.current.get(id) ?? null;
  }, [levelManager]);

  // ADR-550 — lazy real-entity renderer + level layer-table getter (shared SSoT hooks).
  const getBimPreview = useBimPreviewRenderer();
  const getLayersById = useLevelLayersById(levelManager);

  const draw = useCallback(({ ctx, effectiveCursor, viewport, transform: t }: GhostDrawFrame) => {
    const session = EntityBodyDragStore.getSession();
    if (!session || !effectiveCursor) return;
    const { anchor, entityIds, copy } = session;

    const toScreen = (p: Point2D) => CoordinateTransforms.worldToScreen(p, t, viewport);

    // ORTHO (F8): lock the destination to the H/V axis from the anchor (no-op when OFF).
    const orthoDelta = applyOrthoToDelta({ x: effectiveCursor.x - anchor.x, y: effectiveCursor.y - anchor.y });
    const orthoDestination: Point2D = { x: anchor.x + orthoDelta.x, y: anchor.y + orthoDelta.y };

    if (Math.abs(orthoDelta.x) < 0.001 && Math.abs(orthoDelta.y) < 0.001) return;

    const scene = levelManager.currentLevelId ? levelManager.getLevelScene(levelManager.currentLevelId) : null;
    const sceneUnits = resolveSceneUnits(scene);

    // ADR-560/572 — cyan AutoAlign traces RESOLVED-IN-DRAW (mirror useMovePreview): το ΙΔΙΟ SSoT resolve
    // τρέχει ΤΟΠΙΚΑ ανά frame πάνω στο ORTHO-locked destination με anchor την αρχή του drag → self-contained,
    // ΜΗΔΕΝ εξάρτηση από το cross-tick `GripAlignmentTrackingStore` (τέλος του timing-skew όπου τα ίχνη
    // «χάνονταν»). Το resolved point τρέφει ΚΑΙ τη γεωμετρία του ghost ΚΑΙ τα ίχνη → WYSIWYG (ο
    // mouse-handler-up κάνει το ΙΔΙΟ resolve στο commit). Null όταν δεν κουμπώνει → διακριτική πινακίδα.
    const tracking = resolveActionAlignmentTracking(
      orthoDestination, [anchor], t.scale, (scene?.entities ?? null) as unknown as readonly Entity[] | null,
    );
    const destination: Point2D = tracking ? tracking.point : orthoDestination;
    const delta: Point2D = { x: destination.x - anchor.x, y: destination.y - anchor.y };
    const anchorPt = toScreen(anchor);
    const cursorPt = toScreen(destination);

    // ADR-508 §neighbor-clearance — κυανές listening dims (ΕΝΑΣ κοινός entry point με το Move tool·
    // self-excluded). Υπολογίζονται ΕΔΩ ώστε να «σβήνουν» την πινακίδα όταν υπάρχουν. Paint στο τέλος.
    const clearanceDims = resolveMoveClearanceForSelection(
      (id) => getEntity(id) as unknown as Entity | null,
      entityIds, delta, scene?.entities ?? [], sceneUnits, worldPerPixel(t.scale),
    );

    if (tracking) {
      paintGripAlignmentTracking(
        ctx, tracking, t, viewport, (d) => sceneDistanceToMeters(d, sceneUnits) * 1000,
      );
    } else if (!clearanceDims) {
      // Χωρίς κούμπωμα ΚΑΙ χωρίς κυανές → μικρή διακριτική ένδειξη απόστασης (anchor → destination).
      const meters = sceneDistanceToMeters(Math.hypot(delta.x, delta.y), sceneUnits);
      const readoutMid = moveReadoutMid(anchorPt, cursorPt);
      drawDimPill(ctx, [formatMoveDistance(meters)], readoutMid.x, readoutMid.y);
    }

    // WYSIWYG real copies at the destination (full fidelity, byte-identical to commit).
    ctx.save();
    const bimPreview = getBimPreview(ctx);
    const layers = getLayersById();
    const sceneEntities = scene?.entities ?? [];
    // ADR-449 — accumulate every moved member ghost (+ its mitered wall neighbours) so the
    // finish-skin silhouette re-forms ONCE around all of them (single unified pass below).
    const finishSwaps = new Map<string, { readonly id: string }>();
    let hasStructuralMember = false;
    for (const id of entityIds) {
      const entity = getEntity(id);
      if (!entity) continue;
      const preview = makeTranslationPreview(id, delta);
      const transformed = applyEntityPreview(entity as unknown as DxfEntityUnion, preview);
      // Draw the member body ghost with its LIVE wall join-miter (SHARED SSoT with grip-resize).
      const { ghost, neighbours } = drawMemberBodyGhostWithJoinMiter(
        bimPreview, transformed, sceneEntities, sceneUnits, layers, t, viewport,
      );
      finishSwaps.set(ghost.id, ghost);
      for (const n of neighbours) finishSwaps.set(n.id, n);
      if (isStructuralFinishMember((transformed as { type?: string }).type)) hasStructuralMember = true;
    }
    ctx.restore();

    // ADR-449 — LIVE σοβάς: after the member body ghosts, re-draw the merged finish-skin silhouette
    // for the preview scene (all dragged members + mitered neighbours at their new positions) via the
    // SAME committed scene-pass as the grip-resize path. No-op when «Σοβατισμένη όψη» is off (internal
    // per-element gate). Mirrors the committed order (plaster after body).
    if (scene && hasStructuralMember) {
      drawStructuralFinishSkinPreviewForSwaps(ctx, sceneEntities, finishSwaps, t, viewport);
    }

    // Copy cue — small green «+» near the cursor (AutoCAD/Revit copy affordance).
    if (copy) {
      ctx.save();
      ctx.strokeStyle = '#22C55E';
      ctx.lineWidth = 2;
      const cx = cursorPt.x + 14;
      const cy = cursorPt.y - 14;
      ctx.beginPath();
      ctx.moveTo(cx - 5, cy); ctx.lineTo(cx + 5, cy);
      ctx.moveTo(cx, cy - 5); ctx.lineTo(cx, cy + 5);
      ctx.stroke();
      ctx.restore();
    }

    // ADR-508 §neighbor-clearance — paint των κυανών ΜΕΤΑ το ghost (convention: listening-dim overlay).
    if (clearanceDims) paintGhostFaceDimensions(ctx, clearanceDims, t, viewport);

    // 🔬🔬🔬 TEMP DIAGNOSTIC (listening-dims στη μετακίνηση — ΝΑ ΑΦΑΙΡΕΘΕΙ) — on-screen HUD.
    {
      ctx.save();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      ctx.font = 'bold 15px monospace';
      ctx.fillStyle = clearanceDims ? '#29B6F6' : '#FF2222';
      ctx.fillText(`CLEARANCE drag: dims=${clearanceDims ? clearanceDims.dims.length : 'NULL'}  scene=${scene?.entities?.length ?? 0}`, 20, 110);
      ctx.restore();
    }
  }, [getEntity, getBimPreview, getLayersById, levelManager]);

  useCanvasGhostPreview({
    isActive: active,
    getCanvas,
    getViewportElement,
    transform,
    draw,
  });
}
