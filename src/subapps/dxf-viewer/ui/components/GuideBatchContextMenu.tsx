/**
 * @module ui/components/GuideBatchContextMenu
 * @description Right-click context menu for batch operations on selected guides (ADR-189 B14).
 *
 * Shows when right-clicking with multiple guides selected:
 * - Delete selected (skips locked)
 * - Lock / Unlock all selected
 * - Change color for all selected
 * - Group selected (B7 integration)
 * - Cancel
 *
 * Uses the same imperative handle pattern as GuideContextMenu.
 *
 * @see ADR-189 B14: Multi-select guides
 * @since 2026-03-06
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
import colorStyles from './GuideColorPalette.module.css';
import { cn } from '@/lib/utils';
import { Trash2, Lock, Unlock, X, Palette, RotateCcw, FolderPlus } from 'lucide-react';
import { useTranslation } from '@/i18n';
import { GUIDE_COLOR_PALETTE } from '../../systems/guides/guide-types';

// ===== TYPES =====

/** Imperative handle exposed via ref — parent calls open() to show menu */
export interface GuideBatchContextMenuHandle {
  open: (x: number, y: number, count: number) => void;
  close: () => void;
}

export interface GuideBatchContextMenuProps {
  onDeleteSelected: () => void;
  onLockSelected: () => void;
  onUnlockSelected: () => void;
  onChangeColor: (color: string | null) => void;
  onGroupSelected: () => void;
  onCancel: () => void;
}

// ===== COMPONENT =====

const GuideBatchContextMenuInner = forwardRef<GuideBatchContextMenuHandle, GuideBatchContextMenuProps>(
  function GuideBatchContextMenu(
    { onDeleteSelected, onLockSelected, onUnlockSelected, onChangeColor, onGroupSelected, onCancel },
    ref,
  ) {
    const { t } = useTranslation('dxf-viewer');
    const [isOpen, setIsOpen] = useState(false);
    const [selectedCount, setSelectedCount] = useState(0);
    const [showColors, setShowColors] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);

    useImperativeHandle(ref, () => ({
      open: (x: number, y: number, count: number) => {
        if (triggerRef.current) {
          triggerRef.current.style.left = `${x}px`;
          triggerRef.current.style.top = `${y}px`;
        }
        setSelectedCount(count);
        setShowColors(false);
        setIsOpen(true);
      },
      close: () => {
        setIsOpen(false);
        setShowColors(false);
      },
    }));

    const handleOpenChange = useCallback((open: boolean) => {
      setIsOpen(open);
      if (!open) {
        setShowColors(false);
        onCancel();
      }
    }, [onCancel]);

    return (
      <DropdownMenu open={isOpen} onOpenChange={handleOpenChange}>
        <DropdownMenuTrigger asChild>
          <button
            ref={triggerRef}
            className={styles.hiddenTrigger}
            aria-hidden
            tabIndex={-1}
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent className={cn(styles.menuContent, 'min-w-[200px]')} align="start" side="bottom" sideOffset={0} avoidCollisions={false}>
          {/* Header: selection count */}
          <DropdownMenuItem disabled className={styles.menuHeader}>
            {t('guideBatchMenu.selectedCount', { count: selectedCount })}
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Color */}
          <DropdownMenuItem
            className={styles.menuItem}
            onSelect={(e) => { e.preventDefault(); setShowColors(prev => !prev); }}
          >
            <Palette className={styles.menuIcon} />
            {t('guideBatchMenu.colorSelected')}
          </DropdownMenuItem>

          {showColors && (
            <div className={colorStyles.colorPaletteRow}>
              {GUIDE_COLOR_PALETTE.map((c) => (
                <button
                  key={c.hex}
                  className={colorStyles.colorSwatch}
                  style={{ backgroundColor: c.hex }}
                  title={c.name}
                  onClick={() => { onChangeColor(c.hex); setIsOpen(false); }}
                />
              ))}
              <button
                className={colorStyles.colorResetButton}
                onClick={() => { onChangeColor(null); setIsOpen(false); }}
                title="Reset"
              >
                <RotateCcw size={12} />
              </button>
            </div>
          )}

          {/* Lock / Unlock */}
          <DropdownMenuItem
            className={styles.menuItem}
            onSelect={() => { onLockSelected(); setIsOpen(false); }}
          >
            <Lock className={styles.menuIcon} />
            {t('guideBatchMenu.lockSelected')}
          </DropdownMenuItem>

          <DropdownMenuItem
            className={styles.menuItem}
            onSelect={() => { onUnlockSelected(); setIsOpen(false); }}
          >
            <Unlock className={styles.menuIcon} />
            {t('guideBatchMenu.unlockSelected')}
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Group */}
          <DropdownMenuItem
            className={styles.menuItem}
            onSelect={() => { onGroupSelected(); setIsOpen(false); }}
          >
            <FolderPlus className={styles.menuIcon} />
            {t('guideBatchMenu.groupSelected')}
          </DropdownMenuItem>

          {/* Delete */}
          <DropdownMenuItem
            className={cn(styles.menuItem, styles.menuItemDestructive)}
            onSelect={() => { onDeleteSelected(); setIsOpen(false); }}
          >
            <Trash2 className={styles.menuIcon} />
            {t('guideBatchMenu.deleteSelected')}
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Cancel */}
          <DropdownMenuItem
            className={styles.menuItem}
            onSelect={() => { setIsOpen(false); onCancel(); }}
          >
            <X className={styles.menuIcon} />
            {t('guideBatchMenu.cancel')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  },
);

GuideBatchContextMenuInner.displayName = 'GuideBatchContextMenu';

export default GuideBatchContextMenuInner;
export { GuideBatchContextMenuInner as GuideBatchContextMenu };
