/**
 * ADR-344 Phase 6.C — Text grip drag orchestrator (Q19).
 *
 * Drives the full drag lifecycle for a single grip on a single TEXT/MTEXT
 * entity:
 *
 *   beginDrag  → start a session bound to a grip and an origin cursor
 *   updateDrag → cursor moved (optionally snapped) — produces a ghost
 *   pressKey   → forward keystroke to the DDE buffer
 *   commit     → fire UpdateTextGeometryCommand via CommandHistory
 *   cancel     → discard the session without mutating the scene
 *
 * No DOM, no canvas, no event listeners — this orchestrator stays
 * declarative so it can be unit-tested without jsdom. The host is
 * responsible for translating real DOM events into the methods above.
 */

import type { ICommandHistory } from '../../core/commands/interfaces';
import type {
  DxfTextSceneEntity,
  IDxfTextAuditRecorder,
  ILayerAccessProvider,
} from '../../core/commands/text/types';
import { noopAuditRecorder } from '../../core/commands/text/types';
import { UpdateTextGeometryCommand } from '../../core/commands/text/UpdateTextGeometryCommand';
import type { GeometryPatch } from '../../core/commands/text/UpdateTextGeometryCommand';
import type { ISceneManager } from '../../core/commands/interfaces';
import type { Point2D } from '../../rendering/types/Types';
import type { Rect } from '../layout/attachment-point';
import {
  computeGrips,
  hitTestGrips,
  type TextGrip,
  type TextGripKind,
} from './TextGripGeometry';
import { DirectDistanceEntry } from './DirectDistanceEntry';

// ── Session model ─────────────────────────────────────────────────────────────

export type GripDragStatus = 'idle' | 'dragging' | 'committing';

export interface GripGhost {
  /** The kind of grip currently being dragged. */
  readonly grip: TextGripKind;
  /** Original grip world position when the drag started. */
  readonly origin: Point2D;
  /** Current cursor world position (already snapped if a snap was applied). */
  readonly cursor: Point2D;
  /** Geometry patch that will be applied on commit. */
  readonly previewPatch: GeometryPatch;
  /** Currently buffered DDE value, when any. */
  readonly directDistance: number | null;
}

export interface BeginDragInput {
  readonly entity: DxfTextSceneEntity;
  readonly bbox: Rect;
  readonly grip: TextGrip;
  readonly cursor: Point2D;
}

export interface UpdateDragInput {
  readonly cursor: Point2D;
  /** Optional snap point. When set, replaces `cursor` for math. */
  readonly snapPoint?: Point2D | null;
}

// ── Math helpers ──────────────────────────────────────────────────────────────

function deg(d: number): number {
  return (d * Math.PI) / 180;
}

function rad(r: number): number {
  return (r * 180) / Math.PI;
}

