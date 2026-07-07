/**
 * USE WALL GAP-OPENING TOOL — ADR-568 («Γεφύρωση Τοίχων με Κούφωμα»).
 *
 * Sibling of `useWallMergeTool` (ADR-566): joins two COLLINEAR walls that have a
 * GAP between them into ONE continuous wall AND drops a real BIM `OpeningEntity`
 * (a doorway) into the former gap — Revit «Wall + hosted door». The single wall
 * covers the top of the gap → the wall above the door is the lintel/υπέρθυρο.
 *
 * Reuses the ENTIRE merge pipeline + the SSoT opening finalization cascade:
 *   • Gate + span: `canMergeWalls` / `buildMergedWallParams` / `collectMergedOpenings`.
 *   • Gap: `computeWallGap` (ADR-568) — the empty interval between the walls.
 *   • Opening: `buildGapOpeningParams` → the SSoT `buildOpeningEntity` (validate +
 *     geometry + id + type). Width = gap; height/sill = ΝΟΚ defaults.
 *   • Finalization: the opening is dropped through the SAME
 *     `buildOpeningResolvers(levelManager).onOpeningCreated(...)` path the opening
 *     tool + ADR-533 detector use → the host wall re-cuts (2Δ ΚΑΙ 3Δ), the full
 *     geometry (hinge arc) is recomputed, and `drawing:entity-created` fires
 *     synchronously. A bare `CreateBimEntityCommand` skipped all of that (no swing
 *     arc, no 3Δ) — that is why this path is mandatory.
 *   • Persistence: `bim:wall-merge-committed` (wall) + `drawing:entity-created`
 *     (opening, emitted by `onOpeningCreated`) — both already handled.
 *
 * Undo tradeoff (known, accepted — like EVERY opening in the app): the merge is an
 * undoable `WallMergeCommand`, but `onOpeningCreated` is not a command, so Ctrl+Z of
 * a bridge leaves the opening orphaned. Follow-up: wrap in a command (ADR-568 §5).
 *
 * Gap < `MIN_GAP_FOR_OPENING_MM` (or touch/overlap) → plain bridge (single wall, no
 * opening). The dual-flow (selection-first + command-first pick loop) + scene helpers
 * live in the shared `useWallPickScaffold` SSoT — this hook owns only the bridge
 * action (`executeBridge`). ESC exits to 'select'.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-568-wall-gap-auto-opening.md
 * @see hooks/tools/useWallMergeTool.ts — the collinear-merge sibling
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
import { computeWallGeometry } from '../../bim/geometry/wall-geometry';
import {
  canMergeWalls,
  buildMergedWallParams,
  collectMergedOpenings,
  computeWallGap,
  MIN_GAP_FOR_OPENING_MM,
  type WallMergeBlockReason,
} from '../../bim/walls/wall-merge';
import { buildGapOpeningParams } from '../../bim/walls/wall-gap-opening';
import { buildOpeningEntity } from '../drawing/opening-completion';
import { WallMergeCommand } from '../../core/commands/entity-commands/WallMergeCommand';
import { buildOpeningResolvers } from './useSpecialTools-opening';
import { EventBus } from '../../systems/events/EventBus';
import { resolveSceneUnits } from '../../utils/scene-units';
import type { LevelsHookReturn } from '../../systems/levels';
import { useWallPickScaffold, type WallPickExecuteContext } from './useWallPickScaffold';

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * Full levels hook — the gap-opening path routes the new opening through the SSoT
 * `buildOpeningResolvers(levelManager).onOpeningCreated(...)` finalization cascade
 * (host re-cut + 2Δ/3Δ geometry with hinge arc + `drawing:entity-created`), so it
 * needs the whole hook, not the merge-only `Pick`.
 */
type LevelManagerLike = LevelsHookReturn;

export interface UseWallGapOpeningToolProps {
  activeTool: string;
  selectedEntityIds: string[];
  levelManager: LevelManagerLike;
  executeCommand: (cmd: ICommand) => void;
  /** Current viewport scale factor — converts snap tolerance to world units. */
  transformScale: number;
  onToolChange?: (tool: string) => void;
  /** Selection setter (highlight) — reuses the standard selection renderer. */
  selectEntities?: (ids: string[]) => void;
}

export interface UseWallGapOpeningToolReturn {
  isActive: boolean;
  handleWallGapOpeningClick: (worldPoint: Point2D) => void;
  handleWallGapOpeningEscape: () => void;
}

// ── i18n keys ─────────────────────────────────────────────────────────────────

