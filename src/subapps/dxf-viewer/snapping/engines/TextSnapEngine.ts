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

type TextSnapKind =
  | 'insertion'
  | 'corner-tl'
  | 'corner-tr'
  | 'corner-bl'
  | 'corner-br'
  | 'center'
  | 'edge-top-mid'
  | 'edge-bottom-mid';

interface IndexedTextPoint {
  readonly point: Point2D;
  readonly kind: TextSnapKind;
  readonly entityId: string;
}

const TEXT_DEFAULT_FONT_SIZE = 10;
const TEXT_WIDTH_PER_CHAR_FACTOR = 0.6;

export class TextSnapEngine extends BaseSnapEngine {
  private points: ReadonlyArray<IndexedTextPoint> = [];

  constructor() {
    super(ExtendedSnapType.TEXT);
  }

  initialize(entities: EntityModel[]): void {
    const out: IndexedTextPoint[] = [];
    for (const entity of entities) {
      if (!entity.visible) continue;
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
  const insertion = entity.position;
  const rotationDeg = entity.rotation ?? 0;
  const rad = (rotationDeg * Math.PI) / 180;
  const bbox = estimateTextBbox(entity);

  const local: Record<Exclude<TextSnapKind, 'insertion'>, Point2D> = {
    'corner-tl':       { x: 0,            y: 0 },
    'corner-tr':       { x: bbox.width,   y: 0 },
    'corner-bl':       { x: 0,            y: bbox.height },
    'corner-br':       { x: bbox.width,   y: bbox.height },
    'center':          { x: bbox.width/2, y: bbox.height/2 },
    'edge-top-mid':    { x: bbox.width/2, y: 0 },
    'edge-bottom-mid': { x: bbox.width/2, y: bbox.height },
  };

  const order: readonly TextSnapKind[] = [
    'insertion',
    'corner-tl',
    'corner-tr',
    'corner-bl',
    'corner-br',
    'center',
    'edge-top-mid',
    'edge-bottom-mid',
  ];

  return order.map((kind) => {
    if (kind === 'insertion') return { point: insertion, kind };
    const lp = local[kind];
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    return {
      point: {
        x: insertion.x + lp.x * cos - lp.y * sin,
        y: insertion.y + lp.x * sin + lp.y * cos,
      },
      kind,
    };
  });
}

function estimateTextBbox(entity: TextEntity | MTextEntity): { width: number; height: number } {
  const fontSize = entity.fontSize ?? entity.height ?? TEXT_DEFAULT_FONT_SIZE;

  if (entity.type === 'mtext') {
    const lines = entity.text ? entity.text.split('\n').length : 1;
    return {
      width: entity.width,
      height: entity.height ?? fontSize * lines,
    };
  }

  const charCount = entity.text ? entity.text.length : 1;
  return {
    width: Math.max(charCount, 1) * fontSize * TEXT_WIDTH_PER_CHAR_FACTOR,
    height: fontSize,
  };
}
