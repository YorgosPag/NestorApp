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
 * @see ADR-161: Entity Join System
 * @see ADR-047: Drawing Tool Keyboard Shortcuts & Context Menu (pattern reference)
 */

import React, { useCallback, useRef, useEffect } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import styles from './DrawingContextMenu.module.css';
import { JoinIcon, DeleteIcon, CancelIcon } from '../icons/MenuIcons';

// ===== TYPES =====

interface EntityContextMenuProps {
  /** Whether the menu is open */
  isOpen: boolean;
  /** Callback when menu open state changes */
  onOpenChange: (open: boolean) => void;
  /** Position of the menu (CSS coordinates) */
  position: { x: number; y: number };
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

export default function EntityContextMenu({
  isOpen,
  onOpenChange,
  position,
  selectedCount,
  canJoin,
  joinResultLabel,
  onJoin,
  onDelete,
  onCancel,
}: EntityContextMenuProps) {
  const triggerRef = useRef<HTMLSpanElement>(null);

  // Update trigger position when menu opens
  useEffect(() => {
    if (isOpen && triggerRef.current) {
      triggerRef.current.style.left = `${position.x}px`;
      triggerRef.current.style.top = `${position.y}px`;
    }
  }, [isOpen, position]);

  const handleJoin = useCallback(() => {
    onJoin();
    onOpenChange(false);
  }, [onJoin, onOpenChange]);

  const handleDelete = useCallback(() => {
    onDelete();
    onOpenChange(false);
  }, [onDelete, onOpenChange]);

  const handleCancel = useCallback(() => {
    onCancel();
    onOpenChange(false);
  }, [onCancel, onOpenChange]);

  return (
    <DropdownMenu open={isOpen} onOpenChange={onOpenChange}>
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
}

// ===== NAMED EXPORT FOR BARREL =====
export { EntityContextMenu };
export type { EntityContextMenuProps };
