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
 * opening). Dual-flow (selection-first + command-first pick loop) mirrors the merge
 * tool exactly. ESC exits to 'select'.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-568-wall-gap-auto-opening.md
 * @see hooks/tools/useWallMergeTool.ts — the collinear-merge sibling
 */
'use client';

import { useCallback, useEffect, useRef } from 'react';
import i18next from 'i18next';
import { toast } from 'sonner';
import { generateWallId } from '@/services/enterprise-id.service';
import type { Point2D } from '../../rendering/types/Types';
import type { ICommand } from '../../core/commands/interfaces';
import type { WallEntity } from '../../bim/types/wall-types';
import type { OpeningEntity } from '../../bim/types/opening-types';
import { isWallEntity } from '../../types/entities';
import { SelectedEntitiesStore } from '../../systems/selection';
import { createLevelSceneManagerAdapter } from '../../systems/entity-creation/LevelSceneManagerAdapter';
import { computeWallGeometry } from '../../bim/geometry/wall-geometry';
import { projectPointOnWallAxis } from '../../bim/walls/wall-axis-projection';
import { calculateDistance } from '../../rendering/entities/shared/geometry-rendering-utils';
import { getHoveredEntity } from '../../systems/hover/HoverStore';
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
import { TOLERANCE_CONFIG } from '../../config/tolerance-config';
import { toolHintOverrideStore } from '../toolHintOverrideStore';
import { resolveSceneUnits } from '../../utils/scene-units';
import type { LevelsHookReturn } from '../../systems/levels';

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
  const isActive = activeTool === 'wall-gap-opening';
  const transformScaleRef = useRef(transformScale);
  transformScaleRef.current = transformScale;

  /** First-picked wall in the command-first flow (null = awaiting first pick). */
  const pickedARef = useRef<WallEntity | null>(null);
  const wasActiveRef = useRef(false);

  const setHint = useCallback((key: string): void => {
    toolHintOverrideStore.setOverride(i18next.t(key, { ns: NS }));
  }, []);

  // ── Scene helpers (mirror useWallMergeTool) ───────────────────────────────

  const getSceneManager = useCallback(() => {
    if (!levelManager.currentLevelId) return null;
    return createLevelSceneManagerAdapter(
      levelManager.getLevelScene,
      levelManager.setLevelScene,
      levelManager.currentLevelId,
    );
  }, [levelManager]);

  const getScene = useCallback(() => {
    if (!levelManager.currentLevelId) return null;
    return levelManager.getLevelScene(levelManager.currentLevelId) ?? null;
  }, [levelManager]);

  const getWallById = useCallback((id: string | null): WallEntity | null => {
    if (!id) return null;
    const scene = getScene();
    const e = scene?.entities.find((x) => x.id === id);
    return e && isWallEntity(e) ? e : null;
  }, [getScene]);

  const findWallAtPoint = useCallback((worldPoint: Point2D, excludeId?: string): WallEntity | null => {
    const hovered = getWallById(getHoveredEntity());
    if (hovered && hovered.id !== excludeId) return hovered;

    const scene = getScene();
    if (!scene?.entities) return null;
    const hitTol = TOLERANCE_CONFIG.SNAP_DEFAULT / transformScaleRef.current;
    let best: WallEntity | null = null;
    let bestDist = Infinity;
    for (const e of scene.entities) {
      if (!isWallEntity(e) || e.id === excludeId) continue;
      const foot = projectPointOnWallAxis(e, worldPoint);
      if (!foot) continue;
      const d = calculateDistance(worldPoint, foot);
      if (d < hitTol && d < bestDist) {
        bestDist = d;
        best = e;
      }
    }
    return best;
  }, [getScene, getWallById]);

  const collectSelectedWalls = useCallback((): WallEntity[] => {
    const scene = getScene();
    if (!scene?.entities) return [];
    // Prefer the prop; fall back to the selection SSoT store so activation-time
    // reads are never stale (ADR-532), mirror useWallMergeTool.
    const ids = selectedEntityIds.length ? selectedEntityIds : SelectedEntitiesStore.getSelectedEntityIds();
    const idSet = new Set(ids);
    return scene.entities.filter((e): e is WallEntity => idSet.has(e.id) && isWallEntity(e));
  }, [getScene, selectedEntityIds]);

  // ── Bridge execution (shared by both flows; preview ≡ commit) ──────────────

  const executeBridge = useCallback((a: WallEntity, b: WallEntity): boolean => {
    const gate = canMergeWalls(a, b);
    if (!gate.ok) {
      setHint(BLOCK_REASON_KEY[gate.reason]);
      toast.warning(i18next.t(BLOCK_REASON_KEY[gate.reason], { ns: NS })); // Revit-style non-blocking
      return false;
    }
    const sm = getSceneManager();
    const scene = getScene();
    const layerId = levelManager.currentLevelId;
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
        buildOpeningResolvers(levelManager).onOpeningCreated(res.entity);
        placedOpening = true;
      }
    }

    selectEntities?.([mergedId]);
    toast.success(i18next.t(placedOpening ? 'wallGapOpening.bridged' : 'wallGapOpening.merged', { ns: NS }));
    return true;
  }, [getSceneManager, getScene, levelManager, executeCommand, selectEntities, setHint]);

  // ── Activation: Flow B (selection-first) or enter picking (Flow A) ─────────

  useEffect(() => {
    if (isActive && !wasActiveRef.current) {
      pickedARef.current = null;
      const walls = collectSelectedWalls();
      if (walls.length === 2) {
        if (executeBridge(walls[0], walls[1])) {
          onToolChange?.('select');
        } else {
          setHint('wallGapOpening.pickFirst'); // invalid pre-selection → manual picking
        }
      } else if (walls.length === 1) {
        pickedARef.current = walls[0];
        selectEntities?.([walls[0].id]);
        setHint('wallGapOpening.pickSecond');
      } else {
        setHint('wallGapOpening.pickFirst');
      }
    } else if (!isActive && wasActiveRef.current) {
      pickedARef.current = null;
      toolHintOverrideStore.setOverride(null);
    }
    wasActiveRef.current = isActive;
  }, [isActive, collectSelectedWalls, executeBridge, onToolChange, selectEntities, setHint]);

  // ── Click: Flow A picking loop ─────────────────────────────────────────────

  const handleWallGapOpeningClick = useCallback((worldPoint: Point2D): void => {
    const hit = findWallAtPoint(worldPoint, pickedARef.current?.id);
    if (!hit) return;

    if (!pickedARef.current) {
      pickedARef.current = hit;
      selectEntities?.([hit.id]);
      setHint('wallGapOpening.pickSecond');
      return;
    }

    if (executeBridge(pickedARef.current, hit)) {
      pickedARef.current = null;
      setHint('wallGapOpening.pickFirst'); // loop (continuous tool)
    }
    // invalid: hint shows the reason; keep A picked so the user retries wall 2.
  }, [findWallAtPoint, executeBridge, selectEntities, setHint]);

  // ── Escape: exit tool ─────────────────────────────────────────────────────

  const handleWallGapOpeningEscape = useCallback((): void => {
    pickedARef.current = null;
    toolHintOverrideStore.setOverride(null);
    selectEntities?.([]);
    onToolChange?.('select');
  }, [onToolChange, selectEntities]);

  return { isActive, handleWallGapOpeningClick, handleWallGapOpeningEscape };
}
