'use client';

/**
 * 🏢 ENTERPRISE: DrawingContextMenu Component
 * AutoCAD/BricsCAD-style right-click context menu for drawing tools
 *
 * Features:
 * - Enter: Finish current drawing (polyline/polygon/continuous measurement)
 * - Close: Close polygon (connect last to first point)
 * - Undo: Remove last point
 * - Cancel: Cancel current drawing (ESC)
 *
 * @see ADR-047: Drawing Tool Keyboard Shortcuts & Context Menu
 * @see centralized_systems.md - Rule: Drawing Tools
 *
 * @author Γιώργος Παγώνης + Claude Code (Anthropic AI)
 * @since 2026-01-30
 * @version 1.0.0
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
import type { ToolType } from '../toolbar/types';

// ===== TYPES =====

interface DrawingContextMenuProps {
  /** Whether the menu is open */
  isOpen: boolean;
  /** Callback when menu open state changes */
  onOpenChange: (open: boolean) => void;
  /** Position of the menu (CSS coordinates) */
  position: { x: number; y: number };
  /** Current active drawing tool */
  activeTool: ToolType;
  /** Number of points in current drawing */
  pointCount: number;
  /** Callback for Enter/Finish action */
  onFinish: () => void;
  /** Callback for Close polygon action */
  onClose?: () => void;
  /** Callback for Undo last point action */
  onUndoLastPoint?: () => void;
  /** Callback for Cancel action */
  onCancel: () => void;
}

// ===== ICONS =====

function EnterIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 10 4 15 9 20" />
      <path d="M20 4v7a4 4 0 0 1-4 4H4" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  );
}

function UndoIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7v6h6" />
      <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
    </svg>
  );
}

function CancelIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  );
}

// ===== HELPER FUNCTIONS =====

/**
 * Determines if the current tool supports the Close action (polygon closure)
 */
function supportsClose(tool: ToolType): boolean {
  return tool === 'polygon' || tool === 'measure-area';
}

/**
 * Determines if the current tool supports multi-point drawing
 */
function isMultiPointTool(tool: ToolType): boolean {
  return [
    'polyline',
    'polygon',
    'measure-area',
    'measure-angle',
    'measure-distance-continuous'
  ].includes(tool);
}

/**
 * Get the minimum points required for Enter/Finish
 * 🏢 ENTERPRISE (2026-01-30): Different tools have different requirements
 */
function getMinPointsForFinish(tool: ToolType): number {
  // 🎯 ADR-053: measure-distance-continuous auto-creates entities every 2 points
  // "Enter" just means "stop drawing" - no minimum required
  if (tool === 'measure-distance-continuous') {
    return 0; // Always allow finish (entities are auto-created)
  }
  if (tool === 'polygon' || tool === 'measure-area') {
    return 3; // Polygon needs at least 3 points
  }
  if (tool === 'measure-angle') {
    return 3; // Angle needs 3 points
  }
  return 2; // Polyline needs at least 2
}

// ===== MAIN COMPONENT =====

export default function DrawingContextMenu({
  isOpen,
  onOpenChange,
  position,
  activeTool,
  pointCount,
  onFinish,
  onClose,
  onUndoLastPoint,
  onCancel,
}: DrawingContextMenuProps) {
  const triggerRef = useRef<HTMLSpanElement>(null);

  // Update trigger position when menu opens
  useEffect(() => {
    if (isOpen && triggerRef.current) {
      triggerRef.current.style.left = `${position.x}px`;
      triggerRef.current.style.top = `${position.y}px`;
    }
  }, [isOpen, position]);

  // ===== ACTION HANDLERS =====

  const handleFinish = useCallback(() => {
    onFinish();
    onOpenChange(false);
  }, [onFinish, onOpenChange]);

  const handleClose = useCallback(() => {
    if (onClose) {
      onClose();
    } else {
      // Fallback: use onFinish for close action
      onFinish();
    }
    onOpenChange(false);
  }, [onClose, onFinish, onOpenChange]);

  const handleUndo = useCallback(() => {
    if (onUndoLastPoint) {
      onUndoLastPoint();
    }
    onOpenChange(false);
  }, [onUndoLastPoint, onOpenChange]);

  const handleCancel = useCallback(() => {
    onCancel();
    onOpenChange(false);
  }, [onCancel, onOpenChange]);

  // ===== COMPUTED VALUES =====

  const canFinish = pointCount >= getMinPointsForFinish(activeTool);
  const canClose = supportsClose(activeTool) && pointCount >= 3;
  const canUndo = pointCount > 0 && onUndoLastPoint !== undefined;
  const showCloseOption = supportsClose(activeTool);

  // ===== RENDER =====

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
        {/* Enter / Finish */}
        <DropdownMenuItem
          className={cn(styles.menuItem, !canFinish && styles.menuItemDisabled)}
          onClick={handleFinish}
          disabled={!canFinish}
        >
          <span className={styles.menuItemIcon}><EnterIcon /></span>
          <span className={styles.menuItemLabel}>Enter</span>
          <span className={styles.menuItemShortcut}>Enter</span>
        </DropdownMenuItem>

        {/* Close (for polygon tools only) */}
        {showCloseOption && (
          <DropdownMenuItem
            className={cn(styles.menuItem, !canClose && styles.menuItemDisabled)}
            onClick={handleClose}
            disabled={!canClose}
          >
            <span className={styles.menuItemIcon}><CloseIcon /></span>
            <span className={styles.menuItemLabel}>Close</span>
            <span className={styles.menuItemShortcut}>C</span>
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator className={styles.menuSeparator} />

        {/* Undo Last Point */}
        <DropdownMenuItem
          className={cn(styles.menuItem, !canUndo && styles.menuItemDisabled)}
          onClick={handleUndo}
          disabled={!canUndo}
        >
          <span className={styles.menuItemIcon}><UndoIcon /></span>
          <span className={styles.menuItemLabel}>Undo</span>
          <span className={styles.menuItemShortcut}>U</span>
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
export { DrawingContextMenu };
export type { DrawingContextMenuProps };
