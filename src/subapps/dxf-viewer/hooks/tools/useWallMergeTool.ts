/**
 * USE WALL MERGE TOOL — ADR-566 (Merge/Join Walls, AutoCAD JOIN for walls).
 *
 * Dual-flow editing hook that joins two straight walls. The join TYPE is decided
 * by `classifyWallJoin` (ADR-566 §corner-join):
 *   • collinear (same axis)     → the two walls become ONE (`WallMergeCommand`).
 *   • crossing / L (any angle)  → both axes are extended/trimmed to their
 *     intersection, forming a corner — they stay TWO walls (2×
 *     `UpdateWallParamsCommand` in a `CompositeCommand`, one Ctrl+Z).
 * The INVERSE of `useWallSplitTool`.
 *
 * The "pick two walls" dual-flow interaction (selection-first ⊕ command-first pick
 * loop) + all scene helpers live in the shared `useWallPickScaffold` SSoT; this hook
 * only owns the JOIN action (`executeMerge`) — the gate (`classifyWallJoin`) + pure
 * geometry (`bim/walls/wall-merge.ts`). Invalid joins surface a Revit-style
 * non-blocking hint via `ctx.setHint` and leave the scene untouched.
 *
 * Preview: no dedicated canvas renderer — the first-picked wall reuses the standard
 * selection highlight, the hover candidate reuses HoverStore (both already rendered).
 * ESC / right-click exits to 'select'.
 *
 * Lives in hooks/tools/ (editing hook) because it needs executeCommand for
 * undo/redo — same as useWallSplitTool / useWallAttachTool.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-566-merge-join-walls.md
 * @see hooks/tools/useWallPickScaffold.ts — the shared two-wall pick FSM + scene helpers
 */
'use client';

import { useCallback } from 'react';
import i18next from 'i18next';
import { toast } from 'sonner';
import { generateWallId } from '@/services/enterprise-id.service';
import type { Point2D } from '../../rendering/types/Types';
import type { ICommand } from '../../core/commands/interfaces';
import type { WallEntity } from '../../bim/types/wall-types';
import type { OpeningEntity } from '../../bim/types/opening-types';
import type { SceneAdapterLevelManager } from '../../systems/entity-creation/useSceneManagerAdapter';
import { computeWallGeometry } from '../../bim/geometry/wall-geometry';
import {
  classifyWallJoin,
  computeWallCornerJoin,
  buildMergedWallParams,
  collectMergedOpenings,
  type WallMergeBlockReason,
} from '../../bim/walls/wall-merge';
import { WallMergeCommand } from '../../core/commands/entity-commands/WallMergeCommand';
import { UpdateWallParamsCommand } from '../../core/commands/entity-commands/UpdateWallParamsCommand';
import { CompositeCommand } from '../../core/commands/CompositeCommand';
import { EventBus } from '../../systems/events/EventBus';
import { useWallPickScaffold, type WallPickExecuteContext } from './useWallPickScaffold';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface UseWallMergeToolProps {
  activeTool: string;
  selectedEntityIds: string[];
  levelManager: SceneAdapterLevelManager;
  executeCommand: (cmd: ICommand) => void;
  /** Current viewport scale factor — converts snap tolerance to world units. */
  transformScale: number;
  onToolChange?: (tool: string) => void;
  /** Selection setter (highlight) — reuses the standard selection renderer. */
  selectEntities?: (ids: string[]) => void;
}

export interface UseWallMergeToolReturn {
  isActive: boolean;
  handleWallMergeClick: (worldPoint: Point2D) => void;
  handleWallMergeEscape: () => void;
}

// ── i18n hint keys ──────────────────────────────────────────────────────────

