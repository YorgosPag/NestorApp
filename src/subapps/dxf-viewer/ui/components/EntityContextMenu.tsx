'use client';

/**
 * EntityContextMenu Component
 * AutoCAD-style right-click context menu for entity operations in SELECT mode.
 *
 * Shows when right-clicking with 1+ entities selected:
 * - Join (J) — enabled only with 2+ mergeable entities
 * - Delete (Del) — always enabled
 * - Cancel (Esc) — close menu
 *
 * 🏢 PERF (2026-02-19): Imperative handle pattern — parent calls open(x,y)
 * instead of passing isOpen/position props. Prevents CanvasLayerStack re-render.
 *
 * @see ADR-161: Entity Join System
 * @see ADR-047: Drawing Tool Keyboard Shortcuts & Context Menu (pattern reference)
 * @see DxfContextMenu — shared context menu SSoT
 */

import React, { useCallback, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DxfMenuContent,
  DxfMenuItem,
  DxfMenuSeparator,
  DxfMenuHiddenTrigger,
  DxfMenuIcon,
  DxfMenuLabel,
  DxfMenuShortcut,
} from './dxf-context-menu';
import { JoinIcon, DeleteIcon, CancelIcon, SplitWallIcon } from '../icons/MenuIcons';

// ===== TYPES =====

/** Imperative handle exposed via ref — parent calls open() to show menu */
export interface EntityContextMenuHandle {
  open: (x: number, y: number) => void;
  close: () => void;
}

interface EntityContextMenuProps {
  /** Number of currently selected entities */
  selectedCount: number;
  /** Whether Join is possible for current selection */
  canJoin: boolean;
  /** Predicted result type label (for tooltip) */
  joinResultLabel?: string;
  /** Callback for Join action */
  onJoin: () => void;
  /** Callback for Delete action */
  onDelete: () => void;
  /** Callback for Cancel/close action */
  onCancel: () => void;
  /**
   * ADR-358 §5.6.bis Phase 10 — layer-scope click-driven commands.
   * When omitted (or `canApplyLayerCommands` is false) the layer rows are hidden.
   */
  canApplyLayerCommands?: boolean;
  /** True for Layer "0" — disables Off/Freeze/Lock (system layer). */
  isSystemLayer?: boolean;
  onLayerOff?: () => void;
  onLayerFreeze?: () => void;
  onLayerLock?: () => void;
  /** ADR-363 Phase 5.6 — shown only when a single wall is selected. */
  canSplit?: boolean;
  onSplit?: () => void;
}

// ===== MAIN COMPONENT =====

const EntityContextMenuInner = forwardRef<EntityContextMenuHandle, EntityContextMenuProps>(({
  selectedCount,
  canJoin,
  joinResultLabel,
  onJoin,
  onDelete,
  onCancel,
  canApplyLayerCommands,
  isSystemLayer,
  onLayerOff,
  onLayerFreeze,
  onLayerLock,
  canSplit,
  onSplit,
}, ref) => {
  const { t } = useTranslation('dxf-viewer');
  const triggerRef = useRef<HTMLSpanElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  useImperativeHandle(ref, () => ({
    open: (x: number, y: number) => {
      if (triggerRef.current) {
        triggerRef.current.style.left = `${x}px`;
        triggerRef.current.style.top = `${y}px`;
      }
      setIsOpen(true);
    },
    close: () => setIsOpen(false),
  }), []);

  const handleOpenChange = useCallback((open: boolean) => { setIsOpen(open); }, []);
  const handleJoin = useCallback(() => { onJoin(); setIsOpen(false); }, [onJoin]);
  const handleDelete = useCallback(() => { onDelete(); setIsOpen(false); }, [onDelete]);
  const handleCancel = useCallback(() => { onCancel(); setIsOpen(false); }, [onCancel]);
  const handleLayerOff = useCallback(() => { onLayerOff?.(); setIsOpen(false); }, [onLayerOff]);
  const handleLayerFreeze = useCallback(() => { onLayerFreeze?.(); setIsOpen(false); }, [onLayerFreeze]);
  const handleLayerLock = useCallback(() => { onLayerLock?.(); setIsOpen(false); }, [onLayerLock]);
  const handleSplit = useCallback(() => { onSplit?.(); setIsOpen(false); }, [onSplit]);

  const showLayerCommands = !!(canApplyLayerCommands && (onLayerOff || onLayerFreeze || onLayerLock));
  const layerCommandsDisabled = !!isSystemLayer;

  return (
    <DropdownMenu open={isOpen} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <DxfMenuHiddenTrigger ref={triggerRef} />
      </DropdownMenuTrigger>
      <DxfMenuContent>
        <DxfMenuItem onClick={handleJoin} disabled={!canJoin}>
          <DxfMenuIcon><JoinIcon /></DxfMenuIcon>
          <DxfMenuLabel>Join{joinResultLabel ? ` → ${joinResultLabel}` : ''}</DxfMenuLabel>
          <DxfMenuShortcut>J</DxfMenuShortcut>
        </DxfMenuItem>

        {canSplit && (
          <>
            <DxfMenuSeparator />
            <DxfMenuItem onClick={handleSplit}>
              <DxfMenuIcon><SplitWallIcon /></DxfMenuIcon>
              <DxfMenuLabel>{t('contextMenu.entity.splitWall')}</DxfMenuLabel>
            </DxfMenuItem>
          </>
        )}

        {showLayerCommands && (
          <>
            <DxfMenuSeparator />
            {onLayerOff && (
              <DxfMenuItem onClick={handleLayerOff} disabled={layerCommandsDisabled}>
                <DxfMenuLabel>{t('layer.isolate.contextMenu.off')}</DxfMenuLabel>
              </DxfMenuItem>
            )}
            {onLayerFreeze && (
              <DxfMenuItem onClick={handleLayerFreeze} disabled={layerCommandsDisabled}>
                <DxfMenuLabel>{t('layer.isolate.contextMenu.freeze')}</DxfMenuLabel>
              </DxfMenuItem>
            )}
            {onLayerLock && (
              <DxfMenuItem onClick={handleLayerLock} disabled={layerCommandsDisabled}>
                <DxfMenuLabel>{t('layer.isolate.contextMenu.lock')}</DxfMenuLabel>
              </DxfMenuItem>
            )}
          </>
        )}

        <DxfMenuSeparator />

        <DxfMenuItem onClick={handleDelete}>
          <DxfMenuIcon><DeleteIcon /></DxfMenuIcon>
          <DxfMenuLabel>Delete ({selectedCount})</DxfMenuLabel>
          <DxfMenuShortcut>Del</DxfMenuShortcut>
        </DxfMenuItem>

        <DxfMenuSeparator />

        <DxfMenuItem onClick={handleCancel}>
          <DxfMenuIcon><CancelIcon /></DxfMenuIcon>
          <DxfMenuLabel>Cancel</DxfMenuLabel>
          <DxfMenuShortcut>Esc</DxfMenuShortcut>
        </DxfMenuItem>
      </DxfMenuContent>
    </DropdownMenu>
  );
});

EntityContextMenuInner.displayName = 'EntityContextMenu';

export default EntityContextMenuInner;
export { EntityContextMenuInner as EntityContextMenu };
export type { EntityContextMenuProps };
