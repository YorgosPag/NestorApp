/**
 * GRIP MENU ACTIONS — ADR-349 Phase 1b.2
 *
 * Action dispatcher that turns a resolved {@link GripMenuActionId} into a bound
 * `onSelect` callback. Each callback builds the proper ICommand via SSoT math
 * (`lengthen-axial-stretch`, `arc-radius-edit`) and dispatches through
 * `executeCommand` — preserving the undo/redo chain.
 *
 * No React, no DOM. Receives a context with the live scene manager, the
 * `executeCommand` dispatcher, and the prompt-dialog facade — the controller
 * hook supplies all three.
 *
 * @see grip-menu-resolver.ts — pure resolver
 * @see ADR-349 §Multifunctional Grip Menu
 */

import type { ICommand, ISceneManager } from '../../core/commands/interfaces';
import type { UnifiedGripInfo } from '../../hooks/grips/unified-grip-types';
import type { Entity, ArcEntity, PolylineEntity, LWPolylineEntity } from '../../types/entities';
import type { Point2D } from '../../rendering/types/Types';
import type { PromptDialogOptions } from '../prompt-dialog';
import { LengthenCommand } from '../../core/commands/entity-commands/LengthenCommand';
import { ArcRadiusEditCommand } from '../../core/commands/entity-commands/ArcRadiusEditCommand';
import { PolylineVertexCommand } from '../../core/commands/entity-commands/PolylineVertexCommand';
import type { LengthenEndpoint } from './lengthen-axial-stretch';
import type { GripMenuActionId } from './grip-menu-resolver';

export interface GripMenuActionContext {
  readonly executeCommand: (cmd: ICommand) => void;
  readonly sceneManager: ISceneManager;
  readonly showPromptDialog: (opts: PromptDialogOptions) => Promise<string | null>;
  readonly t: (key: string, params?: Record<string, unknown>) => string;
  readonly onAfterDispatch: () => void;
}

type PolyEntity = PolylineEntity | LWPolylineEntity;

function parseFiniteFloat(raw: string | null): number | null {
  if (raw === null) return null;
  const v = parseFloat(raw.trim().replace(',', '.'));
  return Number.isFinite(v) ? v : null;
}

// ── Endpoint resolution ──────────────────────────────────────────────────────

function endpointForLineGrip(grip: UnifiedGripInfo): LengthenEndpoint | null {
  if (grip.gripIndex === 0) return 'start';
  if (grip.gripIndex === 1) return 'end';
  return null;
}

function endpointForArcGrip(grip: UnifiedGripInfo): LengthenEndpoint | null {
  if (grip.gripIndex === 1) return 'start';
  if (grip.gripIndex === 2) return 'end';
  return null;
}

// ── Action handlers ──────────────────────────────────────────────────────────

async function actionLengthen(
  entity: Entity,
  grip: UnifiedGripInfo,
  ctx: GripMenuActionContext,
): Promise<void> {
  const endpoint =
    entity.type === 'line' ? endpointForLineGrip(grip) :
    entity.type === 'arc'  ? endpointForArcGrip(grip)  : null;
  if (!endpoint) return;

  const raw = await ctx.showPromptDialog({
    title: ctx.t('tool-hints:gripMenu.prompt.lengthenTitle'),
    label: ctx.t('tool-hints:gripMenu.prompt.lengthenLabel'),
    inputType: 'number',
    defaultValue: '',
  });
  const delta = parseFiniteFloat(raw);
  if (delta === null || delta === 0) return;

  ctx.executeCommand(new LengthenCommand(
    { entityId: entity.id, endpoint, value: delta, mode: 'delta' },
    ctx.sceneManager,
  ));
  ctx.onAfterDispatch();
}

async function actionRadius(
  arc: ArcEntity,
  ctx: GripMenuActionContext,
): Promise<void> {
  const raw = await ctx.showPromptDialog({
    title: ctx.t('tool-hints:gripMenu.prompt.radiusTitle'),
    label: ctx.t('tool-hints:gripMenu.prompt.radiusLabel'),
    inputType: 'number',
    defaultValue: arc.radius.toFixed(3),
    validate: (v) => {
      const n = parseFiniteFloat(v);
      return n !== null && n > 0 ? null : ctx.t('tool-hints:gripMenu.prompt.radiusInvalid');
    },
  });
  const newRadius = parseFiniteFloat(raw);
  if (newRadius === null || newRadius <= 0) return;

  ctx.executeCommand(new ArcRadiusEditCommand(
    { entityId: arc.id, input: { kind: 'radius', newRadius } },
    ctx.sceneManager,
  ));
  ctx.onAfterDispatch();
}

function midpoint(a: Point2D, b: Point2D): Point2D {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function actionAddVertex(
  poly: PolyEntity,
  grip: UnifiedGripInfo,
  ctx: GripMenuActionContext,
): void {
  const verts = poly.vertices;
  const vLen = verts.length;
  if (vLen === 0) return;
  const idx = grip.gripIndex;
  if (idx < 0 || idx >= vLen) return;

  let insertIndex: number;
  let position: Point2D;
  if (idx < vLen - 1) {
    insertIndex = idx + 1;
    position = midpoint(verts[idx], verts[idx + 1]);
  } else if (poly.closed && vLen > 1) {
    insertIndex = vLen;
    position = midpoint(verts[vLen - 1], verts[0]);
  } else if (vLen >= 2) {
    insertIndex = idx;
    position = midpoint(verts[idx - 1], verts[idx]);
  } else {
    return;
  }

  ctx.executeCommand(new PolylineVertexCommand(
    { entityId: poly.id, op: { kind: 'add', index: insertIndex, position } },
    ctx.sceneManager,
  ));
  ctx.onAfterDispatch();
}

function actionRemoveVertex(
  poly: PolyEntity,
  grip: UnifiedGripInfo,
  ctx: GripMenuActionContext,
): void {
  if (poly.vertices.length <= 2) return;
  ctx.executeCommand(new PolylineVertexCommand(
    { entityId: poly.id, op: { kind: 'remove', index: grip.gripIndex } },
    ctx.sceneManager,
  ));
  ctx.onAfterDispatch();
}

// ── Dispatcher ───────────────────────────────────────────────────────────────

/**
 * Build the live `onSelect` callback for a given action id, bound to a specific
 * entity + grip + context. Returns `null` if the action is not applicable to
 * the entity shape (defensive — resolver should already have filtered).
 */
export function bindMenuAction(
  actionId: GripMenuActionId,
  entity: Entity,
  grip: UnifiedGripInfo,
  ctx: GripMenuActionContext,
): (() => void) | null {
  switch (actionId) {
    case 'stretch':
      return () => { ctx.onAfterDispatch(); };

    case 'lengthen':
      if (entity.type !== 'line' && entity.type !== 'arc') return null;
      return () => { void actionLengthen(entity, grip, ctx); };

    case 'radius':
      if (entity.type !== 'arc') return null;
      return () => { void actionRadius(entity as ArcEntity, ctx); };

    case 'addVertex':
      if (entity.type !== 'polyline' && entity.type !== 'lwpolyline') return null;
      return () => { actionAddVertex(entity as PolyEntity, grip, ctx); };

    case 'removeVertex':
      if (entity.type !== 'polyline' && entity.type !== 'lwpolyline') return null;
      return () => { actionRemoveVertex(entity as PolyEntity, grip, ctx); };

    default:
      return null;
  }
}