const NS = 'dxf-viewer-shell';
/** Block reasons reuse the merge namespace (identical collinear gate). */
const BLOCK_REASON_KEY: Readonly<Record<WallMergeBlockReason, string>> = {
  'not-straight': 'wallMerge.blocked.notStraight',
  'not-collinear': 'wallMerge.blocked.notCollinear',
  'different-thickness': 'wallMerge.blocked.differentThickness',
  'parallel-offset': 'wallMerge.blocked.parallelOffset',
  'degenerate': 'wallMerge.blocked.degenerate',
};

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useWallGapOpeningTool({
  activeTool,
  selectedEntityIds,
  levelManager,
  executeCommand,
  transformScale,
  onToolChange,
  selectEntities,
}: UseWallGapOpeningToolProps): UseWallGapOpeningToolReturn {
  // ── Bridge execution (shared by both flows; preview ≡ commit) ──────────────

  const executeBridge = useCallback((
    a: WallEntity,
    b: WallEntity,
    ctx: WallPickExecuteContext<LevelManagerLike>,
  ): boolean => {
    const gate = canMergeWalls(a, b);
    if (!gate.ok) {
      ctx.setHint(BLOCK_REASON_KEY[gate.reason]);
      toast.warning(i18next.t(BLOCK_REASON_KEY[gate.reason], { ns: NS })); // Revit-style non-blocking
      return false;
    }
    const sm = ctx.getSceneManager();
    const scene = ctx.getScene();
    const layerId = ctx.levelManager.currentLevelId;
    if (!sm || !scene?.entities || !layerId) return false;

    // ── Collinear bridge: the two walls become ONE (outer-to-outer span). ──────
    const mergedParams = buildMergedWallParams(a, b);
    const mergedId = generateWallId();

    const openingsByIdFn = (oid: string): OpeningEntity | null => {
      const e = scene.entities.find((x) => x.id === oid);
      if (!e) return null;
      const c = e as unknown as Partial<OpeningEntity>;
      return c.type === 'opening' && c.params ? (e as unknown as OpeningEntity) : null;
    };
    const openingUpdates = collectMergedOpenings(a, b, openingsByIdFn, mergedId);
    const reHostedIds = openingUpdates.map((u) => u.openingId);

    // The merged wall hosts ONLY the re-hosted openings here (NOT the gap opening).
    // The gap opening is added AFTER the merge via `onOpeningCreated`, which rebuilds
    // the host wall object → re-cut (2Δ ΚΑΙ 3Δ) + full geometry with hinge arc.
    const merged: WallEntity = {
      ...a,
      id: mergedId,
      params: mergedParams,
      geometry: computeWallGeometry(mergedParams, a.kind),
      hostedOpeningIds: reHostedIds,
    };

    executeCommand(new WallMergeCommand({ wallA: a, wallB: b, merged, openingUpdates }, sm));

    // Persist the wall part via the existing merge listener.
    EventBus.emit('bim:wall-merge-committed', {
      wallAId: a.id,
      wallBId: b.id,
      merged,
      openingUpdates,
    });

    // ── Auto-opening in the former gap (ADR-568): only a real passage gets one. ─
    // Route through the SSoT opening finalization cascade (the SAME path the opening
    // tool + ADR-533 detector use) so the host re-cuts, the full geometry (hinge arc)
    // is recomputed, and 2Δ/3Δ + persistence fire synchronously. The bare
    // CreateBimEntityCommand skipped all of that (no arc, no 3Δ).
    const gap = computeWallGap(a, b);
    let placedOpening = false;
    if (gap && gap.gapMm >= MIN_GAP_FOR_OPENING_MM) {
      const sceneUnits = resolveSceneUnits(scene); // scene-level SSoT (matches the opening tool)
      const res = buildOpeningEntity(buildGapOpeningParams(mergedId, gap), merged, layerId, sceneUnits);
      if (res.ok) {
        buildOpeningResolvers(ctx.levelManager).onOpeningCreated(res.entity);
        placedOpening = true;
      }
    }

    selectEntities?.([mergedId]);
    toast.success(i18next.t(placedOpening ? 'wallGapOpening.bridged' : 'wallGapOpening.merged', { ns: NS }));
    return true;
  }, [executeCommand, selectEntities]);

  const { isActive, handleClick, handleEscape } = useWallPickScaffold({
    activeTool,
    toolId: 'wall-gap-opening',
    levelManager,
    selectedEntityIds,
    transformScale,
    onToolChange,
    selectEntities,
    hints: { pickFirst: 'wallGapOpening.pickFirst', pickSecond: 'wallGapOpening.pickSecond' },
    execute: executeBridge,
  });

  return {
    isActive,
    handleWallGapOpeningClick: handleClick,
    handleWallGapOpeningEscape: handleEscape,
  };
}
