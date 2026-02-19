/**
 * @module ui/components/GuideContextMenu
 * @description Right-click context menu for construction guides (ADR-189).
 *
 * Shows when right-clicking near a construction guide:
 * - Delete guide (G→D)
 * - Lock / Unlock
 * - Edit label (opens PromptDialog)
 * - Toggle all guides visibility (G→V)
 * - Cancel
 *
 * Uses the same imperative handle pattern as EntityContextMenu / DrawingContextMenu
 * to avoid parent re-renders on open/close.
 *
 * @see ADR-189: Construction Grid & Guide System
 * @see ADR-047: Drawing Tool Keyboard Shortcuts & Context Menu (pattern reference)
 * @since 2026-02-20
 */

'use client';

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
import { Trash2, Lock, Unlock, Tag, Eye, EyeOff, X } from 'lucide-react';
import type { Guide } from '../../systems/guides/guide-types';

// ===== TYPES =====

/** Imperative handle exposed via ref — parent calls open() to show menu */
export interface GuideContextMenuHandle {
  open: (x: number, y: number, guide: Guide) => void;
  close: () => void;
}

interface GuideContextMenuProps {
  /** Callback for Delete action */
  onDelete: (guideId: string) => void;
  /** Callback for Lock/Unlock toggle */
  onToggleLock: (guideId: string) => void;
  /** Callback for Edit Label action (opens PromptDialog) */
  onEditLabel: (guideId: string, currentLabel: string | null) => void;
  /** Callback for Toggle visibility of all guides */
  onToggleVisibility: () => void;
  /** Whether guides are currently visible */
  guidesVisible: boolean;
  /** Callback for Cancel/close action */
  onCancel: () => void;
}

// ===== MAIN COMPONENT =====

const GuideContextMenuInner = forwardRef<GuideContextMenuHandle, GuideContextMenuProps>(({
  onDelete,
  onToggleLock,
  onEditLabel,
  onToggleVisibility,
  guidesVisible,
  onCancel,
}, ref) => {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [targetGuide, setTargetGuide] = useState<Guide | null>(null);

  // Imperative handle — parent calls open(x, y, guide) directly
  useImperativeHandle(ref, () => ({
    open: (x: number, y: number, guide: Guide) => {
      if (triggerRef.current) {
        triggerRef.current.style.left = `${x}px`;
        triggerRef.current.style.top = `${y}px`;
      }
      setTargetGuide(guide);
      setIsOpen(true);
    },
    close: () => {
      setIsOpen(false);
      setTargetGuide(null);
    },
  }), []);

  const handleOpenChange = useCallback((open: boolean) => {
    setIsOpen(open);
    if (!open) setTargetGuide(null);
  }, []);

  const handleDelete = useCallback(() => {
    if (targetGuide) onDelete(targetGuide.id);
    setIsOpen(false);
    setTargetGuide(null);
  }, [targetGuide, onDelete]);

  const handleToggleLock = useCallback(() => {
    if (targetGuide) onToggleLock(targetGuide.id);
    setIsOpen(false);
    setTargetGuide(null);
  }, [targetGuide, onToggleLock]);

  const handleEditLabel = useCallback(() => {
    if (targetGuide) onEditLabel(targetGuide.id, targetGuide.label);
    setIsOpen(false);
    setTargetGuide(null);
  }, [targetGuide, onEditLabel]);

  const handleToggleVisibility = useCallback(() => {
    onToggleVisibility();
    setIsOpen(false);
    setTargetGuide(null);
  }, [onToggleVisibility]);

  const handleCancel = useCallback(() => {
    onCancel();
    setIsOpen(false);
    setTargetGuide(null);
  }, [onCancel]);

  const isLocked = targetGuide?.locked ?? false;
  const axisLabel = targetGuide?.axis === 'X' ? 'X' : 'Z';

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
        {/* Header: Guide axis + offset */}
        {targetGuide && (
          <>
            <DropdownMenuItem className={cn(styles.menuItem, styles.menuItemDisabled)} disabled>
              <span className={styles.menuItemLabel}>
                {axisLabel} @ {targetGuide.offset.toFixed(1)}
                {targetGuide.label ? ` — ${targetGuide.label}` : ''}
              </span>
            </DropdownMenuItem>
            <DropdownMenuSeparator className={styles.menuSeparator} />
          </>
        )}

        {/* Edit Label */}
        <DropdownMenuItem
          className={styles.menuItem}
          onClick={handleEditLabel}
        >
          <span className={styles.menuItemIcon}><Tag size={16} /></span>
          <span className={styles.menuItemLabel}>Edit Label</span>
        </DropdownMenuItem>

        {/* Lock / Unlock */}
        <DropdownMenuItem
          className={styles.menuItem}
          onClick={handleToggleLock}
        >
          <span className={styles.menuItemIcon}>
            {isLocked ? <Unlock size={16} /> : <Lock size={16} />}
          </span>
          <span className={styles.menuItemLabel}>
            {isLocked ? 'Unlock' : 'Lock'}
          </span>
        </DropdownMenuItem>

        <DropdownMenuSeparator className={styles.menuSeparator} />

        {/* Delete */}
        <DropdownMenuItem
          className={cn(styles.menuItem, isLocked && styles.menuItemDisabled)}
          onClick={handleDelete}
          disabled={isLocked}
        >
          <span className={styles.menuItemIcon}><Trash2 size={16} /></span>
          <span className={styles.menuItemLabel}>Delete</span>
          <span className={styles.menuItemShortcut}>G→D</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator className={styles.menuSeparator} />

        {/* Toggle All Guides Visibility */}
        <DropdownMenuItem
          className={styles.menuItem}
          onClick={handleToggleVisibility}
        >
          <span className={styles.menuItemIcon}>
            {guidesVisible ? <EyeOff size={16} /> : <Eye size={16} />}
          </span>
          <span className={styles.menuItemLabel}>
            {guidesVisible ? 'Hide All' : 'Show All'}
          </span>
          <span className={styles.menuItemShortcut}>G→V</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator className={styles.menuSeparator} />

        {/* Cancel */}
        <DropdownMenuItem
          className={styles.menuItem}
          onClick={handleCancel}
        >
          <span className={styles.menuItemIcon}><X size={16} /></span>
          <span className={styles.menuItemLabel}>Cancel</span>
          <span className={styles.menuItemShortcut}>Esc</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
});

GuideContextMenuInner.displayName = 'GuideContextMenu';

// Default export for backward compatibility
export default GuideContextMenuInner;

// ===== NAMED EXPORTS =====
export { GuideContextMenuInner as GuideContextMenu };
export type { GuideContextMenuProps };
