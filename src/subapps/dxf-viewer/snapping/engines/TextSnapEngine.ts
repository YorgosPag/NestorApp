/**
 * ADR-378 Phase 3 — Text Snap Engine.
 *
 * Completes the half-done ADR-344 Phase 6.C wiring by promoting the standalone
 * `TextSnapProvider` math helpers into a first-class `BaseSnapEngine` registered
 * in `SnapEngineRegistry`. Text entities now flow through the canonical
 * ProSnapEngineV2 → Orchestrator → Registry → Engine pipeline like every other
 * snap mode, instead of being fed manually outside the registry.
 *
 * Pattern: mirror `ColumnCenterSnapEngine`. Eight snap points per text entity:
 *
 *   1. insertion       — entity.position (rotation-invariant anchor)
 *   2. corner-tl       — top-left of approximate bounding box
 *   3. corner-tr       — top-right
 *   4. corner-bl       — bottom-left
 *   5. corner-br       — bottom-right
 *   6. center          — bbox centroid
 *   7. edge-top-mid    — top edge midpoint
 *   8. edge-bottom-mid — bottom edge midpoint
 *
 * Bounding box is approximated from `fontSize` / `height` and text content (for
 * TEXT) or `width` × `height` (for MTEXT) — matching industry convention
 * (Revit/AutoCAD text OSNAP use the geometric extent without font parse).
 *
 * Priority: 2 (TEXT) — same tier as INSERTION (ADR-378 §5).
 *
 * @see snapping/extended-types.ts — ExtendedSnapType.TEXT enum + priority array
 * @see config/tolerance-config.ts — SNAP_ENGINE_PRIORITIES.TEXT
 * @see text-engine/interaction/TextSnapProvider.ts — original Phase 6.B math helpers
 * @see canvas-v2/overlays/SnapIndicatorOverlay.tsx — ▣ rect visual + i18n label
 */

import type { Point2D, EntityModel } from '../../rendering/types/Types';
import { ExtendedSnapType, type SnapCandidate } from '../extended-types';
import { BaseSnapEngine, type SnapEngineContext, type SnapEngineResult } from '../shared/BaseSnapEngine';
import { SNAP_ENGINE_PRIORITIES } from '../../config/tolerance-config';
import {
  isTextEntity,
  isMTextEntity,
  type TextEntity,
  type MTextEntity,
} from '../../types/entities';
// ADR-378 / ADR-557 — the 8 snap points derive from the SAME visual box the text grips
// and hover use (`resolveTextBox`), fed by the shared scene→DxfText projection
// (`projectSceneTextToDxf` — resolves content/height/style from `textNode`). So the snap
// markers land EXACTLY on the text grips (corners / center / edge midpoints) and on the
// drawn glyphs — not an estimated char-count bbox that misses badly for in-app text.
import type { TextSnapKind } from '../../text-engine/interaction/TextSnapProvider';
import { resolveTextBox } from '../../bim/text/text-box';
import { rectCornerWorld, rectEdgeWorld } from '../../bim/grips/rect-frame';
import { projectSceneTextToDxf, type TextSceneShape } from '../../bim/text/project-scene-text';
// 🏢 ADR-378: SSoT snap-visibility predicate (imported DXF entities omit `visible`)
import { isEntityVisibleForSnap } from '../shared/snap-visibility';

interface IndexedTextPoint {
  readonly point: Point2D;
  readonly kind: TextSnapKind;
  readonly entityId: string;
}

export class TextSnapEngine extends BaseSnapEngine {
  private points: ReadonlyArray<IndexedTextPoint> = [];

  constructor() {
    super(ExtendedSnapType.TEXT);
  }

  initialize(entities: EntityModel[]): void {
    const out: IndexedTextPoint[] = [];
    for (const entity of entities) {
      if (!isEntityVisibleForSnap(entity)) continue;
      if (!isTextEntity(entity) && !isMTextEntity(entity)) continue;
      const computed = computeTextSnapPoints(entity);
      for (const p of computed) {
        out.push({ point: p.point, kind: p.kind, entityId: entity.id });
      }
    }
    this.points = out;
  }

  findSnapCandidates(cursorPoint: Point2D, context: SnapEngineContext): SnapEngineResult {
    if (this.points.length === 0) return { candidates: [] };

    const priority = SNAP_ENGINE_PRIORITIES.TEXT;
    const radius = context.worldRadiusForType(cursorPoint, ExtendedSnapType.TEXT);

    const candidates: SnapCandidate[] = [];
    for (const tp of this.points) {
      if (context.excludeEntityId && tp.entityId === context.excludeEntityId) continue;
      const distance = Math.hypot(tp.point.x - cursorPoint.x, tp.point.y - cursorPoint.y);
      if (distance > radius) continue;

      candidates.push(this.createCandidate(
        tp.point,
        `text-${tp.kind}`,
        distance,
        priority,
        tp.entityId,
      ));

      if (candidates.length >= context.maxCandidates) break;
    }

    return { candidates };
  }

  dispose(): void {
    this.points = [];
  }
}

interface ComputedTextSnap {
  readonly point: Point2D;
  readonly kind: TextSnapKind;
}

function computeTextSnapPoints(entity: TextEntity | MTextEntity): readonly ComputedTextSnap[] {
  // The SAME attachment-aware VISUAL box the grips/hover emit (`resolveTextBox`), fed by
  // the shared projection so in-app text (content in `textNode`) sizes correctly. The
  // rotated frame's corners/edges/centre coincide with the drawn grip handles.
  const frame = resolveTextBox(projectSceneTextToDxf(entity as unknown as TextSceneShape, entity.id));
  return [
    { kind: 'insertion', point: entity.position },
    { kind: 'corner-tl', point: rectCornerWorld(frame, { sx: -1, sy: 1 }) },
    { kind: 'corner-tr', point: rectCornerWorld(frame, { sx: 1, sy: 1 }) },
    { kind: 'corner-bl', point: rectCornerWorld(frame, { sx: -1, sy: -1 }) },
    { kind: 'corner-br', point: rectCornerWorld(frame, { sx: 1, sy: -1 }) },
    { kind: 'center', point: frame.center },
    { kind: 'edge-top-mid', point: rectEdgeWorld(frame, { axis: 'y', sign: 1 }) },
    { kind: 'edge-bottom-mid', point: rectEdgeWorld(frame, { axis: 'y', sign: -1 }) },
  ];
}
