/**
 * ADR-183: Unified Grip System — Grip Registry
 *
 * Collects ALL grips (DXF + overlay) into a single UnifiedGripInfo[] array.
 * Pure computation — no React state, no side effects.
 *
 * @see unified-grip-types.ts — type definitions
 * @see useDxfGripInteraction.ts — computeDxfEntityGrips (DXF entity → grips)
 * @see entity-conversion.ts — findOverlayEdgeForGrip (overlay edge detection)
 */

import { useMemo } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import type { DxfScene, DxfEntityUnion } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { Overlay } from '../../overlays/types';
import type { GripInfo } from '../useGripMovement';
import { computeDxfEntityGrips } from '../grip-computation';
import { calculateMidpoint } from '../../rendering/entities/shared/geometry-utils';
import type { UnifiedGripInfo } from './unified-grip-types';
import { useGripStyle } from '../../stores/GripStyleStore';
import { isGripObjLimitExceeded } from './grip-obj-limit';
// ADR-559 — the ONE grip-type display predicate, shared with the VISIBLE path
// (BaseEntityRenderer.renderPhaseGrips) so hidden grips are also non-pickable.
import { isGripTypeVisible } from './grip-type-visibility';
// ADR-559 §multi-select — with ≥2 objects selected, suppress per-object MOVE +
// ROTATION glyphs on BOTH paths (visible ≡ pickable). Shared predicate SSoT.
import { shouldHideDataGripForSelection } from './transform-glyph-visibility';
// ADR-397 Φ2 — directional move: attach the entity's local frame + mm scale to its
// MOVE grip so the click handler can move along a typed distance without the scene.
import { resolveMoveGlyphFrame } from '../../bim/grips/move-glyph-frame';
import { hotGripKindOf, hotGripOpForKind } from './wall-hot-grip-fsm';
import { mmScaleFor } from '../../utils/scene-units';
import type { Entity, GroupEntity } from '../../types/entities';
import type { SceneUnits } from '../../utils/scene-units';
// ADR-575 §8 — the whole-group gizmo (move cross + rotation handle) + its bbox SSoT.
import { getGroupGizmoGrips } from '../../systems/group/group-gizmo-grips';
import { computeGroupSelectionBounds } from '../../systems/group/group-selection-bounds';

// ============================================================================
// PURE: Wrap DXF GripInfo → UnifiedGripInfo
// ============================================================================

// ADR-602 (ADR-587 Φ6) — exported (pure mapper, mirror των exported sibling mappers
// `toUnifiedGrip`/`toRawDxfUnifiedGrip`) ώστε το forwarding να είναι unit-testable.
export function wrapDxfGrip(grip: GripInfo): UnifiedGripInfo {
  return {
    id: `dxf_${grip.entityId}_${grip.gripIndex}`,
    source: 'dxf',
    entityId: grip.entityId,
    gripIndex: grip.gripIndex,
    // 'corner' → 'vertex' (a corner IS a vertex of the entity outline, NOT a midpoint).
    // Previously bundled με 'midpoint' → 'edge' → filtered by `!showMidpoints` even
    // όταν ο χρήστης ήθελε corners visible. ADR-363 Phase 1C-bis wall corner grips
    // πρέπει να φαίνονται ανεξάρτητα από το showMidpoints preference. Direct-
    // manipulation principle: pickable corners are primary editing affordances.
    type: grip.type === 'corner' ? 'vertex' : grip.type === 'midpoint' ? 'edge' : grip.type,
    position: grip.position,
    movesEntity: grip.movesEntity,
    edgeVertexIndices: grip.edgeVertexIndices,
    // ADR-602 (ADR-587 Φ6) Stage 5 — the ONE tagged grip discriminator SSoT
    // (GripInfo→UnifiedGripInfo). The 31 legacy `xxxGripKind` forwards were deleted;
    // every consumer now reads via `gripKindOf(g, '<entity.type>')`.
    ...(grip.gripKind ? { gripKind: grip.gripKind } : {}),
    // ADR-637 Phase 4-A — forward the rest-landing target id (stair-rest-landing-* grips).
    ...(grip.landingId ? { landingId: grip.landingId } : {}),
  };
}

// ============================================================================
// PURE: Compute overlay grips (vertex + edge midpoints)
// ============================================================================

