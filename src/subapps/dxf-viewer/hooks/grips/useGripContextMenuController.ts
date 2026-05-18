/**
 * USE GRIP CONTEXT MENU CONTROLLER — ADR-357 Phase 11 / G10.A
 *
 * Right-click handler that opens the {@link GripContextMenuStore} when the
 * user right-clicks while a DXF grip is hot (hovering / warm / dragging).
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
import { resolveContextMenuSections } from '../../systems/grip/grip-context-menu-resolver';
import { bindContextMenuAction } from '../../systems/grip/grip-context-menu-actions';

type LevelManagerLike = Pick<
  ReturnType<typeof useLevels>,
  'getLevelScene' | 'currentLevelId'
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

      const grip = pickTargetGrip(d.hoveredGrip, d.activeGrip, d.phase);
      if (!grip || grip.source !== 'dxf' || !grip.entityId) return;

      const levelId = d.levelManager.currentLevelId;
      if (!levelId) return;
      const scene = d.levelManager.getLevelScene(levelId);
      const entity = scene?.entities.find((ent) => ent.id === grip.entityId);
      if (!entity) return;

      // Suppress the browser's native context menu — AutoCAD-style menu wins.
      e.preventDefault();
      e.stopPropagation();

      const currentMode = GripModeStore.getSnapshot();
      const sectionsMeta = resolveContextMenuSections(entity, grip);
      const sections: GripContextMenuSection[] = [];

      for (const sectionMeta of sectionsMeta) {
        const items: GripContextMenuSection['items'][number][] = [];
        for (const actionMeta of sectionMeta.items) {
          const onSelect = bindContextMenuAction(actionMeta, {
            handleEscape: () => depsRef.current.handleEscape(),
            onAfterDispatch: () => GripContextMenuStore.hide(),
          });
          if (!onSelect) continue;
          items.push({
            id: actionMeta.id,
            labelKey: actionMeta.labelKey,
            onSelect,
            checked: actionMeta.mode !== undefined && actionMeta.mode === currentMode,
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
