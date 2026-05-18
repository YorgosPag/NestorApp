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
 * 🏢 PERF (2026-02-19): Imperative handle pattern — parent calls open(x,y)
 * instead of passing isOpen/position props. This prevents re-rendering the
 * entire CanvasLayerStack when the menu opens (saved ~94ms per right-click).
 *
 * @see ADR-047: Drawing Tool Keyboard Shortcuts & Context Menu
 * @see ADR-053 in docs/centralized-systems/reference/adr-index.md
 *
 * @author Γιώργος Παγώνης + Claude Code (Anthropic AI)
 * @since 2026-01-30
 * @version 2.0.0
 */

import React, { useCallback, useRef, useEffect, useState, useImperativeHandle, forwardRef } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { SnapOverrideMode } from '../../snapping/overrides/SnapOverrideOrchestrator';
import { cn } from '@/lib/utils';
import styles from './DrawingContextMenu.module.css';
import type { ToolType } from '../toolbar/types';
// 🏢 ENTERPRISE (2026-02-01): Centralized Menu Icons - ADR-133
import {
  EnterIcon,
  ClosePolygonIcon,
  UndoIcon,
  CancelIcon,
  FlipArcIcon,
} from '../icons/MenuIcons';
import { useTranslation } from '@/i18n/hooks/useTranslation';

// ===== TYPES =====

/** Imperative handle exposed via ref — parent calls open() to show menu */
export interface DrawingContextMenuHandle {
  open: (x: number, y: number) => void;
  close: () => void;
}

interface DrawingContextMenuProps {
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
  /** 🏢 ENTERPRISE (2026-01-31): Callback for Flip Arc direction */
  onFlipArc?: () => void;
  /** ADR-357 Phase 7: Snap Override — activates single-use engine override */
  onSnapOverride?: (mode: SnapOverrideMode) => void;
}

// ADR-357 Phase 7: Single-use engine overrides available in the Snap Override submenu.
// Maps ExtendedSnapType string values to their i18n label keys (reuses snapModes.labels).
const SNAP_OVERRIDE_ENGINES: ReadonlyArray<{ type: string; labelKey: string }> = [
  { type: 'endpoint',     labelKey: 'snapModes.labels.endpoint' },
  { type: 'midpoint',     labelKey: 'snapModes.labels.midpoint' },
  { type: 'center',       labelKey: 'snapModes.labels.center' },
  { type: 'intersection', labelKey: 'snapModes.labels.intersection' },
  { type: 'perpendicular',labelKey: 'snapModes.labels.perpendicular' },
  { type: 'tangent',      labelKey: 'snapModes.labels.tangent' },
  { type: 'quadrant',     labelKey: 'snapModes.labels.quadrant' },
  { type: 'nearest',      labelKey: 'snapModes.labels.nearest' },
] as const;

// ===== HELPER FUNCTIONS =====

/**
 * Determines if the current tool supports the Close action (polygon closure)
 */
function supportsClose(tool: ToolType): boolean {
  return tool === 'polygon' || tool === 'measure-area';
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
  // 🏢 ENTERPRISE (2026-01-31): Circle best-fit needs at least 3 points - ADR-083
  if (tool === 'circle-best-fit') {
    return 3; // Circle best-fit needs at least 3 points
  }
  // ADR-357 Phase 5: line chain mode — allow Finish with 1 seeded chain start point
  if (tool === 'line') {
    return 1;
  }
  return 2; // Polyline needs at least 2
}

/**
 * 🏢 ENTERPRISE (2026-01-31): Determines if the current tool is an arc tool
 * Arc tools support direction flip (counterclockwise toggle)
 */
function isArcTool(tool: ToolType): boolean {
  return tool === 'arc-3p' || tool === 'arc-cse' || tool === 'arc-sce';
}

// ===== MAIN COMPONENT =====