/**
 * Generate UnifiedGripInfo[] for a single overlay polygon.
 * Vertex grips at each corner, edge midpoints between consecutive vertices.
 */
export function computeOverlayGrips(overlayId: string, polygon: Array<[number, number]>): UnifiedGripInfo[] {
  if (!polygon || polygon.length < 2) return [];

  const grips: UnifiedGripInfo[] = [];

  // Vertex grips
  for (let i = 0; i < polygon.length; i++) {
    grips.push({
      id: `overlay_${overlayId}_v${i}`,
      source: 'overlay',
      overlayId,
      gripIndex: i,
      type: 'vertex',
      position: { x: polygon[i][0], y: polygon[i][1] },
      movesEntity: false,
    });
  }

  // Edge midpoint grips (between consecutive vertices, polygon is closed)
  for (let i = 0; i < polygon.length; i++) {
    const next = (i + 1) % polygon.length;
    const p1: Point2D = { x: polygon[i][0], y: polygon[i][1] };
    const p2: Point2D = { x: polygon[next][0], y: polygon[next][1] };
    const mid = calculateMidpoint(p1, p2);

    grips.push({
      id: `overlay_${overlayId}_e${i}`,
      source: 'overlay',
      overlayId,
      gripIndex: polygon.length + i, // offset past vertex grips
      type: 'edge',
      position: mid,
      movesEntity: false,
      edgeInsertIndex: i + 1, // vertex insertion index
    });
  }

  return grips;
}

// ============================================================================
// HOOK: Memoized collection of all grips
// ============================================================================

interface UseGripRegistryParams {
  /** DXF scene (for entity geometry) */
  dxfScene: DxfScene | null;
  /** Currently selected DXF entity IDs */
  selectedEntityIds: string[];
  /** Currently selected overlay objects */
  selectedOverlays: Overlay[];
  /**
   * ADR-575 §8 — selected GROUP containers keyed by id. A group renders as ONE unit
   * (dashed box + «Ομάδα · N» overlay + shared gizmo), so its members must NOT emit
   * per-member grips: every expanded member carries the SAME `group.id`, so the entity
   * map keeps just one — showing handles on a single arbitrary member mis-reads as «one
   * object selected». INSTEAD, the whole-group gizmo (move cross + rotation handle at
   * the bbox centre) is emitted here from the `GroupEntity` (needed to compute its
   * bounds). The Map subsumes the id set (`.has(id)` still gates suppression).
   */
  groupEntities?: ReadonlyMap<string, GroupEntity>;
  /**
   * ADR-575 §enter-group — the active drill-in stack. While INSIDE a group (its id is on
   * the stack), its whole-group gizmo is suppressed so the entered member's own grips
   * show instead (the member carries its own id in the converted scene via active-group
   * tagging → the normal per-entity grip path builds them). Revit «Edit Group».
   */
  activeGroupStack?: readonly string[];
}

/**
 * Memoized collection of ALL grips (DXF + overlay) as UnifiedGripInfo[].
 * Recomputes only when selection, scene data, or grip style settings change.
 */
