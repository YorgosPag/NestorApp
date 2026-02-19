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
 */

import React, { useCallback, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import styles from './DrawingContextMenu.module.css';
import { cn } from '@/lib/utils';
import { JoinIcon, DeleteIcon, CancelIcon } from '../icons/MenuIcons';

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
}

// ===== MAIN COMPONENT =====

const EntityContextMenuInner = forwardRef<EntityContextMenuHandle, EntityContextMenuProps>(({
  selectedCount,
  canJoin,
  joinResultLabel,
  onJoin,
  onDelete,
  onCancel,
}, ref) => {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  // 🏢 PERF: Imperative handle — parent calls open(x, y) directly
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

  const handleOpenChange = useCallback((open: boolean) => {
    setIsOpen(open);
  }, []);

  const handleJoin = useCallback(() => {
    onJoin();
    setIsOpen(false);
  }, [onJoin]);

  const handleDelete = useCallback(() => {
    onDelete();
    setIsOpen(false);
  }, [onDelete]);

  const handleCancel = useCallback(() => {
    onCancel();
    setIsOpen(false);
  }, [onCancel]);

  return (
    <DropdownMenu open={isOpen} onOpenChange={handleOpenChange}>
      {/* Hidden trigger positioned at right-click location */}
      <DropdownMenuTrigger asChild>
        <span
          ref={triggerRef}
          className={styles.hiddenTrigger}
          aria-hidden="true"
        />
      </DropdownMenuTrigger>

      <DropdownMenuContent
        className={styles.menuContent}
        side="bottom"
        align="start"
        sideOffset={0}
      >
        {/* Join */}
        <DropdownMenuItem
          className={cn(styles.menuItem, !canJoin && styles.menuItemDisabled)}
          onClick={handleJoin}
          disabled={!canJoin}
        >
          <span className={styles.menuItemIcon}><JoinIcon /></span>
          <span className={styles.menuItemLabel}>
            Join{joinResultLabel ? ` → ${joinResultLabel}` : ''}
          </span>
          <span className={styles.menuItemShortcut}>J</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator className={styles.menuSeparator} />

        {/* Delete */}
        <DropdownMenuItem
          className={styles.menuItem}
          onClick={handleDelete}
        >
          <span className={styles.menuItemIcon}><DeleteIcon /></span>
          <span className={styles.menuItemLabel}>
            Delete ({selectedCount})
          </span>
          <span className={styles.menuItemShortcut}>Del</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator className={styles.menuSeparator} />

        {/* Cancel */}
        <DropdownMenuItem
          className={styles.menuItem}
          onClick={handleCancel}
        >
          <span className={styles.menuItemIcon}><CancelIcon /></span>
          <span className={styles.menuItemLabel}>Cancel</span>
          <span className={styles.menuItemShortcut}>Esc</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
});

EntityContextMenuInner.displayName = 'EntityContextMenu';

// Default export for backward compatibility
export default EntityContextMenuInner;

// ===== NAMED EXPORTS =====
export { EntityContextMenuInner as EntityContextMenu };
export type { EntityContextMenuProps, EntityContextMenuHandle };