const NS = 'dxf-viewer-shell';
const BLOCK_REASON_KEY: Readonly<Record<WallMergeBlockReason, string>> = {
  'not-straight': 'wallMerge.blocked.notStraight',
  'not-collinear': 'wallMerge.blocked.notCollinear',
  'different-thickness': 'wallMerge.blocked.differentThickness',
  'parallel-offset': 'wallMerge.blocked.parallelOffset',
  'degenerate': 'wallMerge.blocked.degenerate',
};

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useWallMergeTool({
  activeTool,
  selectedEntityIds,
  levelManager,
  executeCommand,
  transformScale,
  onToolChange,
  selectEntities,
}: UseWallMergeToolProps): UseWallMergeToolReturn {
  // ── Merge execution (shared by both flows; preview ≡ commit) ───────────────

  const executeMerge = useCallback((
    a: WallEntity,
    b: WallEntity,
    ctx: WallPickExecuteContext<SceneAdapterLevelManager>,
  ): boolean => {
    const plan = classifyWallJoin(a, b);
    if (plan.kind === 'blocked') {
      const msg = i18next.t(BLOCK_REASON_KEY[plan.reason], { ns: NS });
      ctx.setHint(BLOCK_REASON_KEY[plan.reason]);
      toast.warning(msg); // Revit-style non-blocking, prominent feedback
      return false;
    }
    const sm = ctx.getSceneManager();
    const scene = ctx.getScene();
    if (!sm || !scene?.entities) return false;

    // ── Corner join (ADR-566 §corner-join): extend/trim both axes to their L-corner.
    // The two walls stay separate; each nearest endpoint moves onto the intersection.
    // Two `UpdateWallParamsCommand` wrapped in a CompositeCommand → one Ctrl+Z; the
    // hosted-opening cascade + geometry recompute + auto-save ride the standard path.
    if (plan.kind === 'corner') {
      const join = computeWallCornerJoin(a, b);
      if (!join) {
        ctx.setHint(BLOCK_REASON_KEY.degenerate);
        toast.warning(i18next.t(BLOCK_REASON_KEY.degenerate, { ns: NS }));
        return false;
      }
      const cmdA = new UpdateWallParamsCommand(a.id, join.wallAParams, a.params, sm, false, a.kind);
      const cmdB = new UpdateWallParamsCommand(b.id, join.wallBParams, b.params, sm, false, b.kind);
      executeCommand(new CompositeCommand([cmdA, cmdB]));
      selectEntities?.([a.id, b.id]);
      toast.success(i18next.t('wallMerge.joinedCorner', { ns: NS }));
      return true;
    }

    // ── Collinear merge: the two walls become ONE (outer-to-outer span).
    const mergedParams = buildMergedWallParams(a, b);
    const mergedId = generateWallId();

    const openingsByIdFn = (oid: string): OpeningEntity | null => {
      const e = scene.entities.find((x) => x.id === oid);
      if (!e) return null;
      const c = e as unknown as Partial<OpeningEntity>;
      return c.type === 'opening' && c.params ? (e as unknown as OpeningEntity) : null;
    };

    const openingUpdates = collectMergedOpenings(a, b, openingsByIdFn, mergedId);

    const merged: WallEntity = {
      ...a,
      id: mergedId,
      params: mergedParams,
      geometry: computeWallGeometry(mergedParams, a.kind),
      hostedOpeningIds: openingUpdates.map((u) => u.openingId),
    };

    executeCommand(new WallMergeCommand({ wallA: a, wallB: b, merged, openingUpdates }, sm));
    EventBus.emit('bim:wall-merge-committed', {
      wallAId: a.id,
      wallBId: b.id,
      merged,
      openingUpdates,
    });
    selectEntities?.([mergedId]);
    toast.success(i18next.t('wallMerge.merged', { ns: NS }));
    return true;
  }, [executeCommand, selectEntities]);

  const { isActive, handleClick, handleEscape } = useWallPickScaffold({
    activeTool,
    toolId: 'wall-merge',
    levelManager,
    selectedEntityIds,
    transformScale,
    onToolChange,
    selectEntities,
    hints: { pickFirst: 'wallMerge.pickFirst', pickSecond: 'wallMerge.pickSecond' },
    execute: executeMerge,
  });

  return {
    isActive,
    handleWallMergeClick: handleClick,
    handleWallMergeEscape: handleEscape,
  };
}