const DrawingContextMenuInner = forwardRef<DrawingContextMenuHandle, DrawingContextMenuProps>(({
  activeTool,
  pointCount,
  onFinish,
  onClose,
  onUndoLastPoint,
  onCancel,
  onFlipArc,
  onSnapOverride,
}, ref) => {
  const { t } = useTranslation(['dxf-viewer', 'dxf-viewer-settings', 'dxf-viewer-wizard', 'dxf-viewer-guides', 'dxf-viewer-panels', 'dxf-viewer-shell']);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  // 🏢 PERF: Imperative handle — parent calls open(x, y) directly
  // Position is set via DOM manipulation (no state update for position)
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

  // ===== ACTION HANDLERS =====

  const handleFinish = useCallback(() => {
    onFinish();
    setIsOpen(false);
  }, [onFinish]);

  const handleClose = useCallback(() => {
    if (onClose) {
      onClose();
    } else {
      onFinish();
    }
    setIsOpen(false);
  }, [onClose, onFinish]);

  const handleUndo = useCallback(() => {
    if (onUndoLastPoint) {
      onUndoLastPoint();
    }
    setIsOpen(false);
  }, [onUndoLastPoint]);

  const handleCancel = useCallback(() => {
    onCancel();
    setIsOpen(false);
  }, [onCancel]);

  // 🏢 ENTERPRISE (2026-01-31): Flip arc direction handler
  const handleFlipArc = useCallback(() => {
    if (onFlipArc) {
      onFlipArc();
    }
    setIsOpen(false);
  }, [onFlipArc]);

  // ADR-357 Phase 7: Snap Override handler
  const handleSnapOverride = useCallback((mode: SnapOverrideMode) => {
    if (onSnapOverride) {
      onSnapOverride(mode);
    }
    setIsOpen(false);
  }, [onSnapOverride]);

  // Close menu when tool/points change (user switched context)
  const prevToolRef = useRef(activeTool);
  useEffect(() => {
    if (prevToolRef.current !== activeTool && isOpen) {
      setIsOpen(false);
    }
    prevToolRef.current = activeTool;
  }, [activeTool, isOpen]);

  // ===== COMPUTED VALUES =====

  const canFinish = pointCount >= getMinPointsForFinish(activeTool);
  const canClose = supportsClose(activeTool) && pointCount >= 3;
  const canUndo = pointCount > 0 && onUndoLastPoint !== undefined;
  const showCloseOption = supportsClose(activeTool);
  // 🏢 ENTERPRISE (2026-01-31): Arc flip option visibility
  const showFlipArcOption = isArcTool(activeTool) && pointCount >= 2 && onFlipArc !== undefined;
  // ADR-357 Phase 7: Snap Override submenu — only during line COLLECTING_POINTS
  const showSnapOverride = activeTool === 'line' && pointCount >= 1 && onSnapOverride !== undefined;

  // ===== RENDER =====

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
        avoidCollisions={false}
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
            <span className={styles.menuItemIcon}><ClosePolygonIcon /></span>
            <span className={styles.menuItemLabel}>Close</span>
            <span className={styles.menuItemShortcut}>C</span>
          </DropdownMenuItem>
        )}

        {/* 🏢 ENTERPRISE (2026-01-31): Flip Arc Direction (for arc tools only) */}
        {showFlipArcOption && (
          <DropdownMenuItem
            className={styles.menuItem}
            onClick={handleFlipArc}
          >
            <span className={styles.menuItemIcon}><FlipArcIcon /></span>
            <span className={styles.menuItemLabel}>{t('contextMenu.flipArc')}</span>
            <span className={styles.menuItemShortcut}>X</span>
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

        {/* ADR-357 Phase 7: Snap Override submenu */}
        {showSnapOverride && (
          <>
            <DropdownMenuSeparator className={styles.menuSeparator} />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className={styles.menuItem}>
                <span className={styles.menuItemLabel}>{t('contextMenu.snapOverride.title')}</span>
                <span className={styles.menuItemShortcut}>▶</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className={styles.menuContent}>
                {/* Special overrides */}
                <DropdownMenuItem
                  className={styles.menuItem}
                  onClick={() => handleSnapOverride('from')}
                >
                  <span className={styles.menuItemLabel}>{t('contextMenu.snapOverride.from')}</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className={styles.menuItem}
                  onClick={() => handleSnapOverride('m2p')}
                >
                  <span className={styles.menuItemLabel}>{t('contextMenu.snapOverride.m2p')}</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className={styles.menuItem}
                  onClick={() => handleSnapOverride('app')}
                >
                  <span className={styles.menuItemLabel}>{t('contextMenu.snapOverride.app')}</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator className={styles.menuSeparator} />
                {/* Single-use engine overrides */}
                {SNAP_OVERRIDE_ENGINES.map(engine => (
                  <DropdownMenuItem
                    key={engine.type}
                    className={styles.menuItem}
                    onClick={() => handleSnapOverride(engine.type)}
                  >
                    <span className={styles.menuItemLabel}>
                      {t(engine.labelKey)} ({t('contextMenu.snapOverride.once')})
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </>
        )}

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

DrawingContextMenuInner.displayName = 'DrawingContextMenu';

// Default export for backward compatibility
export default DrawingContextMenuInner;

// ===== NAMED EXPORTS =====
export { DrawingContextMenuInner as DrawingContextMenu };
export type { DrawingContextMenuProps };