function buildPatch(
  grip: TextGripKind,
  entity: DxfTextSceneEntity,
  origin: Point2D,
  cursor: Point2D,
  bbox: Rect,
  directDistance: number | null,
): GeometryPatch {
  switch (grip) {
    case 'move': {
      const dx = cursor.x - origin.x;
      const dy = cursor.y - origin.y;
      if (directDistance !== null) {
        const len = Math.hypot(dx, dy) || 1;
        const ux = dx / len;
        const uy = dy / len;
        return {
          position: {
            x: entity.position.x + ux * directDistance,
            y: entity.position.y + uy * directDistance,
          },
        };
      }
      return { position: { x: entity.position.x + dx, y: entity.position.y + dy } };
    }
    case 'rotation': {
      const ax = origin.x - entity.position.x;
      const ay = origin.y - entity.position.y;
      const bx = cursor.x - entity.position.x;
      const by = cursor.y - entity.position.y;
      const startAngle = Math.atan2(ay, ax);
      const currentAngle = Math.atan2(by, bx);
      const deltaDeg = rad(currentAngle - startAngle);
      if (directDistance !== null) {
        return { rotation: directDistance };
      }
      return { rotation: entity.textNode.rotation + deltaDeg };
    }
    case 'resize-tl':
    case 'resize-tr':
    case 'resize-bl':
    case 'resize-br': {
      const dx = cursor.x - origin.x;
      // Local x-axis of the entity is rotated by entity rotation; project dx
      // onto it to stay correct under rotated MTEXT frames.
      const r = deg(entity.textNode.rotation);
      const projected = dx * Math.cos(r) + (cursor.y - origin.y) * Math.sin(r);
      const sign = grip === 'resize-tr' || grip === 'resize-br' ? 1 : -1;
      if (directDistance !== null) {
        return { width: Math.max(directDistance, 0) };
      }
      return { width: Math.max(bbox.width + sign * projected, 0) };
    }
    case 'mirror':
      // Mirror does not have a continuous preview — it commits to a 180°
      // rotation increment on release. We surface no patch during drag.
      return {};
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface TextGripHandlerDependencies {
  readonly sceneManager: ISceneManager;
  readonly layerProvider: ILayerAccessProvider;
  readonly commandHistory: ICommandHistory;
  readonly auditRecorder?: IDxfTextAuditRecorder;
}

export class TextGripHandler {
  private status: GripDragStatus = 'idle';
  private ghost: GripGhost | null = null;
  private bbox: Rect | null = null;
  private entityRef: DxfTextSceneEntity | null = null;
  private dde = new DirectDistanceEntry();

  constructor(private readonly deps: TextGripHandlerDependencies) {}

  /** Test only: precompute the grip set for `entity`. */
  getGrips(entity: DxfTextSceneEntity, bbox: Rect): TextGrip[] {
    return computeGrips(entity, bbox, { rotationGripOffset: 20 });
  }

  /** Test only: locate the grip closest to `cursor`. */
  pickGripAt(
    entity: DxfTextSceneEntity,
    bbox: Rect,
    cursor: Point2D,
    worldTolerance: number,
  ): TextGrip | null {
    return hitTestGrips(this.getGrips(entity, bbox), cursor, worldTolerance);
  }

  beginDrag(input: BeginDragInput): void {
    this.entityRef = input.entity;
    this.bbox = input.bbox;
    this.status = 'dragging';
    this.dde.begin();
    this.ghost = {
      grip: input.grip.kind,
      origin: input.grip.point,
      cursor: input.cursor,
      previewPatch: {},
      directDistance: null,
    };
  }

  updateDrag(input: UpdateDragInput): GripGhost | null {
    if (this.status !== 'dragging' || !this.ghost || !this.entityRef || !this.bbox) {
      return null;
    }
    const effective = input.snapPoint ?? input.cursor;
    const dde = this.dde.snapshot().value;
    const previewPatch = buildPatch(
      this.ghost.grip,
      this.entityRef,
      this.ghost.origin,
      effective,
      this.bbox,
      dde,
    );
    this.ghost = {
      ...this.ghost,
      cursor: effective,
      previewPatch,
      directDistance: dde,
    };
    return this.ghost;
  }

  /** Forward a keystroke to the DDE buffer. Returns `true` if consumed. */
  pressKey(key: string): boolean {
    return this.dde.pressKey(key);
  }

  /**
   * Commit the drag: build the geometry patch from the current cursor
   * (or DDE value), construct an UpdateTextGeometryCommand and route it
   * through the injected CommandHistory so undo/redo work end-to-end.
   * The mirror grip is treated as an instant 180°-around-vertical-axis
   * action by toggling the entity rotation by +180°.
   */
  commit(): void {
    if (this.status !== 'dragging' || !this.ghost || !this.entityRef) return;
    const entity = this.entityRef;
    const patch =
      this.ghost.grip === 'mirror'
        ? { rotation: (entity.textNode.rotation + 180) % 360 }
        : this.ghost.previewPatch;
    if (Object.keys(patch).length === 0) {
      this.reset();
      return;
    }
    this.status = 'committing';
    const cmd = new UpdateTextGeometryCommand(
      { entityId: entity.id, patch },
      this.deps.sceneManager,
      this.deps.layerProvider,
      this.deps.auditRecorder ?? noopAuditRecorder,
    );
    this.deps.commandHistory.execute(cmd);
    this.reset();
  }

  cancel(): void {
    this.reset();
  }

  getStatus(): GripDragStatus {
    return this.status;
  }

  getGhost(): GripGhost | null {
    return this.ghost;
  }

  private reset(): void {
    this.status = 'idle';
    this.ghost = null;
    this.bbox = null;
    this.entityRef = null;
    this.dde.reset();
  }
}
