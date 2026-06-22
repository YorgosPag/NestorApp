/**
 * USE GRIP CONTEXT MENU CONTROLLER — ADR-357 Phase 11 / G10.A + Phase 12 / G10 extras
 *
 * Right-click handler that opens the {@link GripContextMenuStore} when the
 * user right-clicks while a DXF grip is hot (hovering / warm / dragging).
 *
 * Phase 12 — the controller is now also responsible for filling in the
 * dynamic `checked` / `disabled` flags on each resolved action by reading
 * from the relevant micro-leaf SSoT stores ({@link GripModeStore},
 * {@link GripCopyModeStore}, {@link GripSessionUndoStore}). The resolver
 * stays pure (no Store reads); gating lives here so the menu reflects the
 * live state at the moment the user opens it.
 *
 * Architectural twin of {@link useGripHoverMenuController} (400ms hold-time)
 * but driven by the `contextmenu` DOM event instead of a timer. Suppresses the
 * native browser context menu when a grip is active so the AutoCAD-style menu
 * takes precedence; outside a grip, the page's default context menu is left
 * untouched.
 *
 * ADR-040 compliant: this hook only writes to a LOW-frequency store and runs
 * `useEffect` against discrete inputs — no `useSyncExternalStore`, no 60fps
 * subscription. Safe to invoke from CanvasSection.
 *
 * @see GripContextMenuStore
 * @see grip-context-menu-resolver
 * @see grip-context-menu-actions
 * @see useGripHoverMenuController — sister hook (hover hold-menu)
 */

import { useEffect, useRef } from 'react';
import type { UnifiedGripInfo, UnifiedGripPhase } from './unified-grip-types';
import type { useLevels } from '../../systems/levels';
import { GripContextMenuStore, type GripContextMenuSection } from '../../systems/grip/GripContextMenuStore';
import { GripModeStore } from '../../systems/grip/GripModeStore';
import { resolveContextMenuSections, type GripContextActionMeta } from '../../systems/grip/grip-context-menu-resolver';
import { bindContextMenuAction } from '../../systems/grip/grip-context-menu-actions';
import { GripCopyModeStore } from '../../systems/grip/GripCopyModeStore';
import { GripSessionUndoStore } from '../../systems/grip/GripSessionUndoStore';
import { getGlobalCommandHistory } from '../../core/commands/CommandHistory';
// ADR-363 Phase 3.8 — slab vertex ops from context menu
import { removeVertexFromSlab, applySlabGripDrag } from '../../bim/slabs/slab-grips';
import { UpdateSlabParamsCommand } from '../../core/commands/entity-commands/UpdateSlabParamsCommand';
import type { SlabEntity } from '../../bim/types/slab-types';
// ADR-417 Φ1-part-2 #2 — roof vertex ops from context menu (mirror slab).
import { removeVertexFromRoof, applyRoofGripDrag } from '../../bim/roofs/roof-grips';
import { UpdateRoofParamsCommand } from '../../core/commands/entity-commands/UpdateRoofParamsCommand';
import type { RoofEntity } from '../../bim/types/roof-types';
import { LevelSceneManagerAdapter } from '../../systems/entity-creation/LevelSceneManagerAdapter';
// ADR-510 Φ3c — multifunctional polyline grip ops (add/remove/convert).
import { buildPolylineVertexOpCommand, type PolylineVertexMenuOp } from '../../systems/grip/polyline-grip-ops';

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'setLevelScene' | 'currentLevelId'
>;

export interface UseGripContextMenuControllerParams {
  /** Grip currently under the cursor (hovering / warm phases). */
  readonly hoveredGrip: UnifiedGripInfo | null;
  /** Grip being actively dragged (`dragging` phase). */
  readonly activeGrip: UnifiedGripInfo | null;
  readonly phase: UnifiedGripPhase;
  readonly activeTool: string;
  readonly levelManager: LevelManagerLike;
  /** Cancel the active drag — mirrored from `useUnifiedGripInteraction.handleEscape`. */
  readonly handleEscape: () => void;
}

function pickTargetGrip(
  hoveredGrip: UnifiedGripInfo | null,
  activeGrip: UnifiedGripInfo | null,
  phase: UnifiedGripPhase,
): UnifiedGripInfo | null {
  if (phase === 'dragging') return activeGrip;
  if (phase === 'hovering' || phase === 'warm') return hoveredGrip;
  return null;
}

/**
 * Fill in `checked` / `disabled` flags from the live state of the relevant
 * micro-leaf SSoT stores. Keeps the resolver pure while still reflecting
 * dynamic state at menu-open time.
 */
