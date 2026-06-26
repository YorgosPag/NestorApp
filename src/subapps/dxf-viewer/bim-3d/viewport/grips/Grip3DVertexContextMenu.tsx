"use client";

/**
 * Grip3DVertexContextMenu — 3D viewport per-vertex grip context menu (ADR-535 Φ4).
 *
 * Mirror of `view-cube-context-menu.tsx`: a 1×1 invisible anchor at the right-click
 * coordinates + a Radix dropdown. The (non-React) interaction handler opens it via
 * `Grip3DContextMenuStore` when the user right-clicks a 3D reshape grip; this leaf
 * renders the ONE context-appropriate action and dispatches it through the SHARED SSoT:
 *   - a VERTEX grip  → «Διαγραφή κορυφής» → delete-corner
 *   - a MIDPOINT grip → «Εισαγωγή κορυφής» → add-corner (insert at the edge midpoint)
 *
 * Dispatch reuses `buildFootprintVertexOpCommand` (the SAME builder the 2D grip menu
 * uses, ADR-535 Φ4) over the level-scene adapter + global command history — so a 3D
 * vertex edit is one undo step and the scene re-syncs automatically (slab / roof /
 * floor-finish / slab-opening, all four). ADR-040: a leaf React component, no canvas
 * orchestrator subscription.
 */

import { useTranslation } from 'react-i18next';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useLevelsOptional } from '../../../systems/levels/useLevels';
import { useGrip3DContextMenuStore } from '../../stores/Grip3DContextMenuStore';
import { toUnifiedGrip } from '../../grips/grip-3d-commit';
import { createLevelSceneManagerAdapter } from '../../../systems/entity-creation/LevelSceneManagerAdapter';
import { getGlobalCommandHistory } from '../../../core/commands';
import { buildFootprintVertexOpCommand, type FootprintVertexMenuOp } from '../../../systems/grip/footprint-grip-ops';

export function Grip3DVertexContextMenu() {
  const { t } = useTranslation('bim3d');
  const levels = useLevelsOptional();
  const open = useGrip3DContextMenuStore((s) => s.open);
  const screen = useGrip3DContextMenuStore((s) => s.screen);
  const grip = useGrip3DContextMenuStore((s) => s.grip);
  const hide = useGrip3DContextMenuStore((s) => s.hide);

  if (!open || !screen || !grip) return null;

  const isVertex = grip.type === 'vertex';
  const op: FootprintVertexMenuOp = isVertex ? 'delete-corner' : 'add-corner';
  const label = isVertex ? t('grips3d.contextMenu.deleteVertex') : t('grips3d.contextMenu.insertVertex');

  const run = () => {
    if (levels?.currentLevelId) {
      const adapter = createLevelSceneManagerAdapter(levels.getLevelScene, levels.setLevelScene, levels.currentLevelId);
      const cmd = buildFootprintVertexOpCommand(toUnifiedGrip(grip), op, adapter);
      if (cmd) getGlobalCommandHistory().execute(cmd);
    }
    hide();
  };

  return (
    <DropdownMenu open onOpenChange={(o) => { if (!o) hide(); }}>
      {/* 1×1 invisible anchor positioned at the right-click coordinates */}
      <DropdownMenuTrigger asChild>
        <span
          className="fixed w-px h-px pointer-events-none"
          style={{ left: screen.x, top: screen.y }}
          aria-label={t('grips3d.contextMenu.aria')}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        sideOffset={0}
        className="z-[200] min-w-[160px]"
        onEscapeKeyDown={hide}
        onPointerDownOutside={hide}
      >
        <DropdownMenuLabel className="text-xs font-semibold">
          {t('grips3d.contextMenu.title')}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={run}>{label}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