export function useGripRegistry({
  dxfScene,
  selectedEntityIds,
  selectedOverlays,
  groupEntities,
  activeGroupStack,
}: UseGripRegistryParams): UnifiedGripInfo[] {
  // ADR-559 §big-player — `maxGripsPerEntity` intentionally NOT read here: no per-object grip
  // cap (visible ≡ pickable). Only the object-COUNT `gripObjLimit` (AutoCAD GRIPOBJLIMIT) bounds perf.
  const { showMidpoints, showCenters, showQuadrants, gripObjLimit } = useGripStyle();

  return useMemo(() => {
    const result: UnifiedGripInfo[] = [];
    // ADR-559 — single grip-type display rule (midpoint/center/quadrant gating).
    const gripTypeFlags = { showMidpoints, showCenters, showQuadrants };

    // ADR-559 — AutoCAD GRIPOBJLIMIT: when the selection holds MORE objects than the
    // limit, suppress ALL grips (entities stay selected; only grip rendering is skipped
    // for performance). `0` = no limit. Distinct from `maxGripsPerEntity` (the
    // per-single-entity grip cap applied in the loop below). Shared rule SSoT.
    const selectedCount = selectedEntityIds.length + selectedOverlays.length;
    if (isGripObjLimitExceeded(selectedCount, gripObjLimit)) {
      return result;
    }

    // 1. DXF entity grips
    if (dxfScene && selectedEntityIds.length > 0) {
      const entityMap = new Map<string, DxfEntityUnion>();
      for (const entity of dxfScene.entities) {
        entityMap.set(entity.id, entity);
      }
      for (const entityId of selectedEntityIds) {
        // ADR-575 §8 — a selected GROUP renders as ONE unit: suppress its members'
        // per-member grips (they all share `group.id`, so only one would show) and
        // emit the whole-group GIZMO instead (move cross + rotation handle at the bbox
        // centre — Revit / Cinema 4D). Always visible (both `type: 'vertex'`), so the
        // showMidpoints/showCenters gate cannot hide them; never suppressed by the
        // ≥2-object multi-select rule (a group is ONE selected id).
        const group = groupEntities?.get(entityId);
        // ADR-575 §enter-group — while INSIDE this group, suppress its whole-group gizmo:
        // the entered member is edited via its own grips (own id in the converted scene).
        // Falling through with `group` still truthy would emit the gizmo AND the member
        // grips together. `undefined` group (a member's own id) already takes the normal
        // per-entity path below, so only the still-selected container id needs this guard.
        if (group && !(activeGroupStack?.includes(entityId))) {
          const bounds = computeGroupSelectionBounds(group);
          if (bounds) {
            for (const grip of getGroupGizmoGrips(group, bounds)) {
              const wrapped = wrapDxfGrip(grip);
              if (!isGripTypeVisible(wrapped.type, gripTypeFlags)) continue;
              result.push(wrapped);
            }
          }
          continue;
        }
        const entity = entityMap.get(entityId);
        if (entity) {
          const dxfGrips = computeDxfEntityGrips(entity);
          // ADR-397 Φ2 — resolve the entity's local frame + mm scale ONCE; attach to
          // its MOVE grip so the directional click can translate by a typed distance.
          const moveFrame = resolveMoveGlyphFrame(entity as unknown as Entity);
          const mmScale = moveFrame
            ? mmScaleFor(((entity as { params?: { sceneUnits?: SceneUnits | null } }).params) ?? {})
            : 1;
          // ADR-559 §big-player (Giorgio 2026-07-07) — NO per-single-entity grip cap. Revit
          // (edit boundary) / Figma (vector edit) / Cinema 4D (point mode) make EVERY point of a
          // selected object draggable — «visible ≡ editable» is sacred; they never draw a handle
          // you cannot grab. The former `maxGripsPerEntity` truncation made a dense hatch's later
          // boundary vertices visible-but-unpickable → clicking one fell through to a whole-entity
          // body-move (Giorgio: «άλλες φορές μετακινείται όλη η γραμμοσκίαση»). The pickable set now
          // matches the (uncapped) visible renderer. Selection-COUNT perf is still bounded by the
          // AutoCAD `gripObjLimit` (checked above); per-object hit-test is event-time O(n), fine.
          for (const grip of dxfGrips) {
            // ADR-559 §multi-select — ≥2 objects selected → drop the whole-object MOVE +
            // ROTATION glyphs from the pickable/snap set too (so they are neither drawn
            // nor hit-testable). Structural corner/midpoint/vertex grips stay.
            if (shouldHideDataGripForSelection(grip, selectedCount)) continue;
            const wrapped = wrapDxfGrip(grip);
            if (!isGripTypeVisible(wrapped.type, gripTypeFlags)) continue;
            const withFrame = moveFrame && hotGripOpForKind(hotGripKindOf(wrapped)) === 'move'
              ? { ...wrapped, moveGlyphFrame: moveFrame, moveGlyphMmScale: mmScale }
              : wrapped;
            result.push(withFrame);
          }
        }
      }
    }

    // 2. Overlay grips
    for (const overlay of selectedOverlays) {
      if (overlay.polygon && overlay.polygon.length >= 2) {
        const overlayGrips = computeOverlayGrips(overlay.id, overlay.polygon);
        for (const grip of overlayGrips) {
          if (!isGripTypeVisible(grip.type, gripTypeFlags)) continue;
          result.push(grip);
        }
      }
    }

    return result;
  }, [dxfScene, selectedEntityIds, selectedOverlays, groupEntities, activeGroupStack, showMidpoints, showCenters, showQuadrants, gripObjLimit]);
}