function applyDynamicFlags(actionMeta: GripContextActionMeta): {
  checked: boolean;
  disabled: boolean;
} {
  // Mode items: check-mark on the currently active GripMode.
  if (actionMeta.mode) {
    return { checked: actionMeta.mode === GripModeStore.getSnapshot(), disabled: false };
  }

  switch (actionMeta.extraKind) {
    case 'copyToggle':
      // Persistent toggle — show check-mark while enabled (AutoCAD MULTIPLE-style).
      return { checked: GripCopyModeStore.getSnapshot().enabled, disabled: false };

    case 'reference': {
      // Reference is only meaningful in Scale / Rotate (Mirror has no reference
      // axis flow; Stretch / Move have no reference math).
      const mode = GripModeStore.getSnapshot();
      return { checked: false, disabled: mode !== 'scale' && mode !== 'rotate' };
    }

    case 'sessionUndo':
      return { checked: false, disabled: !GripSessionUndoStore.canSessionUndo() };

    case 'basePoint':
      // Always available during a drag — controller already enforces grip phase.
      return { checked: false, disabled: false };

    default:
      return { checked: false, disabled: false };
  }
}

export function useGripContextMenuController(
  params: UseGripContextMenuControllerParams,
): void {
  const { hoveredGrip, activeGrip, phase, activeTool, levelManager, handleEscape } = params;

  // Keep the latest deps in refs so the window listener stays stable across
  // 60fps grip phase changes (avoid attach/detach churn on every hover frame).
  const depsRef = useRef({ hoveredGrip, activeGrip, phase, activeTool, levelManager, handleEscape });
  depsRef.current = { hoveredGrip, activeGrip, phase, activeTool, levelManager, handleEscape };

  useEffect(() => {
    const onContextMenu = (e: MouseEvent) => {
      const d = depsRef.current;
      const isGripMode = d.activeTool === 'select' || d.activeTool === 'layering';
      if (!isGripMode) return;

      // ADR-363 Phase 1G — right-click during a corner hot-grip aborts the move
      // (AutoCAD: Esc / right-click cancels) instead of opening the grip menu.
      if (d.phase === 'hotGrip') {
        e.preventDefault();
        e.stopPropagation();
        d.handleEscape();
        return;
      }

      const grip = pickTargetGrip(d.hoveredGrip, d.activeGrip, d.phase);
      if (!grip || grip.source !== 'dxf' || !grip.entityId) return;

      const levelId = d.levelManager.currentLevelId;
      if (!levelId) return;
      const scene = d.levelManager.getLevelScene(levelId);
      const entity = scene?.entities.find((ent) => ent.id === grip.entityId);
      if (!entity) return;

      const sectionsMeta = resolveContextMenuSections(entity, grip);

      // ADR-358 §5.6.bis — on plain hover/warm (no active drag) the base grip
      // modes (Stretch/Move/Rotate/Scale/Mirror) are not actionable, so defer to
      // the EntityContextMenu: a right-click over a COMPACT entity whose body is
      // entirely grip-zone (e.g. a column) must open the SAME menu as a wall.
      // Keep the grip menu on hover only when it carries vertex-ops (slab/roof
      // add/delete corner), and unconditionally during an active drag.
      const hasVertexOps = sectionsMeta.some(
        (s) => s.id === 'vertex-ops' || s.id === 'polyline-ops',
      );
      if ((d.phase === 'hovering' || d.phase === 'warm') && !hasVertexOps) return;

      // Suppress the browser's native context menu — AutoCAD-style menu wins.
      e.preventDefault();
      e.stopPropagation();

      const sections: GripContextMenuSection[] = [];
      // ADR-357 Phase 12 — session undo delegates to the global CommandHistory.
      const sessionUndo = () => {
        if (GripSessionUndoStore.canSessionUndo()) {
          getGlobalCommandHistory().undo();
        }
      };

      // ADR-363 Phase 3.8 + ADR-417 Φ1-part-2 #2 — polygon-outline vertex
      // operations (slab / roof) dispatched through global history. Branches on
      // the grip discriminator so the right Update*ParamsCommand recomputes
      // geometry atomically (one shared dispatcher = SSoT, no per-entity wire).
      const onSlabVertexOp = (targetGrip: UnifiedGripInfo, op: 'delete-corner' | 'add-corner') => {
        const lm = depsRef.current.levelManager;
        if (!targetGrip.entityId || !lm.currentLevelId) return;
        const adapter = new LevelSceneManagerAdapter(lm.getLevelScene, lm.setLevelScene, lm.currentLevelId);
        const raw = adapter.getEntity(targetGrip.entityId);

        // ADR-417 — roof branch (footprint vertex delete / edge-midpoint insert).
        if (targetGrip.roofGripKind) {
          const roofCandidate = raw as unknown as Partial<RoofEntity>;
          if (roofCandidate?.type !== 'roof' || !roofCandidate.params) return;
          const roof = roofCandidate as RoofEntity;
          let newParams = roof.params;
          if (op === 'delete-corner' && targetGrip.roofGripKind.startsWith('roof-vertex-')) {
            const idx = parseInt(targetGrip.roofGripKind.slice('roof-vertex-'.length), 10);
            if (Number.isFinite(idx)) newParams = removeVertexFromRoof(roof.params, idx);
          } else if (op === 'add-corner' && targetGrip.roofGripKind.startsWith('roof-edge-midpoint-')) {
            newParams = applyRoofGripDrag(targetGrip.roofGripKind, { originalParams: roof.params, delta: { x: 0, y: 0 } });
          }
          if (newParams === roof.params) return;
          const cmd = new UpdateRoofParamsCommand(targetGrip.entityId, newParams, roof.params, adapter, false);
          if (cmd.validate() === null) getGlobalCommandHistory().execute(cmd);
          return;
        }

        const candidate = raw as unknown as Partial<SlabEntity>;
        if (candidate?.type !== 'slab' || !candidate.params) return;
        const slab = candidate as SlabEntity;
        let newParams = slab.params;
        if (op === 'delete-corner' && targetGrip.slabGripKind?.startsWith('slab-vertex-')) {
          const idx = parseInt(targetGrip.slabGripKind.slice('slab-vertex-'.length), 10);
          if (Number.isFinite(idx)) newParams = removeVertexFromSlab(slab.params, idx);
        } else if (op === 'add-corner' && targetGrip.slabGripKind?.startsWith('slab-edge-midpoint-')) {
          newParams = applySlabGripDrag(targetGrip.slabGripKind, { originalParams: slab.params, delta: { x: 0, y: 0 } });
        }
        if (newParams === slab.params) return;
        const cmd = new UpdateSlabParamsCommand(targetGrip.entityId, newParams, slab.params, adapter, false);
        if (cmd.validate() === null) getGlobalCommandHistory().execute(cmd);
      };

      // ADR-510 Φ3c — multifunctional polyline grip ops. Pure builder picks the
      // right command (PolylineVertexCommand add/remove, SetBulgeCommand arc/line);
      // run through global history = one undo step (mirror of onSlabVertexOp).
      const onPolylineVertexOp = (targetGrip: UnifiedGripInfo, op: PolylineVertexMenuOp) => {
        const lm = depsRef.current.levelManager;
        if (!targetGrip.entityId || !lm.currentLevelId) return;
        const adapter = new LevelSceneManagerAdapter(lm.getLevelScene, lm.setLevelScene, lm.currentLevelId);
        const cmd = buildPolylineVertexOpCommand(targetGrip, op, adapter);
        if (cmd && cmd.validate() === null) getGlobalCommandHistory().execute(cmd);
      };

      for (const sectionMeta of sectionsMeta) {
        const items: GripContextMenuSection['items'][number][] = [];
        for (const actionMeta of sectionMeta.items) {
          const onSelect = bindContextMenuAction(actionMeta, {
            handleEscape: () => depsRef.current.handleEscape(),
            onAfterDispatch: () => GripContextMenuStore.hide(),
            sessionUndo,
            onSlabVertexOp,
            onPolylineVertexOp,
          }, grip);
          if (!onSelect) continue;
          const { checked, disabled } = applyDynamicFlags(actionMeta);
          items.push({
            id: actionMeta.id,
            labelKey: actionMeta.labelKey,
            onSelect,
            checked,
            disabled,
            destructive: actionMeta.destructive,
          });
        }
        if (items.length > 0) {
          sections.push({
            id: sectionMeta.id,
            titleKey: sectionMeta.titleKey,
            items,
          });
        }
      }
      if (sections.length === 0) return;

      GripContextMenuStore.show({
        grip,
        screenPos: { x: e.clientX, y: e.clientY },
        sections,
      });
    };

    // Capture phase so we run before page-level handlers; we still respect
    // them via stopPropagation only when we actually open the menu.
    window.addEventListener('contextmenu', onContextMenu, true);
    return () => {
      window.removeEventListener('contextmenu', onContextMenu, true);
    };
  }, []);

  // Auto-close when the phase returns to idle (matches AutoCAD: grip release → menu reset).
  useEffect(() => {
    if (phase === 'idle') GripContextMenuStore.hide();
  }, [phase]);
}
